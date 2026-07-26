import * as fs from 'node:fs'
import * as path from 'node:path'
import elementsData from '../src/data/elements.json' with { type: 'json' }
import { parseArmorCustomization } from '../src/utils/armorCustomization.ts'
import type { AlsoSeeRef, FamilySourceRef, LevelVariant, ObtainVariant } from '../src/types/item.ts'
import {
  computeFamilyFlags,
  computePriceType,
  normalizeLevel,
  obtainVariantHasDC,
  parseRomanNumeral,
  stripVersionSuffix,
} from '../src/utils/variantHelpers.ts'
import { compareTitles, titleSortKey } from '../src/utils/displayText.ts'
import { inferImageCaptionFromUrl, normalizeImageCaption } from '../src/utils/imageLabels.ts'
import {
  type Weapon,
  type WeaponEntry,
  type WeaponFamily,
  type WeaponSpecial,
  type WeaponSubtype,
  WEAPON_SUBTYPES,
} from '../src/types/weapon.ts'
import { extractAlsoSeeRefs, type ParsedAlsoSeeRef } from './lib/also-see.ts'
import { writeWeaponManifest } from './lib/data-manifests.ts'
import { FORUM_BASE, fetchForumPage as fetchPage, loadForumCookie, withRetry } from './lib/forum.ts'
import { getImageCaptionNoise, isImageCaptionNoiseLine } from './lib/note-cleaning.ts'
import { rephraseTimedSellback } from './lib/obtain-formatting.ts'
import { fetchPrintable, getAllPostContent } from './lib/printable-parser.ts'
import {
  applyLimit,
  applyNameFilter,
  getArg,
  getConcurrencyArg,
  getLimitArg,
  getNameFilterArgs,
  matchesNameFilter,
} from './lib/scraper-cli.ts'
import {
  decodeHtml,
  normalizeStructuredText,
  slugify,
  stripSimpleHtml as stripHtml,
} from './lib/text.ts'
import { processWithConcurrency } from './lib/work-queue.ts'

const WEAPONS_INDEX_URL = `${FORUM_BASE}/printable.asp?m=22094733`
const OUTPUT_DIR = path.resolve(import.meta.dirname, '../src/data')
const DELAY_MS = 900

interface WeaponStub {
  name: string
  forumUrl: string
  messageId: string
  subtype: WeaponSubtype
}

type WeaponRefResolver = (refs: ParsedAlsoSeeRef[]) => AlsoSeeRef[]

const WEAPON_DATA_FILES: Record<WeaponSubtype, string[]> = {
  'sword-axe-mace': [
    'weapons-swords-axes-maces-a-g.json',
    'weapons-swords-axes-maces-h-n.json',
    'weapons-swords-axes-maces-o-z.json',
  ],
  'staff-wand': [
    'weapons-staves-wands-a-g.json',
    'weapons-staves-wands-h-n.json',
    'weapons-staves-wands-o-z.json',
  ],
  dagger: ['weapons-daggers-a-g.json', 'weapons-daggers-h-n.json', 'weapons-daggers-o-z.json'],
  scythe: ['weapons-scythes-a-j.json', 'weapons-scythes-k-z.json'],
}

