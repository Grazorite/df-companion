import * as fs from 'node:fs'
import * as path from 'node:path'
import elementsData from '../src/data/elements.json' with { type: 'json' }
import { parseArmorCustomization } from '../src/utils/armorCustomization.ts'
import type { AlsoSeeRef, FamilySourceRef, LevelVariant, ObtainVariant } from '../src/types/item.ts'
import {
  computeFamilyFlags,
  computePriceType,
  normalizeLevel,
  normalizeRomanDisplay,
  obtainVariantHasDC,
  parseRomanNumeral,
  stripVersionSuffix,
} from '../src/utils/variantHelpers.ts'
import { compareTitles, displayTitle, titleSortKey } from '../src/utils/displayText.ts'
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
import { shouldPreserveFamilyForSameSlugIncoming } from './lib/family-merge-guard.ts'
import { hasRetiredTag } from './lib/tags.ts'
import {
  FORUM_BASE,
  directForumPostUrl,
  fetchForumPage as fetchPage,
  isPostUnavailableError,
  loadForumCookie,
  withRetry,
} from './lib/forum.ts'
import {
  getImageCaptionNoise,
  isImageCaptionNoiseLine,
  unwrapImageHyperlinks,
} from './lib/note-cleaning.ts'
import { rephraseTimedSellback } from './lib/obtain-formatting.ts'
import {
  extractThreadPostContents,
  fetchPrintable,
  fetchThreadPages,
  getAllPostContent,
} from './lib/printable-parser.ts'
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
  stripForumHtml,
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
type CrossSubtypeThreadContext = Map<
  string,
  Map<
    WeaponSubtype,
    {
      representative: WeaponStub
      names: string[]
    }
  >
>

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

function inferSubtypeFromItemType(itemType: string | undefined): WeaponSubtype | undefined {
  if (!itemType) return undefined
  const normalized = itemType.toLowerCase().replace(/\s+/g, ' ').trim()
  if (/\b(?:sword|axe|mace)\b/.test(normalized)) return 'sword-axe-mace'
  if (/\b(?:staff|wand)\b/.test(normalized)) return 'staff-wand'
  if (/\bdagger\b/.test(normalized)) return 'dagger'
  if (/\bscythe\b/.test(normalized)) return 'scythe'
  return undefined
}

function parseIndexStubs(html: string): WeaponStub[] {
  const stubs: WeaponStub[] = []
  const seen = new Set<string>()
  let currentSubtype: WeaponSubtype | undefined

  for (const chunk of html.split(/<br\s*\/?>/i)) {
    const text = stripHtml(decodeHtml(chunk)).replace(/\s+/g, ' ').trim()
    const subtype = /<a\b/i.test(chunk) ? undefined : inferSubtypeFromHeading(text)
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
    if (/^\([A-Z](?:-[A-Z])?\)$/i.test(anchorText)) continue

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

function getMessageIdFromForumUrl(url: string): string | undefined {
  return url.match(/[?&]m=(\d+)/i)?.[1]
}

function getWeaponTitleFromHtml(html: string): string | undefined {
  return extractTitleBlocks(html)[0]?.title
}

function normalizeWeaponTitleKey(name: string): string {
  return normalizeStructuredText(name).replace(/\s+/g, ' ').trim().toLowerCase()
}

function getWeaponThreadGroupKey(stub: WeaponStub): string {
  return normalizeWeaponTitleKey(
    stripVersionSuffix(stub.name).replace(/\s+\((?:[A-Z]{1,3}|Base)\)\s*$/i, '')
  )
}

function isPlainThreadStubName(name: string): boolean {
  return !/\([^)]+\)\s*$/.test(stripVersionSuffix(name))
}

function chooseRepresentativeWeaponStub(stubs: WeaponStub[]): WeaponStub {
  return (
    stubs.find((stub) => isPlainThreadStubName(stub.name)) ??
    [...stubs].sort((a, b) => a.name.length - b.name.length || compareTitles(a.name, b.name))[0]
  )
}

function buildCrossSubtypeThreadContext(stubs: WeaponStub[]): CrossSubtypeThreadContext {
  const byGroupAndSubtype = new Map<string, Map<WeaponSubtype, WeaponStub[]>>()
  for (const stub of stubs) {
    const groupKey = getWeaponThreadGroupKey(stub)
    const subtypeMap = byGroupAndSubtype.get(groupKey) ?? new Map()
    subtypeMap.set(stub.subtype, [...(subtypeMap.get(stub.subtype) ?? []), stub])
    byGroupAndSubtype.set(groupKey, subtypeMap)
  }

  const context: CrossSubtypeThreadContext = new Map()
  for (const [groupKey, subtypeMap] of byGroupAndSubtype) {
    const subtypeStubCount = Array.from(subtypeMap.values()).reduce(
      (count, subtypeStubs) => count + subtypeStubs.length,
      0
    )
    if (subtypeMap.size <= 1 && subtypeStubCount <= 1) continue
    const scoped = new Map<WeaponSubtype, { representative: WeaponStub; names: string[] }>()
    for (const [subtype, subtypeStubs] of subtypeMap) {
      scoped.set(subtype, {
        representative: chooseRepresentativeWeaponStub(subtypeStubs),
        names: Array.from(new Set(subtypeStubs.map((stub) => stub.name))),
      })
    }
    context.set(groupKey, scoped)
  }

  return context
}

function dedupeCrossSubtypeSelectedStubs(
  stubs: WeaponStub[],
  context: CrossSubtypeThreadContext
): WeaponStub[] {
  const selectedKeys = new Set<string>()
  const selected: WeaponStub[] = []

  for (const stub of stubs) {
    const scoped = context.get(getWeaponThreadGroupKey(stub))?.get(stub.subtype)
    if (!scoped) {
      selected.push(stub)
      continue
    }

    const key = `${getWeaponThreadGroupKey(stub)}:${stub.subtype}`
    if (selectedKeys.has(key)) continue
    selectedKeys.add(key)
    selected.push(scoped.representative)
  }

  return selected.sort((a, b) => compareTitles(a.name, b.name))
}

function scopeWeaponHtmlToSubtypeTitles(html: string, allowedTitles?: string[]): string {
  if (!allowedTitles || allowedTitles.length === 0) return html
  const allowed = new Set(allowedTitles.map(normalizeWeaponTitleKey))
  const matchingPosts = splitPrintablePosts(html).filter((post) => {
    const titleBlocks = extractTitleBlocks(post)
    return (
      titleBlocks.some((block) => allowed.has(normalizeWeaponTitleKey(block.title))) ||
      isDedicatedWeaponSpecialPost(post)
    )
  })

  return matchingPosts.length > 0 ? matchingPosts.join('\n<hr>\n') : html
}

function isDedicatedWeaponSpecialPost(html: string): boolean {
  const titles = [
    ...html.matchAll(/<font\s+size=['"]?3['"]?\s*>\s*<b>([\s\S]*?)<\/b>\s*<\/font>/gi),
  ]
    .map((match) => normalizeStructuredText(match[1]).trim())
    .filter(Boolean)
  return titles.length > 0 && titles.every((title) => /^Special$/i.test(title))
}

function getCrossSubtypeAlsoSeeRefs(
  stub: WeaponStub,
  context: CrossSubtypeThreadContext
): AlsoSeeRef[] {
  const scoped = context.get(getWeaponThreadGroupKey(stub))
  if (!scoped) return []

  return Array.from(scoped.entries())
    .filter(([subtype]) => subtype !== stub.subtype)
    .map(([, sibling]) => ({
      name: sibling.representative.name,
      slug: weaponSlugForName(sibling.representative.name),
      type: 'weapon' as const,
      url: sibling.representative.forumUrl,
    }))
    .sort((a, b) => compareTitles(a.name, b.name))
}

function mergeAlsoSeeRefs(...groups: AlsoSeeRef[][]): AlsoSeeRef[] {
  const refs = new Map<string, AlsoSeeRef>()
  for (const group of groups) {
    for (const ref of group) {
      refs.set(`${ref.type}:${ref.slug}:${ref.url ?? ''}`.toLowerCase(), ref)
    }
  }
  return Array.from(refs.values()).sort((a, b) => compareTitles(a.name, b.name))
}

function getUrlFilterArgs(): string[] | undefined {
  const url = getArg('url')
  const urls = getArg('urls')
  const values = [
    ...(url ? [url] : []),
    ...(urls ? urls.split(',').map((value) => value.trim()) : []),
  ].filter(Boolean)
  return values.length > 0 ? values : undefined
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
    findLastSection(html, /<b>\s*<u>\s*Other [Ii]nformations?\s*<\/u>\s*<\/b>/gi) ??
    findLastSection(html, /<u>\s*Other [Ii]nformations?\s*<\/u>/gi) ??
    findLastSection(html, /(?:<b>\s*)?Other [Ii]nformations?\s*:(?:\s*<\/b>)?/gi) ??
    findLastSection(html, /\bOther [Ii]nformations?\b/gi)
  )
}

function getLeadHtml(html: string): string {
  const firstFieldIndex =
    [
      /(?:<b>)?Level:(?:<\/b>)?/i,
      /(?:<b>)?Element:(?:<\/b>)?/i,
      /(?:<b>)?Damage:(?:<\/b>)?/i,
      /(?:<b>)?Location:(?:<\/b>)?/i,
      /<u>\s*Other [Ii]nformations?\s*<\/u>/i,
      /(?:<b>\s*)?Other [Ii]nformations?\s*:/i,
      /\bOther [Ii]nformations?\b/i,
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

function parseWeaponSpecialEffect(section: string): string | undefined {
  const match = section.match(
    /(?:<b>\s*)?Effect:(?:\s*<\/b>)?\s*([\s\S]*?)(?=(?:<br\s*\/?>\s*)*(?:Cooldown:|CD:|Charge Time:|CT:|(?:<b>\s*)?<u>\s*Other [Ii]nformations?\s*<\/u>|<font\s+size=['"]?3['"]?\s*>\s*<b>\s*Special\s*<\/b>\s*<\/font>|<hr|<img\b|$))/i
  )
  const rawEffect = match?.[1]
  if (!rawEffect) return undefined

  return decodeHtml(
    stripForumHtml(rawEffect, 'weapon special effect', { preserveIndentation: true })
  )
    .split('\n')
    .map((line) => {
      const indent = line.match(/^\s*/)?.[0] ?? ''
      return `${indent}${line
        .slice(indent.length)
        .replace(/[ \t]{2,}/g, ' ')
        .trimEnd()}`
    })
    .filter((line) => line.trim())
    .join('\n')
    .trim()
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
    /(?:<b>\s*)?<u>\s*Other [Ii]nformations?\s*<\/u>\s*(?:<\/b>)?|(?:<b>\s*)?Other [Ii]nformations?\s*:(?:\s*<\/b>)?/gi
  const sections = [...html.matchAll(sectionPattern)].map((match, index, matches) => {
    const start = (match.index ?? 0) + match[0].length
    const end = matches[index + 1]?.index ?? html.length
    return html.slice(start, end)
  })
  if (sections.length === 0) return undefined

  const trimmedSection = unwrapImageHyperlinks(
    sections
      .map((section) => section.split(/<i>Thanks to|Also See:|<font color='#eeeeee'>|<hr/i)[0])
      .join('\n')
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

  const structuredLines = decodeHtml(stripForumHtml(trimmedSection))
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
  const bulletIndents = structuredLines
    .filter((line) => /^\s*•\s+\S/.test(line))
    .map((line) => line.match(/^\s*/)?.[0].length ?? 0)
  const minBulletIndent = bulletIndents.length > 0 ? Math.min(...bulletIndents) : 0

  for (const rawLine of structuredLines) {
    const line = rawLine.startsWith(' '.repeat(minBulletIndent))
      ? rawLine.slice(minBulletIndent)
      : rawLine
    const trimmed = line.trim()
    if (!trimmed) continue
    if (/\w+\s+--\s+\d+\/\d+\/\d+\s+\d+:\d+:\d+/.test(trimmed)) continue
    if (/^[\s/|\\-]+$/.test(trimmed)) continue
    if (isImageCaptionNoiseLine(trimmed, imageCaptionNoise)) continue
    if (/^Click\s+here\s+on\s+the\s+weapon\s+to\s+change\s+its\s+appearance\b/i.test(trimmed)) {
      continue
    }
    if (
      /^(?:clicked appearance|alternative image|alt(?:ernative)? appearance|appearance(?:\s+\d.*)?)$/i.test(
        trimmed
      )
    ) {
      continue
    }
    const cleanedText = trimmed.replace(/^[•*-]\s*/, '')
    if (/^\s+/.test(line) && noteLines.length > 0) {
      noteLines.push(`  • ${cleanedText}`)
    } else {
      noteLines.push(cleanedText)
    }
  }

  return noteLines.length > 0 ? noteLines.join('\n') : undefined
}

function combineNoteBlocks(...notes: Array<string | undefined>): string | undefined {
  const blocks = notes.map((note) => note?.trim()).filter((note): note is string => Boolean(note))
  if (blocks.length === 0) return undefined

  const seen = new Set<string>()
  const result: string[] = []
  for (const block of blocks) {
    const key = block.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(block)
  }

  return result.join('\n')
}

function parseSharedWeaponNotes(html: string): string | undefined {
  const regularNotes = parseNotes(stripWeaponSpecialSections(html))
  const dedicatedSpecialNotes = splitPrintablePosts(html)
    .filter(isDedicatedWeaponSpecialPost)
    .map((post) => parseNotes(post))

  return combineNoteBlocks(regularNotes, ...dedicatedSpecialNotes)
}

function normalizeWeaponImageCaption(caption: string | undefined, url: string): string | undefined {
  const normalizedCaption = normalizeImageCaption(caption)
  if (normalizedCaption?.toLowerCase() === 'here' && /\b(?:guide|click[-_ ]?zone)\b/i.test(url)) {
    return 'Click zone to toggle appearance'
  }
  return normalizedCaption
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
    retired: hasRetiredTag(leadHtml),
  }
}

function hasCosmeticMarker(text: string): boolean {
  return /\(\s*Cosmetic\s*\)/i.test(text)
}

function getVariantRomanFromName(name: string): string | undefined {
  const match = name.match(/\b([IVXLCDM]+)\s*(?:\([^)]*\))?$/i)
  const roman = match?.[1]?.toUpperCase()
  return roman && parseRomanNumeral(roman) !== null ? roman : undefined
}

function getParentheticalFamilyForms(name: string): string[] {
  const match = name.match(/\(([^)]+)\)\s*$/)
  if (!match) return []
  return match[1]
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

function getParentheticalFamilyVariantName(
  itemName: string,
  familyName: string
): string | undefined {
  const forms = getParentheticalFamilyForms(familyName)
  if (forms.length === 0) return undefined
  const familyBase = familyName.replace(/\s*\([^)]+\)\s*$/, '').trim()
  const normalizedItem = normalizeWeaponLookupName(itemName)

  for (const form of forms) {
    const candidate = normalizeWeaponLookupName(`${familyBase} ${form}`)
    if (normalizedItem === candidate) return form
  }

  return undefined
}

function getTrailingParentheticalVariantName(
  itemName: string,
  familyName: string
): string | undefined {
  const familyBase = stripVersionSuffix(familyName)
    .replace(/\s*\([^)]+\)\s*$/, '')
    .trim()
  if (!familyBase) return undefined
  const match = itemName.match(
    new RegExp(`^${familyBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\(([^)]+)\\)$`, 'i')
  )
  const value = match?.[1]?.trim()
  return value ? `(${value})` : undefined
}

function inferParentheticalFamilyNameFromTitles(names: string[]): string | undefined {
  const normalizedNames = names.map((name) => normalizeWeaponLookupName(name)).filter(Boolean)
  if (normalizedNames.length < 2) return undefined

  const tokenSets = normalizedNames.map((name) => name.split(' ').filter(Boolean))
  const prefix = getCommonWeaponPrefix(tokenSets)
  if (prefix.length === 0) return undefined

  const variants = tokenSets.map((tokens) => tokens.slice(prefix.length))
  if (variants.some((variant) => variant.length === 0 || variant.length > 3)) return undefined
  if (
    variants.some((variant) => {
      const label = variant.join(' ')
      return parseRomanNumeral(label.toUpperCase()) !== null || /^\d+$/.test(label)
    })
  ) {
    return undefined
  }

  const uniqueVariants = new Set(variants.map((variant) => variant.join(' ')))
  if (uniqueVariants.size !== variants.length) return undefined

  return `${titleCaseWeaponTokens(prefix)} (${variants
    .map((variant) => titleCaseWeaponTokens(variant))
    .join(', ')})`
}

function splitPrintablePosts(html: string): string[] {
  if (/<hr\s+data-post-break=/i.test(html)) {
    return html.split(/<hr\s+data-post-break=["']?true["']?\s*\/?>/i).filter((post) => post.trim())
  }
  if (/<hr>/i.test(html)) return html.split(/<hr>/i).filter((post) => post.trim())
  const posts = [...html.matchAll(/<span\s+class=["']?msg["']?[^>]*>([\s\S]*?)<\/span>/gi)].map(
    (match) => match[1]
  )
  return posts.length > 0 ? posts : [html]
}

function getPrintablePostSourceUrl(postHtml: string, fallbackUrl: string): string {
  const sourceMatch = postHtml.match(/<!--\s*source-url:\s*([^>]+?)\s*-->/i)
  return sourceMatch?.[1]?.trim() || fallbackUrl
}

function extractTitleBlocks(html: string): Array<{ title: string; html: string }> {
  const matches = [
    ...html.matchAll(/<font\s+size=['"]?3['"]?\s*>\s*<b>([\s\S]*?)<\/b>\s*<\/font>/gi),
    ...html.matchAll(/<b>\s*<font\s+size=['"]?3['"]?\s*>([\s\S]*?)<\/font>\s*<\/b>/gi),
  ].sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
  return matches
    .map((match, index) => {
      const start = match.index ?? 0
      const rawEnd = matches[index + 1]?.index ?? html.length
      const trailingNextPrefix =
        html
          .slice(Math.max(0, rawEnd - 250), rawEnd)
          .match(/(?:<img[^>]+\/tags\/(?:DA|DC|DM)\.(?:png|jpg|jpeg|gif)[^>]*>\s*)+$/i)?.[0] ?? ''
      const end = rawEnd - trailingNextPrefix.length
      const prefix =
        html
          .slice(Math.max(0, start - 250), start)
          .match(/(?:<img[^>]+\/tags\/(?:DA|DC|DM)\.(?:png|jpg|jpeg|gif)[^>]*>\s*)+$/i)?.[0] ?? ''
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

function splitWeaponSpecialSections(html: string): string[] {
  const specialTitleRegex = /<font\s+size=['"]?3['"]?\s*>\s*<b>\s*Special\s*<\/b>\s*<\/font>/gi
  const matches = [...html.matchAll(specialTitleRegex)]
  return matches.map((match, index) => {
    const start = match.index ?? 0
    const end = matches[index + 1]?.index ?? html.length
    return html.slice(start, end)
  })
}

function trimWeaponSpecialSection(section: string): string {
  const finalOtherInfo = [
    ...section.matchAll(/(?:<b>\s*)?<u>\s*Other [Ii]nformations?\s*<\/u>\s*(?:<\/b>)?/gi),
  ].at(-1)
  if (!finalOtherInfo || finalOtherInfo.index === undefined) return section

  const before = section.slice(0, finalOtherInfo.index)
  const after = section.slice(finalOtherInfo.index)
  if (/<font\s+size=['"]?3['"]?\s*>\s*<b>\s*Special\s*<\/b>\s*<\/font>/i.test(after)) {
    return section
  }
  if (/Cysero'?s Spare Hammer'?s On-Hit special is able to activate/i.test(after)) {
    return before
  }
  return section
}

function parseWeaponSpecialFromSection(
  rawSection: string,
  includeNotes: boolean = true
): WeaponSpecial | undefined {
  const section = trimWeaponSpecialSection(rawSection)

  const trigger = normalizeStructuredText(section.match(/<i>([\s\S]*?)<\/i>/i)?.[1] ?? '').trim()
  const rawEffect =
    parseWeaponSpecialEffect(section) ??
    parseHtmlField(section, ['Effect']) ??
    normalizeStructuredText(section)
      .match(/Effect:\s*([^\n]+)/i)?.[1]
      ?.trim()
  const effect = rawEffect
    ?.replace(/\s+Cooldown:\s*[\s\S]*$/i, '')
    .replace(/\s+Charge Time:\s*[\s\S]*$/i, '')
    .trim()
  const imageUrl = section.match(/<img[^>]+src=(["'])(.*?)\1[^>]*>/i)?.[2]
  const activation = /activates?\s+on\s+hit/i.test(trigger) ? 'on-hit' : 'manual'
  const cooldown = activation === 'manual' ? parseHtmlField(section, ['Cooldown', 'CD']) : undefined
  const chargeTime =
    activation === 'manual' ? parseHtmlField(section, ['Charge Time', 'CT']) : undefined
  const notes = includeNotes ? parseNotes(section) : undefined

  if (!trigger && !effect) return undefined
  return {
    activation,
    trigger,
    effect: effect ?? '',
    ...(imageUrl ? { imageUrl: decodeHtml(imageUrl).trim().replace(/\s/g, '%20') } : {}),
    ...(cooldown ? { cooldown } : {}),
    ...(chargeTime ? { chargeTime } : {}),
    ...(notes ? { notes } : {}),
  }
}

function parseWeaponSpecials(html: string): WeaponSpecial[] {
  const sections = splitWeaponSpecialSections(html)
  const includeSectionNotes = sections.length > 1
  return sections
    .map((section) => parseWeaponSpecialFromSection(section, includeSectionNotes))
    .filter((special): special is WeaponSpecial => Boolean(special))
}

function stripWeaponSpecialSections(html: string): string {
  return html.replace(
    /<font\s+size=['"]?3['"]?\s*>\s*<b>\s*Special\s*<\/b>\s*<\/font>[\s\S]*?(?=<font\s+size=['"]?3['"]?\s*>\s*<b>\s*Special\s*<\/b>\s*<\/font>|<hr>|$)/gi,
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
            normalizeWeaponImageCaption(candidate.caption, candidate.url) ??
            inferImageCaptionFromUrl(candidate.url) ??
            `Alternative ${index + 1}`,
        }))
    : []

  return {
    ...(imageUrl ? { imageUrl } : {}),
    ...(alternativeImages.length > 0 ? { alternativeImages } : {}),
  }
}

function obtainVariantFingerprint(method: ObtainVariant): string {
  return [
    method.location,
    method.price,
    method.priceType,
    method.requiredItems ?? '',
    method.requirements ?? '',
    method.dcRequired ? 'dc' : '',
    method.dmRequired ? 'dm' : '',
    method.daRequired ? 'da' : '',
  ]
    .join('|')
    .toLowerCase()
}

function dedupeObtainVariants(methods: ObtainVariant[]): ObtainVariant[] {
  const seen = new Set<string>()
  const result: ObtainVariant[] = []
  for (const method of methods) {
    const key = obtainVariantFingerprint(method)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(method)
  }
  return result
}

/**
 * Parse every obtain method in a chunk of forum HTML. Forum posts repeat the
 * item's title block once per obtain method (e.g. a gold shop entry and a free
 * quest-drop entry, or a base entry and a Dragon Coins entry). Each title block
 * carries its own Location/Price/Sellback plus preceding DA/DC/DM tag images,
 * so we parse one method per block. Falls back to whole-chunk parsing when the
 * post has a single (or no) title block.
 */
function parseObtainMethodBlocks(html: string): ObtainVariant[] {
  const blocks = extractTitleBlocks(html)
  const methods: ObtainVariant[] = []
  if (blocks.length > 1) {
    for (const block of blocks) {
      const method = parseVariantMethod(block.html)
      if (method) methods.push(method)
    }
  }
  if (methods.length === 0) return parseObtainMethods(html)
  return dedupeObtainVariants(methods)
}

function buildWeaponEntry(
  stub: WeaponStub,
  html: string,
  resolveAlsoSee: WeaponRefResolver,
  extraAlsoSee: AlsoSeeRef[] = []
): Weapon {
  const normalizedText = normalizeStructuredText(html)
  const flags = parseTagFlags(html)
  const description = parseDescription(html)
  const obtainMethods = parseObtainMethodBlocks(html).map((method) => ({
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
  const itemType =
    parseHtmlField(html, ['Item Type']) ?? parseFieldValue(normalizedText, ['Item Type'])
  const notes = parseSharedWeaponNotes(html)
  const alsoSee = mergeAlsoSeeRefs(resolveAlsoSee(extractAlsoSeeRefs(html)), extraAlsoSee)
  const images = extractWeaponImages(html)
  const weaponSpecials = parseWeaponSpecials(html)
  const weaponSpecial = weaponSpecials[0]
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
    ...(weaponSpecials.length > 1 ? { weaponSpecials } : {}),
    ...(armorCustomization ? { armorCustomization, hasArmorCustomization: true } : {}),
    ...(rarity ? { rarity } : {}),
    ...(itemType ? { itemType } : {}),
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

function getVariantSpecificNotes(
  notes: string | undefined,
  method: ObtainVariant
): string | undefined {
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
  resolveAlsoSee: WeaponRefResolver,
  extraAlsoSee: AlsoSeeRef[] = []
): WeaponFamily | undefined {
  const familyName = stripVersionSuffix(stub.name)
  const threadFlags = parseTagFlags(html)
  const images = extractWeaponImages(html)
  const notes = parseSharedWeaponNotes(html)
  const alsoSee = mergeAlsoSeeRefs(resolveAlsoSee(extractAlsoSeeRefs(html)), extraAlsoSee)
  const weaponSpecials = parseWeaponSpecials(html)
  const weaponSpecial = weaponSpecials[0]
  const armorCustomization = parseArmorCustomization(html)
  const allText = normalizeStructuredText(html)
  const posts = splitPrintablePosts(html)
  const familySources: FamilySourceRef[] = []
  const levelVariants: LevelVariant[] = []

  for (const post of posts) {
    const postSourceUrl = getPrintablePostSourceUrl(post, directForumPostUrl(stub.messageId))
    const titleBlocks = extractTitleBlocks(post)
    if (titleBlocks.length === 0) continue
    const primaryTitle = titleBlocks[0].title
    const roman = getVariantRomanFromName(primaryTitle)
    const isFamilyTitle =
      normalizeWeaponTitleKey(primaryTitle) === normalizeWeaponTitleKey(familyName)
    const familyForm = isFamilyTitle
      ? undefined
      : (getParentheticalFamilyVariantName(primaryTitle, familyName) ??
        getTrailingParentheticalVariantName(primaryTitle, familyName))
    const postText = normalizeStructuredText(post)

    const level = parseHtmlField(post, ['Level']) ?? parseFieldValue(postText, ['Level'])
    const levelLabel = roman ?? level?.trim()
    if (!levelLabel) continue

    const normalizedLevel = normalizeLevel(levelLabel)
    const actualLevel =
      level && /^\d+$/.test(level.trim()) ? Number.parseInt(level.trim(), 10) : undefined
    const damage = parseHtmlField(post, ['Damage']) ?? parseFieldValue(postText, ['Damage'])
    const explicitElement =
      parseHtmlField(post, ['Element']) ?? parseFieldValue(postText, ['Element'])
    const element = parseElementCodes(explicitElement)[0]
    const stats =
      parseHtmlField(post, ['Stats', 'Bonuses']) ?? parseFieldValue(postText, ['Stats', 'Bonuses'])
    const resists =
      parseHtmlField(post, ['Resists', 'Resistances']) ??
      parseFieldValue(postText, ['Resists', 'Resistances'])
    const rarity = parseHtmlField(post, ['Rarity']) ?? parseFieldValue(postText, ['Rarity'])
    const itemType = parseHtmlField(post, ['Item Type']) ?? parseFieldValue(postText, ['Item Type'])
    const postSubtype = inferSubtypeFromItemType(itemType)
    if (postSubtype && postSubtype !== stub.subtype) continue
    const description = parseDescription(post)
    const postNotes = parseNotes(stripWeaponSpecialSections(post))

    const methods = titleBlocks
      .map((block) => parseVariantMethod(block.html))
      .filter((method): method is ObtainVariant => Boolean(method))
    if (methods.length === 0) continue

    const dcMethods = methods.filter((method) => obtainVariantHasDC(method))
    const nonDcMethods = methods.filter((method) => !obtainVariantHasDC(method))
    const hasAccessBranches = dcMethods.length > 0 && nonDcMethods.length > 0

    const buildVariant = (
      variantMethods: ObtainVariant[],
      variantName: string | undefined,
      variantNotes: string | undefined
    ): LevelVariant => ({
      levelNumber: normalizedLevel.number,
      levelDisplay: normalizedLevel.display,
      ...(actualLevel !== undefined ? { actualLevel } : {}),
      ...(variantName ? { variantName } : {}),
      name: primaryTitle,
      damage: damage ?? 'Unknown',
      stats: stats ?? 'None',
      obtainVariants: dedupeObtainVariants(variantMethods),
      sourceUrl: postSourceUrl,
      ...(description ? { description } : {}),
      ...(element ? { element } : {}),
      ...(resists ? { resists } : {}),
      ...(rarity ? { rarity } : {}),
      ...(itemType ? { itemType } : {}),
      ...(variantNotes ? { notes: variantNotes } : {}),
    })

    if (hasAccessBranches) {
      // Keep the base and Dragon Coins entries as distinct same-level variants
      // (e.g. Abyssal Elf Scepter I / I (DC), or | Base / DC). Notes stay scoped
      // to the branch they explicitly reference.
      levelVariants.push(
        buildVariant(
          nonDcMethods,
          familyForm ?? roman ?? '(Base)',
          getVariantSpecificNotes(postNotes, nonDcMethods[0])
        )
      )
      levelVariants.push(
        buildVariant(
          dcMethods,
          familyForm ? `${familyForm} (DC)` : roman ? `${roman} (DC)` : '(Base) (DC)',
          getVariantSpecificNotes(postNotes, dcMethods[0])
        )
      )
    } else {
      // A single access tier: collapse every obtain method for this level into
      // one variant rendered as Method 1 / Method 2 (e.g. 13th Staff level 13,
      // where a gold shop entry and a free quest drop are both non-DC).
      levelVariants.push(buildVariant(methods, familyForm ?? roman, postNotes))
    }
  }

  if (levelVariants.length <= 1) return undefined

  const finalFamilyName =
    familyName.includes('(') || levelVariants.some((level) => level.variantName)
      ? familyName
      : (inferParentheticalFamilyNameFromTitles(levelVariants.map((level) => level.name)) ??
        familyName)
  const finalFamilySlug = weaponSlugForName(finalFamilyName)
  const finalLevelVariants =
    finalFamilyName === familyName
      ? levelVariants
      : levelVariants.map((level) => ({
          ...level,
          variantName:
            getParentheticalFamilyVariantName(level.name, finalFamilyName) ?? level.variantName,
        }))
  const elements = Array.from(
    new Set(
      finalLevelVariants
        .map((variant) => variant.element)
        .filter((value): value is string => Boolean(value))
    )
  )
  const itemTypes = Array.from(
    new Set(
      finalLevelVariants
        .map((variant) => variant.itemType)
        .filter((value): value is string => Boolean(value))
    )
  )
  const tags = Array.from(
    new Set([
      ...elements.map((code) => code.toLowerCase()),
      ...finalLevelVariants.flatMap((variant) =>
        variant.obtainVariants.map((method) => method.priceType)
      ),
      ...(weaponSpecial ? ['special'] : []),
      ...(armorCustomization ? ['armor-customization'] : []),
    ])
  )
  const family: WeaponFamily = {
    id: finalFamilySlug,
    familyName: finalFamilyName,
    slug: finalFamilySlug,
    aliasSlugs: [weaponSlugForName(stub.name)].filter((slug) => slug !== finalFamilySlug),
    type: 'weapon',
    subtype: stub.subtype,
    forumUrl: stub.forumUrl,
    familyOrigin: 'same-thread-multi-post',
    familySources:
      familySources.length > 0
        ? familySources
        : dedupeWeaponFamilySources(
            finalLevelVariants.map((level, index) => ({
              url: level.sourceUrl ?? directForumPostUrl(stub.messageId),
              title: `DF Encyclopedia: ${level.name}`,
              variantLabel: level.name,
              isPrimary: index === 0,
            }))
          ),
    ...(itemTypes.length === 1 ? { itemType: itemTypes[0] } : {}),
    shared: {
      description: finalLevelVariants[0].description ?? parseDescription(html),
      ...images,
      ...(notes ? { notes } : {}),
      ...(alsoSee.length > 0 ? { alsoSee } : {}),
      ...(weaponSpecial ? { weaponSpecial } : {}),
      ...(weaponSpecials.length > 1 ? { weaponSpecials } : {}),
      ...(armorCustomization ? { armorCustomization } : {}),
    },
    levelVariants: finalLevelVariants,
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
  resolveAlsoSee: WeaponRefResolver,
  extraAlsoSee: AlsoSeeRef[] = []
): WeaponEntry {
  return (
    buildWeaponFamily(stub, html, resolveAlsoSee, extraAlsoSee) ??
    buildWeaponEntry(stub, html, resolveAlsoSee, extraAlsoSee)
  )
}

function isWeaponFamilyEntry(entry: WeaponEntry): entry is WeaponFamily {
  return 'levelVariants' in entry && 'familyName' in entry
}

function getWeaponEntryName(entry: WeaponEntry): string {
  return isWeaponFamilyEntry(entry) ? entry.familyName : entry.name
}

function getWeaponEntryRefs(entry: WeaponEntry): AlsoSeeRef[] {
  return isWeaponFamilyEntry(entry) ? (entry.shared.alsoSee ?? []) : (entry.alsoSee ?? [])
}

const weaponLookupNameCache = new Map<string, string>()

function normalizeWeaponLookupName(name: string): string {
  const cached = weaponLookupNameCache.get(name)
  if (cached !== undefined) return cached

  const normalized = normalizeWeaponFamilyName(name)
    .toLowerCase()
    .replace(/\s+\((?:all versions|[ivxlcdm]+(?:-[ivxlcdm]+)?|\d+)\)$/i, '')
    .replace(/[^\w\s']+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  weaponLookupNameCache.set(name, normalized)
  return normalized
}

function normalizeWeaponComparableTitle(name: string): string {
  return normalizeWeaponLookupName(name).replace(/^the\s+/i, '')
}

function tokenizeWeaponName(name: string): string[] {
  return normalizeWeaponLookupName(name).split(' ').filter(Boolean)
}

function getCommonWeaponPrefix(tokensList: string[][]): string[] {
  if (tokensList.length === 0) return []
  const result: string[] = []
  let index = 0

  while (true) {
    const candidate = tokensList[0][index]
    if (!candidate) break
    if (!tokensList.every((tokens) => tokens[index] === candidate)) break
    result.push(candidate)
    index += 1
  }

  return result
}

function getCommonWeaponSuffix(tokensList: string[][]): string[] {
  if (tokensList.length === 0) return []
  const reversed = tokensList.map((tokens) => [...tokens].reverse())
  const result: string[] = []
  let index = 0

  while (true) {
    const candidate = reversed[0][index]
    if (!candidate) break
    if (!reversed.every((tokens) => tokens[index] === candidate)) break
    result.unshift(candidate)
    index += 1
  }

  return result
}

function titleCaseWeaponTokens(tokens: string[]): string {
  return tokens
    .map((token) => token.replace(/\b\w/g, (char) => char.toUpperCase()).replace(/'S\b/g, "'s"))
    .map(normalizeRomanDisplay)
    .join(' ')
}

function normalizeWeaponFamilyName(name: string): string {
  if (name === 'Half Foam Hammer') return 'Half of a Foam Hammer'
  if (/\bKey,\s*The$/i.test(name)) return name.replace(/,\s*The$/i, '').trim()
  return displayTitle(stripVersionSuffix(name))
}

function normalizeWeaponVariantDisplayName(name: string, familyName: string): string {
  if (normalizeWeaponLookupName(name) === normalizeWeaponLookupName(familyName)) return familyName
  if (/\bKey,\s*The$/i.test(name)) return name.replace(/,\s*The$/i, '').trim()
  return name
}

function normalizeWeaponSourceVariantLabel(name: string): string {
  return displayTitle(stripVersionSuffix(name))
}

function getWeaponSharedTitleParts(
  entries: WeaponEntry[],
  options: { allowSingleTokenSuffix?: boolean } = {}
) {
  const tokenSets = entries.map((entry) => tokenizeWeaponName(getWeaponEntryName(entry)))
  const prefix = getCommonWeaponPrefix(tokenSets)
  const suffix = getCommonWeaponSuffix(tokenSets)

  if (prefix.length > 0 && suffix.length > 0) {
    const hasVariantMiddle = tokenSets.some(
      (tokens) => tokens.length > prefix.length + suffix.length
    )
    if (hasVariantMiddle) return { prefix, suffix }
  }
  if (suffix.length >= 2) return { prefix: [] as string[], suffix }
  if (options.allowSingleTokenSuffix && suffix.length === 1) {
    const hasVariantPrefix = tokenSets.some((tokens) => tokens.length > suffix.length)
    if (hasVariantPrefix && !/^(?:base|default)$/i.test(suffix[0])) {
      return { prefix: [] as string[], suffix }
    }
  }
  if (prefix.length >= 2) return { prefix, suffix: [] as string[] }
  return undefined
}

function deriveWeaponCrossPostFamilyName(
  entries: WeaponEntry[],
  options: { allowSingleTokenSuffix?: boolean } = {}
): string {
  const parts = getWeaponSharedTitleParts(entries, options)
  if (!parts) return normalizeWeaponFamilyName(getWeaponEntryName(entries[0]))
  return normalizeWeaponFamilyName(titleCaseWeaponTokens([...parts.prefix, ...parts.suffix]))
}

function deriveWeaponCrossPostVariantName(name: string, familyName: string): string | undefined {
  if (normalizeWeaponLookupName(name) === normalizeWeaponLookupName(familyName)) {
    return '(Base)'
  }

  const nameTokens = tokenizeWeaponName(name)
  const familyTokens = tokenizeWeaponName(familyName)
  const prefix = getCommonWeaponPrefix([nameTokens, familyTokens])
  const suffix = getCommonWeaponSuffix([
    nameTokens.slice(prefix.length),
    familyTokens.slice(prefix.length),
  ])
  const middle = nameTokens.slice(prefix.length, nameTokens.length - suffix.length)
  if (middle.length > 0) return titleCaseWeaponTokens(middle)
  return name === familyName ? undefined : name
}

function sharesWeaponExplicitReference(a: WeaponEntry, b: WeaponEntry): boolean {
  const aName = normalizeWeaponLookupName(getWeaponEntryName(a))
  const bName = normalizeWeaponLookupName(getWeaponEntryName(b))
  const aRefs = new Set(getWeaponEntryRefs(a).map((ref) => normalizeWeaponLookupName(ref.name)))
  const bRefs = new Set(getWeaponEntryRefs(b).map((ref) => normalizeWeaponLookupName(ref.name)))
  return aRefs.has(bName) || bRefs.has(aName)
}

function sharesWeaponMutualExplicitReference(a: WeaponEntry, b: WeaponEntry): boolean {
  const aName = normalizeWeaponLookupName(getWeaponEntryName(a))
  const bName = normalizeWeaponLookupName(getWeaponEntryName(b))
  const aRefs = new Set(getWeaponEntryRefs(a).map((ref) => normalizeWeaponLookupName(ref.name)))
  const bRefs = new Set(getWeaponEntryRefs(b).map((ref) => normalizeWeaponLookupName(ref.name)))
  return aRefs.has(bName) && bRefs.has(aName)
}

function hasWeaponAliasOwnership(a: WeaponEntry, b: WeaponEntry): boolean {
  return (
    (isWeaponFamilyEntry(a) && Boolean(a.aliasSlugs?.includes(b.slug))) ||
    (isWeaponFamilyEntry(b) && Boolean(b.aliasSlugs?.includes(a.slug)))
  )
}

function isFoamHammerFamilyMemberName(name: string): boolean {
  return (
    /\bFoam Hammer(?:\s+\(All Versions\))?$/i.test(name) &&
    !/^Half of a\b/i.test(name) &&
    !/^Foam Rolith's Hammer$/i.test(name)
  )
}

function isFoamHammerConsolidationPair(a: WeaponEntry, b: WeaponEntry): boolean {
  if (a.subtype !== 'scythe' || b.subtype !== 'scythe') return false
  return [a, b].every((entry) => {
    if (isWeaponFamilyEntry(entry)) return entry.familyName === 'Foam Hammer'
    return isFoamHammerFamilyMemberName(entry.name)
  })
}

function canPromoteWeaponCrossPost(a: WeaponEntry, b: WeaponEntry): boolean {
  if (a.type !== b.type || a.subtype !== b.subtype) return false
  if (isWeaponFamilyEntry(a) && isWeaponFamilyEntry(b)) return false
  if (hasWeaponAliasOwnership(a, b)) return true
  if (!sharesWeaponExplicitReference(a, b)) return false
  const standardParts = getWeaponSharedTitleParts([a, b])
  const singleSuffixParts = getWeaponSharedTitleParts([a, b], { allowSingleTokenSuffix: true })
  if (!standardParts && !singleSuffixParts) return false
  if (!standardParts && !sharesWeaponMutualExplicitReference(a, b)) return false

  const aDescription = isWeaponFamilyEntry(a) ? a.shared.description : a.description
  const bDescription = isWeaponFamilyEntry(b) ? b.shared.description : b.description
  const descriptionsAreSame =
    normalizeWeaponLookupName(aDescription) === normalizeWeaponLookupName(bDescription)

  if (isFoamHammerConsolidationPair(a, b)) return true
  if (descriptionsAreSame) return Boolean(standardParts) || Boolean(singleSuffixParts)
  return Boolean(singleSuffixParts && sharesWeaponMutualExplicitReference(a, b))
}

function isSingleTokenSharedFamilyGroup(group: WeaponEntry[]): boolean {
  const parts = getWeaponSharedTitleParts(group, { allowSingleTokenSuffix: true })
  return Boolean(parts && parts.prefix.length + parts.suffix.length === 1)
}

function shouldPromoteDenseSingleTokenExplicitGroup(group: WeaponEntry[]): boolean {
  if (group.length < 3) return false

  const names = new Set(group.map((entry) => normalizeWeaponLookupName(getWeaponEntryName(entry))))
  let internalRefCount = 0
  const entriesWithInternalRefs = new Set<string>()

  for (const entry of group) {
    const entryName = normalizeWeaponLookupName(getWeaponEntryName(entry))
    for (const ref of getWeaponEntryRefs(entry)) {
      if (!names.has(normalizeWeaponLookupName(ref.name))) continue
      internalRefCount += 1
      entriesWithInternalRefs.add(entryName)
    }
  }

  return entriesWithInternalRefs.size === group.length && internalRefCount >= group.length * 2
}

function allWeaponValuesSame<T>(values: T[]): boolean {
  if (values.length <= 1) return true
  const [first, ...rest] = values.map((value) => JSON.stringify(value))
  return rest.every((value) => value === first)
}

function dedupeWeaponLevelVariants(levels: LevelVariant[]): LevelVariant[] {
  const seen = new Set<string>()
  const result: LevelVariant[] = []

  for (const level of levels) {
    const key = [
      level.name,
      level.variantName ?? '',
      level.actualLevel ?? '',
      level.levelDisplay,
      level.sourceUrl ?? '',
      JSON.stringify(level.obtainVariants),
    ].join('|')
    if (seen.has(key)) continue
    seen.add(key)
    result.push(level)
  }

  return result
}

function dedupeWeaponFamilySources(sources: FamilySourceRef[]): FamilySourceRef[] {
  const seen = new Set<string>()
  const result: FamilySourceRef[] = []

  for (const source of sources) {
    const key = [source.url, source.variantLabel ?? source.title].join('|').toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(source)
  }

  return result
}

function buildWeaponFamilyAliasSlugs(
  familyName: string,
  levels: LevelVariant[],
  existingAliases: string[] = []
): string[] {
  const canonicalSlug = weaponSlugForName(familyName)
  return Array.from(
    new Set([
      ...existingAliases,
      ...(levels.length > 1 ? [weaponSlugForName(`${familyName} (All Versions)`)] : []),
      ...levels.map((level) => weaponSlugForName(level.name)),
    ])
  ).filter((slug) => slug && slug !== canonicalSlug)
}

function dedupeWeaponFamilyEntry(family: WeaponFamily): WeaponFamily {
  const levelVariants = dedupeWeaponLevelVariants(family.levelVariants)
  return computeFamilyFlags({
    ...family,
    aliasSlugs: buildWeaponFamilyAliasSlugs(family.familyName, levelVariants, family.aliasSlugs),
    familySources: family.familySources ? dedupeWeaponFamilySources(family.familySources) : [],
    shared: {
      ...family.shared,
      alsoSee: family.shared.alsoSee
        ? Array.from(
            new Map(
              family.shared.alsoSee.map((ref) => [
                `${ref.type}:${ref.slug}:${ref.url ?? ''}`.toLowerCase(),
                ref,
              ])
            ).values()
          )
        : undefined,
    },
    levelVariants,
    hasDA: false,
    hasDC: false,
    hasDM: false,
    hasFree: false,
    hasMerge: false,
  })
}

function mergeSameSlugWeaponFamilies(entries: WeaponEntry[]): WeaponEntry[] {
  const groups = new Map<string, WeaponEntry[]>()
  for (const entry of entries) {
    groups.set(entry.slug, [...(groups.get(entry.slug) ?? []), entry])
  }

  return Array.from(groups.values()).flatMap((group) => {
    const families = group.filter(isWeaponFamilyEntry)
    const standalones = group.filter((entry): entry is Weapon => !isWeaponFamilyEntry(entry))
    if (families.length !== 1 || standalones.length === 0) return group

    const family = dedupeWeaponFamilyEntry(families[0])
    const mergedLevels = dedupeWeaponLevelVariants([
      ...family.levelVariants,
      ...standalones.map((entry) => buildLevelVariantFromWeapon(entry, family.familyName)),
    ]).sort((a, b) => {
      const levelCompare = (a.actualLevel ?? a.levelNumber) - (b.actualLevel ?? b.levelNumber)
      return levelCompare || compareTitles(a.variantName ?? a.name, b.variantName ?? b.name)
    })
    const familySources = dedupeWeaponFamilySources([
      ...(family.familySources ?? []),
      ...standalones.map((entry, index) => ({
        url: entry.forumUrl,
        title: `DF Encyclopedia: ${entry.name}`,
        variantLabel: entry.name,
        isPrimary: family.familySources?.length ? false : index === 0,
      })),
    ])
    const externalRefs = gatherWeaponExternalRefs(
      [family, ...standalones],
      new Set([
        family.slug,
        ...(family.aliasSlugs ?? []),
        ...family.levelVariants.map((level) => weaponSlugForName(level.name)),
        ...standalones.map((entry) => entry.slug),
      ])
    )

    return [
      computeFamilyFlags({
        ...family,
        aliasSlugs: buildWeaponFamilyAliasSlugs(family.familyName, mergedLevels, [
          ...(family.aliasSlugs ?? []),
          ...standalones.map((entry) => entry.slug),
        ]),
        familySources,
        shared: {
          ...family.shared,
          ...(externalRefs.length > 0 ? { alsoSee: externalRefs } : { alsoSee: undefined }),
        },
        levelVariants: mergedLevels,
        hasDA: false,
        hasDC: false,
        hasDM: false,
        hasFree: false,
        hasMerge: false,
      }),
    ]
  })
}

function mergeFoamHammerStandaloneMembers(entries: WeaponEntry[]): WeaponEntry[] {
  const family = entries.find(
    (entry): entry is WeaponFamily =>
      isWeaponFamilyEntry(entry) && entry.familyName === 'Foam Hammer'
  )
  if (!family) return entries

  const standalones = entries.filter(
    (entry): entry is Weapon =>
      !isWeaponFamilyEntry(entry) && isFoamHammerFamilyMemberName(entry.name)
  )
  if (standalones.length === 0) return entries

  const mergedLevels = dedupeWeaponLevelVariants([
    ...family.levelVariants,
    ...standalones.map((entry) => buildLevelVariantFromWeapon(entry, family.familyName)),
  ]).sort((a, b) => {
    const levelCompare = (a.actualLevel ?? a.levelNumber) - (b.actualLevel ?? b.levelNumber)
    return levelCompare || compareTitles(a.variantName ?? a.name, b.variantName ?? b.name)
  })
  const familySources = dedupeWeaponFamilySources([
    ...(family.familySources ?? []),
    ...standalones.map((entry, index) => ({
      url: entry.forumUrl,
      title: `DF Encyclopedia: ${entry.name}`,
      variantLabel: entry.name,
      isPrimary: family.familySources?.length ? false : index === 0,
    })),
  ])
  const externalRefs = gatherWeaponExternalRefs(
    [family, ...standalones],
    new Set([
      family.slug,
      ...(family.aliasSlugs ?? []),
      ...mergedLevels.map((level) => weaponSlugForName(level.name)),
      ...standalones.map((entry) => entry.slug),
    ])
  )
  const mergedFamily = computeFamilyFlags({
    ...family,
    aliasSlugs: buildWeaponFamilyAliasSlugs(family.familyName, mergedLevels, [
      ...(family.aliasSlugs ?? []),
      ...standalones.map((entry) => entry.slug),
    ]),
    familySources,
    shared: {
      ...family.shared,
      ...(externalRefs.length > 0 ? { alsoSee: externalRefs } : { alsoSee: undefined }),
    },
    levelVariants: mergedLevels,
    hasDA: false,
    hasDC: false,
    hasDM: false,
    hasFree: false,
    hasMerge: false,
  })

  const standaloneSlugs = new Set(standalones.map((entry) => entry.slug))
  return entries
    .map((entry) => (entry.slug === family.slug ? mergedFamily : entry))
    .filter((entry) => isWeaponFamilyEntry(entry) || !standaloneSlugs.has(entry.slug))
}

function splitFoamRolithStandaloneEntry(entries: WeaponEntry[]): WeaponEntry[] {
  const family = entries.find(
    (entry): entry is WeaponFamily =>
      isWeaponFamilyEntry(entry) && entry.familyName === 'Foam Hammer'
  )
  if (!family) return entries
  if (entries.some((entry) => entry.slug === 'weapon-foam-rolith-s-hammer')) return entries

  const foamRolithLevels = family.levelVariants.filter((level) =>
    /^Foam Rolith's Hammer$/i.test(level.name)
  )
  if (foamRolithLevels.length === 0) return entries

  const foamRolithLevel = foamRolithLevels[0]
  const foamRolith = buildWeaponFromLevelVariant(foamRolithLevel, family)
  const foamRolithUrls = new Set(foamRolithLevels.map((level) => level.sourceUrl).filter(Boolean))
  const remainingLevels = family.levelVariants.filter(
    (level) => !/^Foam Rolith's Hammer$/i.test(level.name)
  )
  const repairedFamily = computeFamilyFlags({
    ...family,
    aliasSlugs: buildWeaponFamilyAliasSlugs(
      family.familyName,
      remainingLevels,
      (family.aliasSlugs ?? []).filter((slug) => slug !== 'weapon-foam-rolith-s-hammer')
    ),
    familySources: family.familySources
      ? dedupeWeaponFamilySources(
          family.familySources.filter((source) => !foamRolithUrls.has(source.url))
        )
      : [],
    levelVariants: remainingLevels,
  })

  return entries.flatMap((entry) =>
    entry.slug === family.slug ? [repairedFamily, foamRolith] : [entry]
  )
}

function addFoamHammerSiblingRefs(entries: WeaponEntry[]): WeaponEntry[] {
  const clusterSlugs = new Set([
    'weapon-foam-hammer',
    'weapon-half-of-a-foam-hammer',
    'weapon-foam-rolith-s-hammer',
    'weapon-hammer-rolith-s-dress-uniform-default',
    'weapon-rolith-s-hammer-of-protection',
  ])
  const clusterEntries = entries.filter((entry) => clusterSlugs.has(entry.slug))
  if (clusterEntries.length < 2) return entries

  const refForEntry = (entry: WeaponEntry): AlsoSeeRef => ({
    name: isWeaponFamilyEntry(entry) ? entry.familyName : entry.name,
    slug: entry.slug,
    type: 'weapon',
    url: entry.forumUrl,
  })
  const clusterRefs = clusterEntries.map(refForEntry)
  const addRefs = (entry: WeaponEntry) => {
    const existingRefs = isWeaponFamilyEntry(entry)
      ? (entry.shared.alsoSee ?? [])
      : (entry.alsoSee ?? [])
    const mergedRefs = Array.from(
      new Map(
        [...existingRefs, ...clusterRefs.filter((ref) => ref.slug !== entry.slug)].map((ref) => [
          `${ref.type}:${ref.slug}`.toLowerCase(),
          ref,
        ])
      ).values()
    ).sort((a, b) => compareTitles(a.name, b.name))

    if (isWeaponFamilyEntry(entry)) {
      return {
        ...entry,
        shared: {
          ...entry.shared,
          alsoSee: mergedRefs,
        },
      }
    }

    return {
      ...entry,
      alsoSee: mergedRefs,
    }
  }

  return entries.map((entry) => (clusterSlugs.has(entry.slug) ? addRefs(entry) : entry))
}

function buildLevelVariantFromWeapon(weapon: Weapon, familyName: string): LevelVariant {
  const normalizedLevel = normalizeLevel(weapon.level ?? '1')
  const actualLevel =
    weapon.level && /^\d+$/.test(weapon.level.trim())
      ? Number.parseInt(weapon.level.trim(), 10)
      : undefined
  const variantName =
    deriveWeaponCrossPostVariantName(weapon.name, familyName) ??
    (normalizeWeaponLookupName(weapon.name) === normalizeWeaponLookupName(familyName)
      ? '(Base)'
      : undefined)

  return {
    levelNumber: normalizedLevel.number,
    levelDisplay: normalizedLevel.display,
    ...(actualLevel !== undefined ? { actualLevel } : {}),
    ...(variantName ? { variantName } : {}),
    name: weapon.name,
    damage: weapon.damage ?? 'Unknown',
    stats: weapon.stats ?? 'None',
    obtainVariants: weapon.obtainMethods,
    sourceUrl: weapon.forumUrl,
    ...(weapon.description ? { description: weapon.description } : {}),
    ...(weapon.imageUrl ? { imageUrl: weapon.imageUrl } : {}),
    ...(weapon.alternativeImages ? { alternativeImages: weapon.alternativeImages } : {}),
    ...(weapon.elements[0] ? { element: weapon.elements[0] } : {}),
    ...(weapon.resists ? { resists: weapon.resists } : {}),
    ...(weapon.rarity ? { rarity: weapon.rarity } : {}),
    ...(weapon.itemType ? { itemType: weapon.itemType } : {}),
    ...(weapon.notes ? { notes: weapon.notes } : {}),
    ...(weapon.retired ? { retired: true } : {}),
  }
}

function buildWeaponFromLevelVariant(level: LevelVariant, family: WeaponFamily): Weapon {
  const obtainMethods = level.obtainVariants
  const elements = [
    level.element ?? family.shared.element,
    ...family.elements.filter((element) => element !== (level.element ?? family.shared.element)),
  ].filter((value): value is string => Boolean(value))
  const hasDA = obtainMethods.some((method) => method.daRequired)
  const hasDC = obtainMethods.some(obtainVariantHasDC)
  const hasDM = obtainMethods.some((method) => method.dmRequired || method.priceType === 'dm')
  const hasFree = obtainMethods.some((method) => method.priceType === 'free')
  const hasMerge = obtainMethods.some((method) => method.priceType === 'merge')

  return {
    id: weaponSlugForName(level.name),
    name: level.name,
    slug: weaponSlugForName(level.name),
    type: 'weapon',
    subtype: family.subtype,
    description: level.description ?? family.shared.description,
    forumUrl: level.sourceUrl ?? family.forumUrl,
    releaseDate: family.releaseDate ?? '',
    ...((level.imageUrl ?? family.shared.imageUrl)
      ? { imageUrl: level.imageUrl ?? family.shared.imageUrl }
      : {}),
    ...((level.alternativeImages ?? family.shared.alternativeImages)
      ? { alternativeImages: level.alternativeImages ?? family.shared.alternativeImages }
      : {}),
    elements,
    level: String(level.actualLevel ?? level.levelDisplay),
    damage: level.damage,
    stats: level.stats,
    ...((level.resists ?? family.shared.resists)
      ? { resists: level.resists ?? family.shared.resists }
      : {}),
    ...((level.rarity ?? family.shared.rarity)
      ? { rarity: level.rarity ?? family.shared.rarity }
      : {}),
    ...((level.itemType ?? family.itemType) ? { itemType: level.itemType ?? family.itemType } : {}),
    obtainMethods,
    tags: family.tags,
    daRequired: hasDA,
    dcRequired: hasDC,
    dmRequired: hasDM,
    ...(hasFree ? { hasFree: true } : {}),
    ...(hasMerge ? { hasMerge: true } : {}),
    ...(level.notes ? { notes: level.notes } : {}),
    ...(family.shared.alsoSee ? { alsoSee: family.shared.alsoSee } : {}),
    ...(level.retired || family.retired ? { retired: true } : {}),
    ...(family.isTemp ? { isTemp: true } : {}),
    ...(family.isRare ? { isRare: true } : {}),
    ...(family.isSeasonal ? { isSeasonal: true } : {}),
    ...(family.isSpecialOffer ? { isSpecialOffer: true } : {}),
    ...(family.isCosmetic ? { isCosmetic: true } : {}),
    ...(family.hasSpecial ? { hasSpecial: true } : {}),
    ...(family.hasArmorCustomization ? { hasArmorCustomization: true } : {}),
  }
}

function splitInvalidGenericWeaponFamilies(entries: WeaponEntry[]): WeaponEntry[] {
  return entries.flatMap((entry): WeaponEntry[] => {
    if (!isWeaponFamilyEntry(entry)) return [entry]
    if (!/^(?:base|default)$/i.test(entry.familyName)) return [entry]
    return entry.levelVariants.map((level) => buildWeaponFromLevelVariant(level, entry))
  })
}

function gatherWeaponExternalRefs(items: WeaponEntry[], internalSlugs: Set<string>): AlsoSeeRef[] {
  const refs = new Map<string, AlsoSeeRef>()

  for (const item of items) {
    for (const ref of getWeaponEntryRefs(item)) {
      if (internalSlugs.has(ref.slug)) continue
      refs.set(`${ref.type}:${ref.slug}:${ref.url ?? ''}`, ref)
    }
  }

  return Array.from(refs.values()).sort((a, b) => compareTitles(a.name, b.name))
}

function getSpecialWeaponVariantName(name: string, familyName: string): string | undefined {
  if (familyName === 'Orchidea') {
    return name.replace(/\s+Orchidea$/i, '') || '(Base)'
  }
  if (familyName === 'Half Orchidea') {
    return name.replace(/^Half[-\s]*/i, '').replace(/\s+Orchidea$/i, '') || '(Base)'
  }
  if (familyName === 'Half of a Foam Hammer') {
    const stripped = name
      .replace(/^Half of a\s+/i, '')
      .replace(/\s+Foam Hammer$/i, '')
      .trim()
    return !stripped || stripped === 'Foam Hammer' ? '(Base)' : stripped
  }
  if (familyName === 'Foam Hammer') {
    if (/^Foam Hammer(?:\s+\(|$)/i.test(name)) return '(Base)'
    return name.replace(/\s+Foam Hammer$/i, '') || '(Base)'
  }
  if (familyName === "Rolith's Hammer") {
    if (/Dress Uniform Default/i.test(name)) return 'Dress Uniform Default'
    if (/Protection/i.test(name)) return 'Protection'
  }
  return undefined
}

function getSpecialWeaponLevelVariantName(
  level: LevelVariant,
  familyName: string
): string | undefined {
  if (familyName === 'Eternal Drumstick') {
    const messageId = level.sourceUrl ? getMessageIdFromForumUrl(level.sourceUrl) : undefined
    const sizeByMessageId: Record<string, string> = {
      '22424948': '(Base)',
      '22424949': '(L)',
      '22424950': '(XL)',
    }
    const size = messageId ? sizeByMessageId[messageId] : undefined
    if (!size) return undefined
    return level.obtainVariants.some(obtainVariantHasDC) ? `${size} (DC)` : size
  }

  return getSpecialWeaponVariantName(level.name, familyName)
}

function getWeaponFamilySourceVariantLabel(level: LevelVariant, familyName: string): string {
  if (familyName === 'Eternal Drumstick') {
    const baseVariant = level.variantName?.replace(/\s+\(DC\)$/i, '').trim()
    if (baseVariant === '(L)' || baseVariant === '(XL)') {
      return `${familyName} ${baseVariant}`
    }
    return familyName
  }

  return level.variantName === '(Base)'
    ? `The ${familyName}`
    : level.variantName &&
        normalizeWeaponComparableTitle(level.name) === normalizeWeaponComparableTitle(familyName)
      ? `${familyName} ${level.variantName}`
      : normalizeWeaponSourceVariantLabel(level.name)
}

function getSourceTitleVariantName(
  sourceTitle: string | undefined,
  familyName: string
): string | undefined {
  if (!sourceTitle) return undefined
  const title = sourceTitle.replace(/^DF Encyclopedia:\s*/i, '').trim()
  const match = title.match(/\(([^)]+)\)\s*$/)
  if (!match) return undefined
  const titleBase = stripVersionSuffix(title.replace(/\s+\([^)]+\)\s*$/, '').trim())
  if (normalizeWeaponComparableTitle(titleBase) !== normalizeWeaponComparableTitle(familyName)) {
    return undefined
  }
  const value = match[1]?.trim()
  if (!value || /^All Versions$/i.test(value)) return undefined
  return `(${normalizeRomanDisplay(value)})`
}

function normalizeRedundantBaseVariantNames(levels: LevelVariant[]): LevelVariant[] {
  if (levels.length <= 1) return levels
  if (!levels.every((level) => level.variantName === '(Base)')) return levels
  const levelKeys = new Set(levels.map((level) => String(level.actualLevel ?? level.levelDisplay)))
  if (levelKeys.size !== levels.length) return levels

  return levels.map((level) => {
    const { variantName: _variantName, ...rest } = level
    return rest
  })
}

function buildWeaponCrossPostFamily(
  group: WeaponEntry[],
  familyNameOverride?: string
): WeaponFamily {
  const sorted = [...group].sort((a, b) =>
    compareTitles(getWeaponEntryName(a), getWeaponEntryName(b))
  )
  const familyAnchor = sorted.find(isWeaponFamilyEntry)
  const familyName =
    familyNameOverride ??
    deriveWeaponCrossPostFamilyName(sorted, {
      allowSingleTokenSuffix: isSingleTokenSharedFamilyGroup(sorted),
    })
  const familySlug = familyAnchor?.slug ?? weaponSlugForName(familyName)
  const internalSlugs = new Set(sorted.map((entry) => entry.slug))
  const levelVariants = dedupeWeaponLevelVariants(
    sorted.flatMap((entry) =>
      isWeaponFamilyEntry(entry)
        ? entry.levelVariants.map((variant) => ({
            ...variant,
            variantName:
              getSpecialWeaponLevelVariantName(variant, familyName) ?? variant.variantName,
            sourceUrl: variant.sourceUrl ?? entry.forumUrl,
          }))
        : (() => {
            const variant = buildLevelVariantFromWeapon(entry, familyName)
            return [
              {
                ...variant,
                variantName:
                  getSpecialWeaponVariantName(getWeaponEntryName(entry), familyName) ??
                  variant.variantName,
              },
            ]
          })()
    )
  ).sort((a, b) => {
    const levelCompare = (a.actualLevel ?? a.levelNumber) - (b.actualLevel ?? b.levelNumber)
    return levelCompare || compareTitles(a.variantName ?? a.name, b.variantName ?? b.name)
  })
  const descriptions = levelVariants
    .map((variant) => variant.description)
    .filter((value): value is string => Boolean(value))
  const imageUrls = levelVariants
    .map((variant) => variant.imageUrl)
    .filter((value): value is string => Boolean(value))
  const alternativeImages = levelVariants
    .map((variant) => variant.alternativeImages)
    .filter((value): value is NonNullable<LevelVariant['alternativeImages']> =>
      Boolean(value?.length)
    )
  const elements = Array.from(
    new Set(
      levelVariants
        .map((variant) => variant.element)
        .filter((value): value is string => Boolean(value))
    )
  )
  const resists = levelVariants
    .map((variant) => variant.resists)
    .filter((value): value is string => Boolean(value))
  const rarities = levelVariants
    .map((variant) => variant.rarity)
    .filter((value): value is string => Boolean(value))
  const itemTypes = Array.from(
    new Set(
      levelVariants
        .map((variant) => variant.itemType)
        .filter((value): value is string => Boolean(value))
    )
  )
  const notes = levelVariants
    .map((variant) => variant.notes)
    .filter((value): value is string => Boolean(value))
  const specials = sorted
    .map((entry) => (isWeaponFamilyEntry(entry) ? entry.shared.weaponSpecial : entry.weaponSpecial))
    .filter((value): value is WeaponSpecial => Boolean(value))
  const armorCustomizations = sorted
    .map((entry) =>
      isWeaponFamilyEntry(entry) ? entry.shared.armorCustomization : entry.armorCustomization
    )
    .filter((value): value is NonNullable<WeaponFamily['shared']['armorCustomization']> =>
      Boolean(value)
    )
  const familySources: FamilySourceRef[] = dedupeWeaponFamilySources(
    sorted.flatMap((entry, index) =>
      isWeaponFamilyEntry(entry) && entry.familySources?.length
        ? entry.familySources
        : [
            {
              url: entry.forumUrl,
              title: `DF Encyclopedia: ${getWeaponEntryName(entry)}`,
              variantLabel: getWeaponEntryName(entry),
              isPrimary: index === 0,
            },
          ]
    )
  )
  const externalRefs = gatherWeaponExternalRefs(sorted, internalSlugs)

  return computeFamilyFlags({
    id: familySlug,
    familyName,
    slug: familySlug,
    aliasSlugs: Array.from(internalSlugs).filter((slug) => slug !== familySlug),
    type: 'weapon',
    subtype: sorted[0].subtype,
    forumUrl: familyAnchor?.forumUrl ?? sorted[0].forumUrl,
    familyOrigin: 'cross-post',
    familySources,
    ...(itemTypes.length === 1 ? { itemType: itemTypes[0] } : {}),
    shared: {
      description:
        descriptions.length > 0 && allWeaponValuesSame(descriptions)
          ? descriptions[0]
          : (descriptions[0] ?? ''),
      ...(imageUrls.length > 0 && allWeaponValuesSame(imageUrls) ? { imageUrl: imageUrls[0] } : {}),
      ...(alternativeImages.length > 0 && allWeaponValuesSame(alternativeImages)
        ? { alternativeImages: alternativeImages[0] }
        : {}),
      ...(elements.length === 1 ? { element: elements[0] } : {}),
      ...(resists.length > 0 && allWeaponValuesSame(resists) ? { resists: resists[0] } : {}),
      ...(rarities.length > 0 && allWeaponValuesSame(rarities) ? { rarity: rarities[0] } : {}),
      ...(notes.length > 0 && allWeaponValuesSame(notes) ? { notes: notes[0] } : {}),
      ...(specials.length > 0 && allWeaponValuesSame(specials)
        ? { weaponSpecial: specials[0] }
        : {}),
      ...(armorCustomizations.length > 0 && allWeaponValuesSame(armorCustomizations)
        ? { armorCustomization: armorCustomizations[0] }
        : {}),
      ...(externalRefs.length > 0 ? { alsoSee: externalRefs } : {}),
    },
    levelVariants,
    category: 'Weapon',
    releaseDate: '',
    tags: Array.from(
      new Set([
        ...sorted.flatMap((entry) => entry.tags ?? []),
        ...levelVariants.flatMap((variant) =>
          variant.obtainVariants.map((method) => method.priceType)
        ),
      ])
    ).sort(),
    hasDA: false,
    hasDC: false,
    hasDM: false,
    hasFree: false,
    hasMerge: false,
    elements,
    hasSpecial: specials.length > 0 || undefined,
    hasArmorCustomization: armorCustomizations.length > 0 || undefined,
    isCosmetic: sorted.some((entry) => entry.isCosmetic) || undefined,
    isTemp: sorted.some((entry) => entry.isTemp) || undefined,
    isRare: sorted.some((entry) => entry.isRare) || undefined,
    isSeasonal: sorted.some((entry) => entry.isSeasonal) || undefined,
    isSpecialOffer: sorted.some((entry) => entry.isSpecialOffer) || undefined,
    retired: sorted.some((entry) => entry.retired) || undefined,
    levelRange: '',
  })
}

function splitSpecialWeaponGroup(
  group: WeaponEntry[]
): Array<{ familyName?: string; entries: WeaponEntry[] }> {
  const names = group.map(getWeaponEntryName)
  const hasAny = (pattern: RegExp) => names.some((name) => pattern.test(name))

  if (hasAny(/\bOrchidea$/i)) {
    const normal = group.filter((entry) => !/^Half[-\s]/i.test(getWeaponEntryName(entry)))
    const half = group.filter((entry) => /^Half[-\s]/i.test(getWeaponEntryName(entry)))
    return [
      ...(normal.length > 0 ? [{ familyName: 'Orchidea', entries: normal }] : []),
      ...(half.length > 0 ? [{ familyName: 'Half Orchidea', entries: half }] : []),
    ]
  }

  if (hasAny(/\bFoam Hammer\b/i) || hasAny(/\bRolith's Hammer\b/i)) {
    const half = group.filter((entry) => /^Half of a\b/i.test(getWeaponEntryName(entry)))
    const rolith = group.filter((entry) =>
      /^(?:Hammer \(Rolith's Dress Uniform Default\)|Rolith's Hammer of Protection)/i.test(
        getWeaponEntryName(entry)
      )
    )
    const foam = group.filter((entry) => {
      const name = getWeaponEntryName(entry)
      return (
        !/^Half of a\b/i.test(name) &&
        !/^(?:Hammer \(Rolith's Dress Uniform Default\)|Rolith's Hammer of Protection)/i.test(name)
      )
    })
    return [
      ...(foam.length > 0 ? [{ familyName: 'Foam Hammer', entries: foam }] : []),
      ...(half.length > 0 ? [{ familyName: 'Half of a Foam Hammer', entries: half }] : []),
      ...(rolith.length > 0 ? [{ familyName: "Rolith's Hammer", entries: rolith }] : []),
    ]
  }

  return [{ entries: group }]
}

function cloneWeaponFamilyWithLevels(
  family: WeaponFamily,
  familyName: string,
  levels: LevelVariant[]
): WeaponFamily {
  const slug = weaponSlugForName(familyName)
  const adjustedLevels = levels.map((level) => ({
    ...level,
    variantName: getSpecialWeaponLevelVariantName(level, familyName) ?? level.variantName,
  }))
  const elements = Array.from(
    new Set(
      adjustedLevels
        .map((level) => level.element)
        .filter((value): value is string => Boolean(value))
    )
  )
  const refs = (family.shared.alsoSee ?? []).filter(
    (ref) => !adjustedLevels.some((level) => weaponSlugForName(level.name) === ref.slug)
  )

  return computeFamilyFlags({
    ...family,
    id: slug,
    familyName,
    slug,
    aliasSlugs: adjustedLevels.map((level) => weaponSlugForName(level.name)),
    forumUrl: adjustedLevels[0]?.sourceUrl ?? family.forumUrl,
    familySources: adjustedLevels.map((level, index) => ({
      url: level.sourceUrl ?? family.forumUrl,
      title: `DF Encyclopedia: ${level.name}`,
      variantLabel: level.name,
      isPrimary: index === 0,
    })),
    shared: {
      ...family.shared,
      ...(refs.length > 0 ? { alsoSee: refs } : { alsoSee: undefined }),
      ...(() => {
        const imageUrls = adjustedLevels
          .map((level) => level.imageUrl)
          .filter((value): value is string => Boolean(value))
        return imageUrls.length > 0 && allWeaponValuesSame(imageUrls)
          ? { imageUrl: imageUrls[0] }
          : { imageUrl: undefined }
      })(),
    },
    levelVariants: adjustedLevels,
    elements,
    hasDA: false,
    hasDC: false,
    hasDM: false,
    hasFree: false,
    hasMerge: false,
  })
}

function splitExistingSpecialWeaponFamilies(entries: WeaponEntry[]): WeaponEntry[] {
  return entries.flatMap<WeaponEntry>((entry) => {
    if (!isWeaponFamilyEntry(entry)) return [entry]
    const normalizedEntry = dedupeWeaponFamilyEntry(entry)

    if (normalizedEntry.levelVariants.some((level) => /\bOrchidea$/i.test(level.name))) {
      const normal = normalizedEntry.levelVariants.filter(
        (level) => !/^Half[-\s]/i.test(level.name)
      )
      const half = normalizedEntry.levelVariants.filter((level) => /^Half[-\s]/i.test(level.name))
      if (normal.length > 0 && half.length > 0) {
        return [
          cloneWeaponFamilyWithLevels(normalizedEntry, 'Orchidea', normal),
          cloneWeaponFamilyWithLevels(normalizedEntry, 'Half Orchidea', half),
        ]
      }
    }

    if (normalizedEntry.levelVariants.some((level) => /\bFoam Hammer\b/i.test(level.name))) {
      const half = normalizedEntry.levelVariants.filter((level) => /^Half of a\b/i.test(level.name))
      const rolith = normalizedEntry.levelVariants.filter((level) =>
        /^(?:Hammer \(Rolith's Dress Uniform Default\)|Rolith's Hammer of Protection)/i.test(
          level.name
        )
      )
      const foam = normalizedEntry.levelVariants.filter(
        (level) =>
          !/^Half of a\b/i.test(level.name) &&
          !/^(?:Hammer \(Rolith's Dress Uniform Default\)|Rolith's Hammer of Protection)/i.test(
            level.name
          )
      )
      if ([foam, half, rolith].filter((group) => group.length > 0).length > 1) {
        return [
          ...(foam.length > 0
            ? [cloneWeaponFamilyWithLevels(normalizedEntry, 'Foam Hammer', foam)]
            : []),
          ...(half.length > 0
            ? [cloneWeaponFamilyWithLevels(normalizedEntry, 'Half of a Foam Hammer', half)]
            : []),
          ...(rolith.length > 0
            ? [cloneWeaponFamilyWithLevels(normalizedEntry, "Rolith's Hammer", rolith)]
            : []),
        ]
      }
    }

    return [normalizedEntry]
  })
}

export function promoteWeaponCrossPostFamilies(entries: WeaponEntry[]): WeaponEntry[] {
  entries = splitInvalidGenericWeaponFamilies(entries)
  entries = splitExistingSpecialWeaponFamilies(entries)
  const visited = new Set<string>()
  const groups: WeaponEntry[][] = []

  for (const entry of entries) {
    if (visited.has(entry.slug)) continue
    const queue = [entry]
    const group: WeaponEntry[] = []

    while (queue.length > 0) {
      const current = queue.shift()!
      if (visited.has(current.slug)) continue
      visited.add(current.slug)
      group.push(current)

      for (const candidate of entries) {
        if (visited.has(candidate.slug) || candidate.slug === current.slug) continue
        if (!canPromoteWeaponCrossPost(current, candidate)) continue
        queue.push(candidate)
      }
    }

    groups.push(group)
  }

  return groups.flatMap((group) => {
    const hasStandalone = group.some((entry) => !isWeaponFamilyEntry(entry))
    const familyCount = group.filter(isWeaponFamilyEntry).length
    if (group.length <= 1 || !hasStandalone || familyCount > 1) return group
    if (
      isSingleTokenSharedFamilyGroup(group) &&
      !shouldPromoteDenseSingleTokenExplicitGroup(group)
    ) {
      return group
    }
    return splitSpecialWeaponGroup(group).flatMap(({ familyName, entries }) =>
      entries.length > 1 ? [buildWeaponCrossPostFamily(entries, familyName)] : entries
    )
  })
}

async function fetchPostContent(messageId: string, cookie: string): Promise<string> {
  return `<!-- source-url:${directForumPostUrl(messageId)} -->\n${getAllPostContent(
    await withRetry(`printable ${messageId}`, () => fetchPrintable(messageId, cookie))
  )}`
}

async function fetchThreadPostContent(messageId: string, cookie: string): Promise<string> {
  const threadHtml = await withRetry(`thread ${messageId}`, () =>
    fetchThreadPages(messageId, cookie)
  )
  const posts = extractThreadPostContents(threadHtml)
  if (posts.length === 0) throw new Error(`Could not find thread posts for ${messageId}`)
  return posts
    .map((post) => `<!-- source-url:${post.sourceUrl} -->\n${post.html}`)
    .join('\n<hr data-post-break="true">\n')
}

async function fetchStubContent(
  stub: WeaponStub,
  cookie: string,
  preferThread = false
): Promise<string> {
  if (preferThread) {
    try {
      return await fetchThreadPostContent(stub.messageId, cookie)
    } catch {
      // Fall back to the direct printable post below; some old entries do not
      // expose a complete thread page even when their printable post works.
    }
  }

  try {
    return await fetchPostContent(stub.messageId, cookie)
  } catch (error) {
    if (!isPostUnavailableError(error) || !/\bfb\.asp\?/i.test(stub.forumUrl)) throw error
    return fetchThreadPostContent(stub.messageId, cookie)
  }
}

function entryMatchesSelectedLetters(entry: WeaponEntry, selectedLetters?: string[]): boolean {
  if (!selectedLetters || selectedLetters.length === 0) return false
  const name = 'familyName' in entry ? entry.familyName : entry.name
  return selectedLetters.includes(getInitialForName(name))
}

function familyOwnsIncomingAlias(entry: WeaponEntry, incomingSlugs: Set<string>): boolean {
  return (
    isWeaponFamilyEntry(entry) && entry.aliasSlugs?.some((slug) => incomingSlugs.has(slug)) === true
  )
}

function readExistingEntries(file: string): WeaponEntry[] {
  const filePath = path.resolve(OUTPUT_DIR, file)
  if (!fs.existsSync(filePath)) return []
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as WeaponEntry[]
}

export function canonicalizeWeaponAlsoSeeRefs(entries: WeaponEntry[]): WeaponEntry[] {
  const aliasToCanonical = new Map<string, { slug: string; name: string }>()
  for (const entry of entries) {
    if (!('aliasSlugs' in entry) || !entry.aliasSlugs?.length) continue
    for (const aliasSlug of entry.aliasSlugs) {
      aliasToCanonical.set(aliasSlug, { slug: entry.slug, name: entry.familyName })
    }
  }

  const dedupeRefs = (refs?: AlsoSeeRef[]) => {
    const rewritten = refs?.map((ref) => {
      const canonical = aliasToCanonical.get(ref.slug)
      return canonical ? { ...ref, slug: canonical.slug, name: canonical.name } : ref
    })
    if (!rewritten) return undefined

    return Array.from(
      new Map(rewritten.map((ref) => [`${ref.type}:${ref.slug}`.toLowerCase(), ref])).values()
    )
  }

  return entries.map((entry) => {
    if ('levelVariants' in entry) {
      return {
        ...entry,
        shared: {
          ...entry.shared,
          alsoSee: dedupeRefs(entry.shared.alsoSee)?.filter((ref) => ref.slug !== entry.slug),
        },
      }
    }

    return {
      ...entry,
      alsoSee: dedupeRefs(entry.alsoSee)?.filter((ref) => ref.slug !== entry.slug),
    }
  })
}

export function normalizeWeaponFamilyDisplayLabels(entries: WeaponEntry[]): WeaponEntry[] {
  return entries.map((entry) => {
    if (!isWeaponFamilyEntry(entry)) return entry

    const familyName = normalizeWeaponFamilyName(entry.familyName)
    const sourceByUrl = new Map((entry.familySources ?? []).map((source) => [source.url, source]))
    const sourceVariantByUrl = new Map(
      (entry.familySources ?? [])
        .map((source) => [
          source.url,
          getSourceTitleVariantName(source.title, familyName) ??
            getSourceTitleVariantName(source.variantLabel, familyName),
        ])
        .filter((value): value is [string, string] => Boolean(value[1]))
    )
    const hasSourceTitleVariants = sourceVariantByUrl.size > 0
    const levelVariants = normalizeRedundantBaseVariantNames(
      dedupeWeaponLevelVariants(
        entry.levelVariants.map((level) => {
          const name = normalizeWeaponVariantDisplayName(level.name, familyName)
          const sourceVariantName = level.sourceUrl
            ? sourceVariantByUrl.get(level.sourceUrl)
            : undefined
          const exactSourceTitle =
            level.sourceUrl && sourceByUrl.has(level.sourceUrl)
              ? stripVersionSuffix(
                  (sourceByUrl.get(level.sourceUrl)?.title ?? '')
                    .replace(/^DF Encyclopedia:\s*/i, '')
                    .trim()
                )
              : undefined
          const isExactSourceFamily =
            exactSourceTitle !== undefined &&
            normalizeWeaponComparableTitle(exactSourceTitle) ===
              normalizeWeaponComparableTitle(familyName)
          return {
            ...level,
            name,
            variantName:
              sourceVariantName ??
              (hasSourceTitleVariants && isExactSourceFamily ? '(Base)' : undefined) ??
              getSpecialWeaponLevelVariantName({ ...level, name }, familyName) ??
              deriveWeaponCrossPostVariantName(name, familyName) ??
              level.variantName,
          }
        })
      )
    )
    const sourceLabelByUrl = new Map(
      levelVariants
        .filter((level) => level.sourceUrl)
        .map((level) => [level.sourceUrl!, getWeaponFamilySourceVariantLabel(level, familyName)])
    )
    return {
      ...entry,
      id: entry.id === entry.slug ? weaponSlugForName(familyName) : entry.id,
      familyName,
      slug: weaponSlugForName(familyName),
      aliasSlugs: buildWeaponFamilyAliasSlugs(
        familyName,
        [...entry.levelVariants, ...levelVariants],
        [...(entry.aliasSlugs ?? []), entry.slug]
      ),
      familySources: entry.familySources
        ? dedupeWeaponFamilySources(
            entry.familySources.map((source) => {
              const sourceVariantLabel =
                sourceLabelByUrl.get(source.url) ??
                (source.variantLabel
                  ? normalizeWeaponSourceVariantLabel(source.variantLabel)
                  : undefined)
              return {
                ...source,
                ...(sourceVariantLabel ? { variantLabel: sourceVariantLabel } : {}),
              }
            })
          )
        : undefined,
      levelVariants,
    }
  })
}

export function removeWeaponAliasStandaloneEntries(entries: WeaponEntry[]): WeaponEntry[] {
  const aliasSlugs = new Set(
    entries
      .filter(isWeaponFamilyEntry)
      .flatMap((entry) => entry.aliasSlugs ?? [])
      .filter(Boolean)
  )

  if (aliasSlugs.size === 0) return entries

  return entries.filter((entry) => isWeaponFamilyEntry(entry) || !aliasSlugs.has(entry.slug))
}

function dedupeWeaponEntriesBySlug(entries: WeaponEntry[]): WeaponEntry[] {
  const bySlug = new Map<string, WeaponEntry>()

  for (const entry of entries) {
    const existing = bySlug.get(entry.slug)
    if (!existing) {
      bySlug.set(entry.slug, entry)
      continue
    }

    if (isWeaponFamilyEntry(existing) && isWeaponFamilyEntry(entry)) {
      bySlug.set(
        entry.slug,
        dedupeWeaponFamilyEntry({
          ...existing,
          aliasSlugs: Array.from(
            new Set([...(existing.aliasSlugs ?? []), ...(entry.aliasSlugs ?? [])])
          ),
          familySources: dedupeWeaponFamilySources([
            ...(existing.familySources ?? []),
            ...(entry.familySources ?? []),
          ]),
          shared: {
            ...existing.shared,
            alsoSee: [...(existing.shared.alsoSee ?? []), ...(entry.shared.alsoSee ?? [])],
          },
          levelVariants: dedupeWeaponLevelVariants([
            ...existing.levelVariants,
            ...entry.levelVariants,
          ]),
        })
      )
      continue
    }

    if (!isWeaponFamilyEntry(existing) && isWeaponFamilyEntry(entry)) {
      bySlug.set(entry.slug, entry)
    }
  }

  return Array.from(bySlug.values())
}

function writeDatasets(
  entriesBySubtype: Map<WeaponSubtype, WeaponEntry[]>,
  selectedSubtypes: WeaponSubtype[],
  selectedLetters?: string[],
  selectedNames?: string[],
  selectedMessageIds?: Set<string>
) {
  for (const subtype of selectedSubtypes) {
    const incoming = entriesBySubtype.get(subtype) ?? []
    const files = WEAPON_DATA_FILES[subtype]
    const existingByFile = new Map(files.map((file) => [file, readExistingEntries(file)]))
    const existing = Array.from(existingByFile.values()).flat()
    const incomingSlugs = new Set(incoming.map((entry) => entry.slug))
    const preserved = existing.filter((entry) => {
      const displayName = 'familyName' in entry ? entry.familyName : entry.name
      if (familyOwnsIncomingAlias(entry, incomingSlugs)) return true
      if (incomingSlugs.has(entry.slug)) {
        const incomingSameSlug = incoming.filter(
          (incomingEntry) => incomingEntry.slug === entry.slug
        )
        if (shouldPreserveFamilyForSameSlugIncoming(entry, incomingSameSlug, isWeaponFamilyEntry)) {
          return true
        }
        return false
      }
      const entryMessageId = getMessageIdFromForumUrl(entry.forumUrl)
      if (entryMessageId && selectedMessageIds?.has(entryMessageId)) return false
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
    const merged = removeWeaponAliasStandaloneEntries(
      addFoamHammerSiblingRefs(
        canonicalizeWeaponAlsoSeeRefs(
          dedupeWeaponEntriesBySlug(
            splitFoamRolithStandaloneEntry(
              normalizeWeaponFamilyDisplayLabels(
                mergeFoamHammerStandaloneMembers(
                  promoteWeaponCrossPostFamilies(
                    mergeSameSlugWeaponFamilies([...preserved, ...incoming])
                  )
                )
              )
            )
          )
        )
      )
    ).sort((a, b) =>
      compareTitles(
        'familyName' in a ? a.familyName : a.name,
        'familyName' in b ? b.familyName : b.name
      )
    )

    for (const file of files) {
      const entriesForFile = merged.filter((entry) => dataFileForEntry(entry) === file)
      fs.writeFileSync(
        path.resolve(OUTPUT_DIR, file),
        `${JSON.stringify(entriesForFile, null, 2)}\n`
      )
      console.log(`Wrote ${entriesForFile.length} entries to ${file}`)
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
  const urlArgs = getUrlFilterArgs()
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
  const directMessageIds = new Set<string>()
  if (urlArgs?.length) {
    for (const url of urlArgs) {
      const messageId = getMessageIdFromForumUrl(url)
      if (!messageId) {
        console.warn(`⚠️  Skipping direct weapon URL without message id: ${url}`)
        continue
      }
      directMessageIds.add(messageId)
      const html = await fetchPostContent(messageId, cookie)
      const title = getWeaponTitleFromHtml(html)
      if (!title) {
        console.warn(`⚠️  Skipping direct weapon URL without title block: ${url}`)
        continue
      }
      const subtype = selectedSubtypes.length === 1 ? selectedSubtypes[0] : undefined
      if (!subtype) {
        console.warn(
          `⚠️  Skipping direct weapon URL because exactly one subtype is required: ${url}`
        )
        continue
      }
      if (!allStubs.some((stub) => stub.messageId === messageId && stub.subtype === subtype)) {
        allStubs.push({
          name: title,
          forumUrl: normalizeForumUrl(`tm.asp?m=${messageId}`),
          messageId,
          subtype,
        })
      }
    }
  }
  const crossSubtypeContext = buildCrossSubtypeThreadContext(allStubs)
  const resolveAlsoSee = createWeaponRefResolver(allStubs)
  const scopedStubs = allStubs.filter((stub) => {
    if (!selectedSubtypes.includes(stub.subtype)) return false
    if (directMessageIds.size > 0 && !directMessageIds.has(stub.messageId)) return false
    if (lettersArg && lettersArg.length > 0 && !lettersArg.includes(getInitialForName(stub.name))) {
      return false
    }
    return true
  })
  const namedStubs = applyNameFilter(scopedStubs, nameFilter, (stub) => stub.name)
  if (namedStubs.message) console.log(namedStubs.message)
  const selectedStubs = applyLimit(
    dedupeCrossSubtypeSelectedStubs(namedStubs.entries, crossSubtypeContext),
    limit
  )
  if (selectedStubs.length === 0) {
    console.log('No selected weapons matched; leaving weapon data unchanged.')
    return
  }
  console.log(`Scraping ${selectedStubs.length} weapons with concurrency ${concurrency}`)

  const entriesBySubtype = new Map<WeaponSubtype, WeaponEntry[]>(
    selectedSubtypes.map((subtype) => [subtype, []])
  )
  const parsedMessageIds = new Set<string>()
  const parsedNames: string[] = []
  await processWithConcurrency({
    items: selectedStubs,
    concurrency,
    startDelayMs: DELAY_MS,
    processItem: async (stub) => {
      const scopedContext = crossSubtypeContext
        .get(getWeaponThreadGroupKey(stub))
        ?.get(stub.subtype)
      let html: string
      try {
        html = await fetchStubContent(stub, cookie, true)
      } catch (error) {
        // A deleted/moved forum post returns a hard HTTP 500. Skip it instead of
        // aborting the whole run; re-throw anything else so real errors surface.
        if (isPostUnavailableError(error)) {
          console.warn(`⚠️  Skipping ${stub.name} — forum post unavailable (deleted/moved)`)
          return
        }
        throw error
      }
      const scopedHtml = scopeWeaponHtmlToSubtypeTitles(html, scopedContext?.names)
      const extraAlsoSee = getCrossSubtypeAlsoSeeRefs(stub, crossSubtypeContext)
      const entry = buildWeaponEntryOrFamily(stub, scopedHtml, resolveAlsoSee, extraAlsoSee)
      entriesBySubtype.get(stub.subtype)?.push(entry)
      parsedMessageIds.add(stub.messageId)
      parsedNames.push(...(scopedContext?.names ?? [stub.name]))
      console.log(`✓ ${stub.name}`)
    },
  })

  writeDatasets(
    entriesBySubtype,
    selectedSubtypes,
    lettersArg,
    namesArg && parsedNames.length > 0 ? parsedNames.map(normalizeWeaponTitleKey) : undefined,
    directMessageIds.size > 0 ? parsedMessageIds : undefined
  )
}

if (process.argv[1] && path.basename(process.argv[1]) === 'scrape-weapons.ts') {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