const elementEntries = (
  elementsData as {
    elements: Array<{ code: string; name: string; shortName: string }>
  }
).elements
const elementPatterns = elementEntries.map((entry) => ({
  code: entry.code,
  patterns: [
    new RegExp(`\\b${entry.code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
    new RegExp(`\\b${entry.shortName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
    new RegExp(
      `\\b${entry.name.replace(/\s+Element$/i, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
      'i'
    ),
  ],
}))

function loadCookie(): string {
  try {
    return loadForumCookie('weapon scraper')
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error))
  }
}

function weaponSlugForName(name: string): string {
  return `weapon-${slugify(name)}`
}

function getInitialForName(name: string): string {
  const sortableName = titleSortKey(name)
  return /^[A-Z]/i.test(sortableName) ? sortableName[0].toUpperCase() : '#'
}

function dataFileForEntry(entry: WeaponEntry): string {
  const name = 'familyName' in entry ? entry.familyName : entry.name
  const initial = getInitialForName(name)
  const files = WEAPON_DATA_FILES[entry.subtype]

  if (entry.subtype === 'scythe') return initial >= 'K' && initial <= 'Z' ? files[1] : files[0]
  if (initial >= 'H' && initial <= 'N') return files[1]
  if (initial >= 'O' && initial <= 'Z') return files[2]
  return files[0]
}

function normalizeForumUrl(url: string): string {
  if (url.startsWith('http')) return url
  return `${FORUM_BASE}/${url.replace(/^\.\//, '')}`
}

function inferSubtypeFromHeading(text: string): WeaponSubtype | undefined {
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim()
  if (/swords?.*axes?.*maces?/.test(normalized)) return 'sword-axe-mace'
  if (/staves?.*wands?/.test(normalized)) return 'staff-wand'
  if (/daggers?/.test(normalized)) return 'dagger'
  if (/scythes?/.test(normalized)) return 'scythe'
  return undefined
}

function parseIndexStubs(html: string): WeaponStub[] {
  const stubs: WeaponStub[] = []
  const seen = new Set<string>()
  let currentSubtype: WeaponSubtype | undefined

  for (const chunk of html.split(/<br\s*\/?>/i)) {
    const text = stripHtml(decodeHtml(chunk)).replace(/\s+/g, ' ').trim()
    const subtype = inferSubtypeFromHeading(text)
    if (subtype) {
      currentSubtype = subtype
      continue
    }
    if (!currentSubtype) continue

    const linkMatch =
      /href=["']?(?:https?:\/\/forums2\.battleon\.com\/f\/|\/f\/|\.\/)?((?:tm|fb)\.asp\?m=(\d+)[^"'\s>]*)["'\s>]/i.exec(
        chunk
      )
    if (!linkMatch) continue
    const anchorText = stripHtml(decodeHtml(chunk.match(/<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? ''))
      .replace(/\s+/g, ' ')
      .trim()
    if (!anchorText) continue

    const key = `${currentSubtype}:${linkMatch[2]}:${anchorText.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    stubs.push({
      name: anchorText,
      forumUrl: normalizeForumUrl(linkMatch[1]),
      messageId: linkMatch[2],
      subtype: currentSubtype,
    })
  }

  return stubs.sort((a, b) => compareTitles(a.name, b.name))
}

function createWeaponRefResolver(stubs: WeaponStub[]): WeaponRefResolver {
  const stubByMessageId = new Map(stubs.map((stub) => [stub.messageId, stub]))
  const stubByName = new Map(stubs.map((stub) => [stub.name.toLowerCase(), stub]))

  return (refs) => {
    const resolved = new Map<string, AlsoSeeRef>()
    for (const ref of refs) {
      const messageId = ref.url?.match(/[?&]m=(\d+)/i)?.[1]
      const targetStub =
        (messageId ? stubByMessageId.get(messageId) : undefined) ??
        stubByName.get(ref.name.trim().toLowerCase())
      const name = targetStub?.name ?? ref.name.trim()
      const slug = targetStub ? weaponSlugForName(targetStub.name) : weaponSlugForName(name)
      const url = ref.url ? normalizeForumUrl(ref.url) : targetStub?.forumUrl
      resolved.set(`${slug}|${url ?? ''}`, {
        name,
        slug,
        type: 'weapon',
        ...(url ? { url } : {}),
      })
    }
    return Array.from(resolved.values()).sort((a, b) => compareTitles(a.name, b.name))
  }
}

function findLastSection(html: string, sectionRegex: RegExp): string | undefined {
  const matches = [...html.matchAll(sectionRegex)]
  const last = matches.at(-1)
  if (!last || last.index === undefined) return undefined
  return html.slice(last.index + last[0].length)
}

function findOtherInformationSection(html: string): string | undefined {
  return (
    findLastSection(html, /<b>\s*<u>\s*Other [Ii]nformation\s*<\/u>\s*<\/b>/gi) ??
    findLastSection(html, /<u>\s*Other [Ii]nformation\s*<\/u>/gi) ??
    findLastSection(html, /(?:<b>\s*)?Other [Ii]nformation\s*:(?:\s*<\/b>)?/gi) ??
    findLastSection(html, /\bOther [Ii]nformation\b/gi)
  )
}

function getLeadHtml(html: string): string {
  const firstFieldIndex =
    [
      /(?:<b>)?Level:(?:<\/b>)?/i,
      /(?:<b>)?Element:(?:<\/b>)?/i,
      /(?:<b>)?Damage:(?:<\/b>)?/i,
      /(?:<b>)?Location:(?:<\/b>)?/i,
      /<u>\s*Other [Ii]nformation\s*<\/u>/i,
      /(?:<b>\s*)?Other [Ii]nformation\s*:/i,
      /\bOther [Ii]nformation\b/i,
    ]
      .map((pattern) => html.search(pattern))
      .filter((index) => index >= 0)
      .sort((a, b) => a - b)[0] ?? html.length
  return html.slice(0, firstFieldIndex)
}

function parseFieldValue(text: string, labels: string[]): string | undefined {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = text.match(new RegExp(`${escaped}:\\s*([^\\n]+)`, 'i'))
    const value = match?.[1]?.trim()
    if (value) return value
  }
  return undefined
}

function parseHtmlField(html: string, labels: string[]): string | undefined {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = html.match(
      new RegExp(
        `(?:<b>\\s*)?${escaped}:(?:\\s*<\\/b>)?\\s*([\\s\\S]*?)(?=<br\\s*\\/?>|<\\/span>|<b><u>|$)`,
        'i'
      )
    )
    const value = match?.[1]
      ? normalizeStructuredText(match[1])
          .replace(/\n+/g, ' ')
          .replace(/\s{2,}/g, ' ')
          .trim()
      : undefined
    if (value) return value
  }
  return undefined
}

function parseDescription(html: string): string {
  const italicMatches = [...getLeadHtml(html).matchAll(/<i>([\s\S]*?)<\/i>/gi)]
  for (const match of italicMatches) {
    const text = normalizeStructuredText(match[1]).trim()
    if (!text || /thanks to/i.test(text)) continue
    return text
  }
  return ''
}

function parseNotes(html: string): string | undefined {
  const sectionPattern =
    /(?:<b>\s*)?<u>\s*Other [Ii]nformation\s*<\/u>\s*(?:<\/b>)?|(?:<b>\s*)?Other [Ii]nformation\s*:(?:\s*<\/b>)?/gi
  const sections = [...html.matchAll(sectionPattern)].map((match, index, matches) => {
    const start = (match.index ?? 0) + match[0].length
    const end = matches[index + 1]?.index ?? html.length
    return html.slice(start, end)
  })
  if (sections.length === 0) return undefined

  const trimmedSection = sections
    .map((section) => section.split(/<i>Thanks to|Also See:|<font color='#eeeeee'>|<hr/i)[0])
    .join('\n')
    .replace(
      /<a[^>]+href=(["'])([^"']*?\.(?:png|jpg|jpeg|gif|bmp)(?:\?[^"']*)?)\1[^>]*>[\s\S]*?<\/a>/gi,
      ''
    )
    .replace(/<img[^>]+src="[^"]+\.(?:png|jpg|jpeg|gif|bmp)"[^>]*>/gi, '')
    .replace(/https?:\/\/[^\s"'<>]+\.(?:png|jpg|jpeg|gif|bmp)(?:\?[^\s"'<>]*)?/gi, '')
  const imageCaptionNoise = getImageCaptionNoise(sections.join('\n'))
  for (const match of sections
    .join('\n')
    .matchAll(/<b>\s*([^<]+?)\s*<\/b>\s*(?:<br\s*\/?>|\s)*\s*<img[^>]+src=/gi)) {
    const normalizedCaption = normalizeStructuredText(match[1])
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
    if (normalizedCaption) imageCaptionNoise.add(normalizedCaption)
  }
  const noteLines: string[] = []

  for (const line of normalizeStructuredText(trimmedSection).split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (/\w+\s+--\s+\d+\/\d+\/\d+\s+\d+:\d+:\d+/.test(trimmed)) continue
    if (/^[\s/|\\-]+$/.test(trimmed)) continue
    if (isImageCaptionNoiseLine(trimmed, imageCaptionNoise)) continue
    if (
      /^(?:clicked appearance|alternative image|alt(?:ernative)? appearance|appearance(?:\s+\d.*)?)$/i.test(
        trimmed
      )
    ) {
      continue
    }
    const cleanedText = trimmed.replace(/^[•*-]\s*/, '')
    if (/^\s{2,}/.test(line) && noteLines.length > 0) {
      noteLines.push(`  • ${cleanedText}`)
    } else {
      noteLines.push(cleanedText)
    }
  }

  return noteLines.length > 0 ? noteLines.join('\n') : undefined
}

function parseTagFlags(html: string) {
  const leadHtml = getLeadHtml(html)
  const tagPattern = (tag: string) => new RegExp(`/tags/${tag}\\.(?:png|jpg|jpeg|gif)`, 'i')
  return {
    daRequired: tagPattern('DA').test(leadHtml),
    dcRequired: tagPattern('DC').test(leadHtml),
    dmRequired: tagPattern('DM').test(leadHtml),
    isTemp: /\/tags\/Temp\.(?:png|jpg|jpeg|gif)/i.test(leadHtml),
    isRare: /\/tags\/Rare\.(?:png|jpg|jpeg|gif)/i.test(leadHtml),
    isSeasonal: /\/tags\/Seasonal\.(?:png|jpg|jpeg|gif)/i.test(leadHtml),
    isSpecialOffer: /\/tags\/SpecialOffer\.(?:png|jpg|jpeg|gif)/i.test(leadHtml),
    retired: /\/tags\/Retired\.(?:png|jpg|jpeg|gif)/i.test(leadHtml),
  }
}

function hasCosmeticMarker(text: string): boolean {
  return /\(\s*Cosmetic\s*\)/i.test(text)
}

function hasVersionRange(name: string): boolean {
  return /\([IVXLCDM]+(?:\s*(?:,|-)\s*[IVXLCDM]+)+\)$/i.test(name.trim())
}

function hasAllVersionsSuffix(name: string): boolean {
  return /\(All Versions\)\s*$/i.test(name.trim())
}

function getVariantRomanFromName(name: string): string | undefined {
  const match = name.match(/\b([IVXLCDM]+)\s*(?:\([^)]*\))?$/i)
  const roman = match?.[1]?.toUpperCase()
  return roman && parseRomanNumeral(roman) !== null ? roman : undefined
}

function splitPrintablePosts(html: string): string[] {
  if (/<hr>/i.test(html)) return html.split(/<hr>/i).filter((post) => post.trim())
  const posts = [...html.matchAll(/<span\s+class=["']?msg["']?[^>]*>([\s\S]*?)<\/span>/gi)].map(
    (match) => match[1]
  )
  return posts.length > 0 ? posts : [html]
}

function extractTitleBlocks(html: string): Array<{ title: string; html: string }> {
  const matches = [...html.matchAll(/<font\s+size=['"]?3['"]?\s*>\s*<b>([\s\S]*?)<\/b>\s*<\/font>/gi)]
  return matches
    .map((match, index) => {
      const start = match.index ?? 0
      const rawEnd = matches[index + 1]?.index ?? html.length
      const trailingNextPrefix =
        html
          .slice(Math.max(0, rawEnd - 250), rawEnd)
          .match(/(?:<img[^>]+\/tags\/(?:DA|DC|DM)\.(?:png|jpg|jpeg|gif)[^>]*>\s*)+$/i)?.[0] ??
        ''
      const end = rawEnd - trailingNextPrefix.length
      const prefix =
        html
          .slice(Math.max(0, start - 250), start)
          .match(/(?:<img[^>]+\/tags\/(?:DA|DC|DM)\.(?:png|jpg|jpeg|gif)[^>]*>\s*)+$/i)?.[0] ??
        ''
      return {
        title: normalizeStructuredText(match[1]).trim(),
        html: `${prefix}${html.slice(start, end)}`,
      }
    })
    .filter((block) => block.title && !/^Special$/i.test(block.title))
}

function parseDaRequiredFromBlock(html: string): boolean {
  return (
    /\/tags\/DA\.(?:png|jpg|jpeg|gif)/i.test(html) ||
    /This item requires a Dragon Amulet/i.test(normalizeStructuredText(html))
  )
}

function parseDcRequiredFromBlock(html: string, method: ObtainVariant): boolean {
  return /\/tags\/DC\.(?:png|jpg|jpeg|gif)/i.test(html) || obtainVariantHasDC(method)
}

function parseDmRequiredFromBlock(html: string, method: ObtainVariant): boolean {
  return (
    /\/tags\/DM\.(?:png|jpg|jpeg|gif)/i.test(html) ||
    method.priceType === 'dm' ||
    /Defender'?s Medal/i.test(method.requiredItems ?? '')
  )
}

function parseWeaponSpecial(html: string): WeaponSpecial | undefined {
  const section = html.match(
    /<font\s+size=['"]?3['"]?\s*>\s*<b>\s*Special\s*<\/b>\s*<\/font>([\s\S]*?)(?:<b><u>\s*Other [Ii]nformation|<hr>|$)/i
  )?.[1]
  if (!section) return undefined

  const trigger = normalizeStructuredText(section.match(/<i>([\s\S]*?)<\/i>/i)?.[1] ?? '').trim()
  const effect =
    parseHtmlField(section, ['Effect']) ??
    normalizeStructuredText(section).match(/Effect:\s*([^\n]+)/i)?.[1]?.trim()
  const imageUrl = section.match(/<img[^>]+src=(["'])(.*?)\1[^>]*>/i)?.[2]
  const activation = /activates?\s+on\s+hit/i.test(trigger) ? 'on-hit' : 'manual'
  const cooldown = activation === 'manual' ? parseHtmlField(section, ['Cooldown', 'CD']) : undefined
  const chargeTime =
    activation === 'manual' ? parseHtmlField(section, ['Charge Time', 'CT']) : undefined

  if (!trigger && !effect) return undefined
  return {
    activation,
    trigger,
    effect: effect ?? '',
    ...(imageUrl ? { imageUrl: decodeHtml(imageUrl).trim().replace(/\s/g, '%20') } : {}),
    ...(cooldown ? { cooldown } : {}),
    ...(chargeTime ? { chargeTime } : {}),
  }
}

function stripWeaponSpecialSections(html: string): string {
  return html.replace(
    /<font\s+size=['"]?3['"]?\s*>\s*<b>\s*Special\s*<\/b>\s*<\/font>[\s\S]*?(?=<b>\s*<u>\s*Other [Ii]nformation|<u>\s*Other [Ii]nformation|(?:<b>\s*)?Other [Ii]nformation\s*:|<hr>|$)/gi,
    ''
  )
}

function parseElementCodes(text?: string): string[] {
  if (!text) return []
  const codes = new Set<string>()
  if (/\?\?\?/.test(text)) codes.add('???')
  for (const entry of elementPatterns) {
    if (entry.patterns.some((pattern) => pattern.test(text))) codes.add(entry.code)
  }
  return Array.from(codes)
}

function parseObtainMethods(html: string): ObtainVariant[] {
  const text = normalizeStructuredText(html)
  const location = parseHtmlField(html, ['Location']) ?? parseFieldValue(text, ['Location'])
  const price = parseHtmlField(html, ['Price']) ?? parseFieldValue(text, ['Price']) ?? 'N/A'
  const requiredItems =
    parseHtmlField(html, ['Required Item', 'Required Items']) ??
    parseFieldValue(text, ['Required Item', 'Required Items'])
  const sellback =
    parseHtmlField(html, ['Sellback', 'Sellback Price']) ??
    parseFieldValue(text, ['Sellback', 'Sellback Price'])
  const requirements =
    parseHtmlField(html, ['Requirements', 'Level/Quest/Items required']) ??
    parseFieldValue(text, ['Requirements', 'Level/Quest/Items required'])

  if (!location) return []
  const normalizedPrice = price.trim() || 'N/A'
  const priceType = computePriceType(normalizedPrice, requiredItems)
  const method: ObtainVariant = {
    location,
    price: normalizedPrice,
    priceType,
    ...(sellback ? { sellback: rephraseTimedSellback(sellback) ?? sellback } : {}),
    ...(requirements && !/^none$/i.test(requirements) ? { requirements } : {}),
    ...(requiredItems ? { requiredItems } : {}),
    daRequired: false,
    ...(priceType === 'dc' ? { dcRequired: true } : {}),
    ...(priceType === 'dm' ? { dmRequired: true } : {}),
  }
  return [method]
}

function extractWeaponImages(html: string) {
  const skipPatterns = [
    /\/f\/image\//i,
    /^image\//i,
    /^micons\//i,
    /forumheader/i,
    /\/tags\//i,
    /\/tags_banners\//i,
    /clear\.gif/i,
    /blank\.gif/i,
    /button/i,
    /attack/i,
  ]
  const normalizeImageUrl = (src: string) => decodeHtml(src).trim().replace(/\s/g, '%20')
  const isCandidateImage = (src: string) =>
    !/[<>"]/.test(src) &&
    !skipPatterns.some((pattern) => pattern.test(src)) &&
    /\.(?:png|jpg|jpeg|gif|bmp)(?:\?|$)/i.test(src)
  const imageHtml = stripWeaponSpecialSections(html)
  const otherInfoHtml = findOtherInformationSection(imageHtml)
  const scanHtml = otherInfoHtml ? `${otherInfoHtml}\n${imageHtml}` : imageHtml
  const captionedImages = [
    ...scanHtml.matchAll(
      /<b>\s*([^<]+?)\s*<\/b>\s*(?:<br\s*\/?>|\s)*\s*<img[^>]+src=(["'])(.*?)\2[^>]*>/gi
    ),
  ]
    .map((match) => ({
      url: normalizeImageUrl(match[3]),
      caption: normalizeStructuredText(match[1]).trim(),
    }))
    .filter((candidate) => isCandidateImage(candidate.url))
  const imageCandidates: Array<{ url: string; caption?: string }> = [
    ...captionedImages,
    ...[...scanHtml.matchAll(/<img[^>]+src=(["'])(.*?)\1[^>]*>/gi)].map((match) => ({
      url: normalizeImageUrl(match[2]),
    })),
    ...[
      ...scanHtml.matchAll(
        /<a[^>]+href=(["'])([^"']*?\.(?:png|jpg|jpeg|gif|bmp)(?:\?[^"']*)?)\1[^>]*>([\s\S]*?)<\/a>/gi
      ),
    ].map((match) => ({
      url: normalizeImageUrl(match[2]),
      caption: stripHtml(decodeHtml(match[3])).trim(),
    })),
    ...[
      ...scanHtml.matchAll(/https?:\/\/[^\s"<>]+\.(?:png|jpg|jpeg|gif|bmp)(?:\?[^\s"<>]*)?/gi),
    ].map((match) => ({ url: normalizeImageUrl(match[0]) })),
  ].filter((candidate) => isCandidateImage(candidate.url))
  const uniqueImageCandidatesByUrl = new Map<string, { url: string; caption?: string }>()
  for (const candidate of imageCandidates) {
    const existing = uniqueImageCandidatesByUrl.get(candidate.url)
    if (!existing) {
      uniqueImageCandidatesByUrl.set(candidate.url, candidate)
      continue
    }
    if (!existing.caption && candidate.caption) existing.caption = candidate.caption
  }
  const displayImageCandidates = [...uniqueImageCandidatesByUrl.values()]
  const defaultImage =
    displayImageCandidates.find((candidate) => /\bDefault\b/i.test(candidate.caption ?? '')) ??
    displayImageCandidates[0]
  const imageUrl = defaultImage?.url
  const captionedImageUrls = new Set(captionedImages.map((image) => image.url))
  const shouldKeepMainInSwitcher = Boolean(defaultImage && captionedImageUrls.has(defaultImage.url))
  const alternativeImages = imageUrl
    ? displayImageCandidates
        .filter((candidate) => shouldKeepMainInSwitcher || candidate.url !== imageUrl)
        .map((candidate, index) => ({
          url: candidate.url,
          caption:
            normalizeImageCaption(candidate.caption) ??
            inferImageCaptionFromUrl(candidate.url) ??
            `Alternative ${index + 1}`,
        }))
    : []

  return {
    ...(imageUrl ? { imageUrl } : {}),
    ...(alternativeImages.length > 0 ? { alternativeImages } : {}),
  }
}

function buildWeaponEntry(
  stub: WeaponStub,
  html: string,
  resolveAlsoSee: WeaponRefResolver
): Weapon {
  const normalizedText = normalizeStructuredText(html)
  const flags = parseTagFlags(html)
  const description = parseDescription(html)
  const obtainMethods = parseObtainMethods(html).map((method) => ({
    ...method,
    daRequired: method.daRequired || flags.daRequired,
    ...(flags.dcRequired || method.dcRequired || obtainVariantHasDC(method)
      ? { dcRequired: true }
      : {}),
    ...(flags.dmRequired || method.dmRequired ? { dmRequired: true } : {}),
  }))
  const explicitElement =
    parseHtmlField(html, ['Element']) ?? parseFieldValue(normalizedText, ['Element'])
  const elements = parseElementCodes(explicitElement)
  const level = parseHtmlField(html, ['Level']) ?? parseFieldValue(normalizedText, ['Level'])
  const damage = parseHtmlField(html, ['Damage']) ?? parseFieldValue(normalizedText, ['Damage'])
  const stats =
    parseHtmlField(html, ['Stats', 'Bonuses']) ??
    parseFieldValue(normalizedText, ['Stats', 'Bonuses'])
  const resists =
    parseHtmlField(html, ['Resists', 'Resistances']) ??
    parseFieldValue(normalizedText, ['Resists', 'Resistances'])
  const rarity = parseHtmlField(html, ['Rarity']) ?? parseFieldValue(normalizedText, ['Rarity'])
  const ability = parseHtmlField(html, ['Ability']) ?? parseFieldValue(normalizedText, ['Ability'])
  const notes = parseNotes(html)
  const alsoSee = resolveAlsoSee(extractAlsoSeeRefs(html))
  const images = extractWeaponImages(html)
  const weaponSpecial = parseWeaponSpecial(html)
  const armorCustomization = parseArmorCustomization(html)
  const primaryPriceType = obtainMethods[0]?.priceType
  const isCosmetic = hasCosmeticMarker(description) || hasCosmeticMarker(normalizedText)

  return {
    id: weaponSlugForName(stub.name),
    name: stub.name,
    slug: weaponSlugForName(stub.name),
    type: 'weapon',
    subtype: stub.subtype,
    description,
    forumUrl: stub.forumUrl,
    releaseDate: '',
    ...images,
    elements,
    ...(level ? { level } : {}),
    ...(damage ? { damage } : {}),
    ...(stats ? { stats } : {}),
    ...(resists ? { resists } : {}),
    ...(ability ? { ability } : {}),
    ...(weaponSpecial ? { weaponSpecial, hasSpecial: true } : {}),
    ...(armorCustomization ? { armorCustomization, hasArmorCustomization: true } : {}),
    ...(rarity ? { rarity } : {}),
    obtainMethods,
    ...(notes ? { notes } : {}),
    ...(alsoSee.length > 0 ? { alsoSee } : {}),
    tags: [
      ...elements.map((code) => code.toLowerCase()),
      ...(primaryPriceType ? [primaryPriceType] : []),
    ],
    daRequired: flags.daRequired || obtainMethods.some((method) => method.daRequired),
    ...(flags.dcRequired || obtainMethods.some((method) => method.dcRequired)
      ? { dcRequired: true }
      : {}),
    ...(flags.dmRequired || obtainMethods.some((method) => method.dmRequired)
      ? { dmRequired: true }
      : {}),
    ...(flags.isTemp ? { isTemp: true } : {}),
    ...(weaponSpecial ? { hasSpecial: true } : {}),
    ...(armorCustomization ? { hasArmorCustomization: true } : {}),
    ...(isCosmetic ? { isCosmetic: true } : {}),
    ...(flags.isRare ? { isRare: true } : {}),
    ...(flags.isSeasonal ? { isSeasonal: true } : {}),
    ...(flags.isSpecialOffer ? { isSpecialOffer: true } : {}),
    ...(flags.retired ? { retired: true } : {}),
  }
}

function parseVariantMethod(blockHtml: string) {
  const method = parseObtainMethods(blockHtml)[0]
  if (!method) return undefined
  const daRequired = method.daRequired || parseDaRequiredFromBlock(blockHtml)
  const dcRequired = parseDcRequiredFromBlock(blockHtml, method)
  const dmRequired = parseDmRequiredFromBlock(blockHtml, method)

  return {
    ...method,
    daRequired: dcRequired ? false : daRequired,
    ...(dcRequired ? { dcRequired: true } : {}),
    ...(dmRequired ? { dmRequired: true } : {}),
  }
}

function getVariantSpecificNotes(notes: string | undefined, method: ObtainVariant): string | undefined {
  if (!notes) return undefined

  const isDc = obtainVariantHasDC(method)
  const mentionsDcVersion = /\bD-?C\s+version\b|Dragon\s+Coins?\s+version/i.test(notes)
  const mentionsDaVersion = /\bD-?A\s+version\b|Dragon\s+Amulet\s+version/i.test(notes)

  if (mentionsDcVersion) return isDc ? notes : undefined
  if (mentionsDaVersion) return !isDc ? notes : undefined

  return undefined
}

function buildWeaponFamily(
  stub: WeaponStub,
  html: string,
  resolveAlsoSee: WeaponRefResolver
): WeaponFamily | undefined {
  const isAllVersions = hasAllVersionsSuffix(stub.name)
  if (!hasVersionRange(stub.name) && !isAllVersions) return undefined

  const familyName = stripVersionSuffix(stub.name)
  const familySlug = weaponSlugForName(familyName)
  const threadFlags = parseTagFlags(html)
  const images = extractWeaponImages(html)
  const notes = parseNotes(html)
  const alsoSee = resolveAlsoSee(extractAlsoSeeRefs(html))
  const weaponSpecial = parseWeaponSpecial(html)
  const armorCustomization = parseArmorCustomization(html)
  const allText = normalizeStructuredText(html)
  const posts = splitPrintablePosts(html)
  const levelVariants: LevelVariant[] = []
  const familySources: FamilySourceRef[] = []

  for (const [postIndex, post] of posts.entries()) {
    const titleBlocks = extractTitleBlocks(post)
    if (titleBlocks.length === 0) continue
    const primaryTitle = titleBlocks[0].title
    const roman = getVariantRomanFromName(primaryTitle)

    const level = parseHtmlField(post, ['Level']) ?? parseFieldValue(normalizeStructuredText(post), ['Level'])
    const levelLabel = roman ?? (isAllVersions ? (level?.trim() || String(postIndex + 1)) : undefined)
    if (!levelLabel) continue

    const normalizedLevel = normalizeLevel(levelLabel)
    const actualLevel = level && /^\d+$/.test(level.trim()) ? Number.parseInt(level.trim(), 10) : undefined
    const damage = parseHtmlField(post, ['Damage']) ?? parseFieldValue(normalizeStructuredText(post), ['Damage'])
    const explicitElement =
      parseHtmlField(post, ['Element']) ?? parseFieldValue(normalizeStructuredText(post), ['Element'])
    const element = parseElementCodes(explicitElement)[0]
    const stats =
      parseHtmlField(post, ['Stats', 'Bonuses']) ??
      parseFieldValue(normalizeStructuredText(post), ['Stats', 'Bonuses'])
    const resists =
      parseHtmlField(post, ['Resists', 'Resistances']) ??
      parseFieldValue(normalizeStructuredText(post), ['Resists', 'Resistances'])
    const rarity = parseHtmlField(post, ['Rarity']) ?? parseFieldValue(normalizeStructuredText(post), ['Rarity'])
    const description = parseDescription(post)
    const postNotes = parseNotes(post)

    const hasAccessBranches = titleBlocks.length > 1
    for (const block of titleBlocks) {
      const method = parseVariantMethod(block.html)
      if (!method) continue
      const isDc = obtainVariantHasDC(method)
      const variantName = `${roman}${hasAccessBranches && isDc ? ' (DC)' : ''}`
      const variantNotes = getVariantSpecificNotes(postNotes, method)
      levelVariants.push({
        levelNumber: normalizedLevel.number,
        levelDisplay: normalizedLevel.display,
        ...(actualLevel !== undefined ? { actualLevel } : {}),
        ...(!isAllVersions ? { variantName } : {}),
        name: primaryTitle,
        damage: damage ?? 'Unknown',
        stats: stats ?? 'None',
        obtainVariants: [method],
        sourceUrl: stub.forumUrl,
        ...(description ? { description } : {}),
        ...(element ? { element } : {}),
        ...(resists ? { resists } : {}),
        ...(rarity ? { rarity } : {}),
        ...(variantNotes ? { notes: variantNotes } : {}),
      })
    }
  }

  if (levelVariants.length <= 1) return undefined

  const elements = Array.from(
    new Set(levelVariants.map((variant) => variant.element).filter((value): value is string => Boolean(value)))
  )
  const tags = Array.from(
    new Set([
      ...elements.map((code) => code.toLowerCase()),
      ...levelVariants.flatMap((variant) => variant.obtainVariants.map((method) => method.priceType)),
      ...(weaponSpecial ? ['special'] : []),
      ...(armorCustomization ? ['armor-customization'] : []),
    ])
  )
  const family: WeaponFamily = {
    id: familySlug,
    familyName,
    slug: familySlug,
    aliasSlugs: [weaponSlugForName(stub.name)],
    type: 'weapon',
    subtype: stub.subtype,
    forumUrl: stub.forumUrl,
    familyOrigin: 'same-thread-multi-post',
    familySources,
    shared: {
      description: levelVariants[0].description ?? parseDescription(html),
      ...images,
      ...(notes ? { notes } : {}),
      ...(alsoSee.length > 0 ? { alsoSee } : {}),
      ...(weaponSpecial ? { weaponSpecial } : {}),
      ...(armorCustomization ? { armorCustomization } : {}),
    },
    levelVariants,
    category: 'Weapon',
    releaseDate: '',
    tags,
    hasDA: false,
    hasDC: false,
    hasDM: false,
    hasFree: false,
    hasMerge: false,
    elements,
    ...(threadFlags.isTemp ? { isTemp: true } : {}),
    ...(weaponSpecial ? { hasSpecial: true } : {}),
    ...(armorCustomization ? { hasArmorCustomization: true } : {}),
    ...(hasCosmeticMarker(allText) ? { isCosmetic: true } : {}),
    ...(threadFlags.isRare ? { isRare: true } : {}),
    ...(threadFlags.isSeasonal ? { isSeasonal: true } : {}),
    ...(threadFlags.isSpecialOffer ? { isSpecialOffer: true } : {}),
    ...(threadFlags.retired ? { retired: true } : {}),
    levelRange: '',
  }

  return computeFamilyFlags(family)
}

function buildWeaponEntryOrFamily(
  stub: WeaponStub,
  html: string,
  resolveAlsoSee: WeaponRefResolver
): WeaponEntry {
  return buildWeaponFamily(stub, html, resolveAlsoSee) ?? buildWeaponEntry(stub, html, resolveAlsoSee)
}

async function fetchPostContent(messageId: string, cookie: string): Promise<string> {
  return getAllPostContent(
    await withRetry(`printable ${messageId}`, () => fetchPrintable(messageId, cookie))
  )
}

function entryMatchesSelectedLetters(entry: WeaponEntry, selectedLetters?: string[]): boolean {
  if (!selectedLetters || selectedLetters.length === 0) return false
  const name = 'familyName' in entry ? entry.familyName : entry.name
  return selectedLetters.includes(getInitialForName(name))
}

function readExistingEntries(file: string): WeaponEntry[] {
  const filePath = path.resolve(OUTPUT_DIR, file)
  if (!fs.existsSync(filePath)) return []
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as WeaponEntry[]
}

function canonicalizeWeaponAlsoSeeRefs(entries: WeaponEntry[]): WeaponEntry[] {
  const aliasToCanonical = new Map<string, { slug: string; name: string }>()
  for (const entry of entries) {
    if (!('aliasSlugs' in entry) || !entry.aliasSlugs?.length) continue
    for (const aliasSlug of entry.aliasSlugs) {
      aliasToCanonical.set(aliasSlug, { slug: entry.slug, name: entry.familyName })
    }
  }

  return entries.map((entry) => {
    const rewriteRefs = (refs?: AlsoSeeRef[]) =>
      refs?.map((ref) => {
        const canonical = aliasToCanonical.get(ref.slug)
        return canonical ? { ...ref, slug: canonical.slug, name: canonical.name } : ref
      })

    if ('levelVariants' in entry) {
      return {
        ...entry,
        shared: {
          ...entry.shared,
          alsoSee: rewriteRefs(entry.shared.alsoSee)?.filter((ref) => ref.slug !== entry.slug),
        },
      }
    }

    return {
      ...entry,
      alsoSee: rewriteRefs(entry.alsoSee)?.filter((ref) => ref.slug !== entry.slug),
    }
  })
}

function writeDatasets(
  entriesBySubtype: Map<WeaponSubtype, WeaponEntry[]>,
  selectedSubtypes: WeaponSubtype[],
  selectedLetters?: string[],
  selectedNames?: string[]
) {
  for (const subtype of selectedSubtypes) {
    const incoming = entriesBySubtype.get(subtype) ?? []
    for (const file of WEAPON_DATA_FILES[subtype]) {
      const existing = readExistingEntries(file)
      const incomingForFile = incoming.filter((entry) => dataFileForEntry(entry) === file)
      const incomingSlugs = new Set(incomingForFile.map((entry) => entry.slug))
      const preserved = existing.filter((entry) => {
        const displayName = 'familyName' in entry ? entry.familyName : entry.name
        if (incomingSlugs.has(entry.slug)) return false
        if (selectedNames && matchesNameFilter(displayName, { names: selectedNames })) {
          return false
        }
        if (
          'aliasSlugs' in entry &&
          entry.aliasSlugs?.some((slug) => selectedNames?.includes(slug.replace(/^weapon-/, '')))
        ) {
          return false
        }
        if (entryMatchesSelectedLetters(entry, selectedLetters)) return false
        return true
      })
      const merged = canonicalizeWeaponAlsoSeeRefs([...preserved, ...incomingForFile]).sort((a, b) =>
        compareTitles(
          'familyName' in a ? a.familyName : a.name,
          'familyName' in b ? b.familyName : b.name
        )
      )
      fs.writeFileSync(path.resolve(OUTPUT_DIR, file), `${JSON.stringify(merged, null, 2)}\n`)
      console.log(`Wrote ${merged.length} entries to ${file}`)
    }
  }
  writeWeaponManifest(OUTPUT_DIR)
}

async function main() {
  const cookie = loadCookie()
  const subtypeArg = getArg('subtype') as WeaponSubtype | undefined
  const subtypesArg = getArg('subtypes')
  const lettersArg = getArg('letters')
    ?.toUpperCase()
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  const nameFilter = getNameFilterArgs()
  const namesArg = nameFilter.names
  const limit = getLimitArg()
  const concurrency = getConcurrencyArg(2)
  const selectedSubtypes = (
    subtypesArg
      ? subtypesArg.split(',').map((value) => value.trim())
      : subtypeArg
        ? [subtypeArg]
        : WEAPON_SUBTYPES.map((meta) => meta.subtype)
  ).filter((value): value is WeaponSubtype =>
    WEAPON_SUBTYPES.some((meta) => meta.subtype === value)
  )

  const indexHtml = await withRetry('weapons index', () => fetchPage(WEAPONS_INDEX_URL, cookie))
  const allStubs = parseIndexStubs(indexHtml)
  const resolveAlsoSee = createWeaponRefResolver(allStubs)
  const scopedStubs = allStubs.filter((stub) => {
      if (!selectedSubtypes.includes(stub.subtype)) return false
      if (
        lettersArg &&
        lettersArg.length > 0 &&
        !lettersArg.includes(getInitialForName(stub.name))
      ) {
        return false
      }
      return true
    })
  const namedStubs = applyNameFilter(scopedStubs, nameFilter, (stub) => stub.name)
  if (namedStubs.message) console.log(namedStubs.message)
  const selectedStubs = applyLimit(namedStubs.entries, limit)
  if (selectedStubs.length === 0) {
    console.log('No selected weapons matched; leaving weapon data unchanged.')
    return
  }
  console.log(`Scraping ${selectedStubs.length} weapons with concurrency ${concurrency}`)

  const entriesBySubtype = new Map<WeaponSubtype, WeaponEntry[]>(
    selectedSubtypes.map((subtype) => [subtype, []])
  )
  await processWithConcurrency({
    items: selectedStubs,
    concurrency,
    startDelayMs: DELAY_MS,
    processItem: async (stub) => {
      const html = await fetchPostContent(stub.messageId, cookie)
      const entry = buildWeaponEntryOrFamily(stub, html, resolveAlsoSee)
      entriesBySubtype.get(stub.subtype)?.push(entry)
      console.log(`✓ ${stub.name}`)
    },
  })

  writeDatasets(entriesBySubtype, selectedSubtypes, lettersArg, namesArg)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
