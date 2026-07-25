import * as fs from 'node:fs'
import * as path from 'node:path'
import elementsData from '../src/data/elements.json' with { type: 'json' }
import type { AlsoSeeRef, ObtainVariant } from '../src/types/item.ts'
import { computePriceType, obtainVariantHasDC } from '../src/utils/variantHelpers.ts'
import { compareTitles, titleSortKey } from '../src/utils/displayText.ts'
import { inferImageCaptionFromUrl } from '../src/utils/imageLabels.ts'
import {
  type Weapon,
  type WeaponEntry,
  type WeaponSubtype,
  WEAPON_SUBTYPES,
} from '../src/types/weapon.ts'
import { extractAlsoSeeRefs, type ParsedAlsoSeeRef } from './lib/also-see.ts'
import { writeWeaponManifest } from './lib/data-manifests.ts'
import { FORUM_BASE, fetchForumPage as fetchPage, loadForumCookie, withRetry } from './lib/forum.ts'
import { getImageCaptionNoise, isImageCaptionNoiseLine } from './lib/note-cleaning.ts'
import { rephraseTimedSellback } from './lib/obtain-formatting.ts'
import { fetchPrintable, getPostContent } from './lib/printable-parser.ts'
import { applyLimit, getArg, getConcurrencyArg, getLimitArg } from './lib/scraper-cli.ts'
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
  const otherInfoHtml = findOtherInformationSection(html)
  if (!otherInfoHtml) return undefined
  const imageCaptionNoise = getImageCaptionNoise(otherInfoHtml)
  const trimmedSection = otherInfoHtml
    .split(/<i>Thanks to|Also See:|<font color='#eeeeee'>/i)[0]
    .replace(
      /<a[^>]+href=(["'])([^"']*?\.(?:png|jpg|jpeg|gif|bmp)(?:\?[^"']*)?)\1[^>]*>[\s\S]*?<\/a>/gi,
      ''
    )
    .replace(/<img[^>]+src="[^"]+\.(?:png|jpg|jpeg|gif|bmp)"[^>]*>/gi, '')
    .replace(/https?:\/\/[^\s"'<>]+\.(?:png|jpg|jpeg|gif|bmp)(?:\?[^\s"'<>]*)?/gi, '')
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
    noteLines.push(trimmed.replace(/^[•*-]\s*/, ''))
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
  const otherInfoHtml = findOtherInformationSection(html)
  const scanHtml = otherInfoHtml ? `${otherInfoHtml}\n${html}` : html
  const imageCandidates: Array<{ url: string; caption?: string }> = [
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
  const displayImageCandidates = [
    ...new Map(imageCandidates.map((candidate) => [candidate.url, candidate])).values(),
  ]
  const imageUrl = displayImageCandidates[0]?.url
  const alternativeImages = imageUrl
    ? displayImageCandidates
        .filter((candidate) => candidate.url !== imageUrl)
        .map((candidate, index) => ({
          url: candidate.url,
          caption:
            candidate.caption?.trim() ??
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
    ...(isCosmetic ? { isCosmetic: true } : {}),
    ...(flags.isRare ? { isRare: true } : {}),
    ...(flags.isSeasonal ? { isSeasonal: true } : {}),
    ...(flags.isSpecialOffer ? { isSpecialOffer: true } : {}),
    ...(flags.retired ? { retired: true } : {}),
  }
}

async function fetchPostContent(messageId: string, cookie: string): Promise<string> {
  return getPostContent(
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

function writeDatasets(
  entriesBySubtype: Map<WeaponSubtype, WeaponEntry[]>,
  selectedSubtypes: WeaponSubtype[],
  selectedLetters?: string[]
) {
  for (const subtype of selectedSubtypes) {
    const incoming = entriesBySubtype.get(subtype) ?? []
    for (const file of WEAPON_DATA_FILES[subtype]) {
      const existing = readExistingEntries(file)
      const incomingForFile = incoming.filter((entry) => dataFileForEntry(entry) === file)
      const incomingSlugs = new Set(incomingForFile.map((entry) => entry.slug))
      const preserved = existing.filter((entry) => {
        if (incomingSlugs.has(entry.slug)) return false
        if (entryMatchesSelectedLetters(entry, selectedLetters)) return false
        return true
      })
      const merged = [...preserved, ...incomingForFile].sort((a, b) =>
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
  const namesArg = getArg('names')
    ?.split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
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
  const selectedStubs = applyLimit(
    allStubs.filter((stub) => {
      if (!selectedSubtypes.includes(stub.subtype)) return false
      if (
        lettersArg &&
        lettersArg.length > 0 &&
        !lettersArg.includes(getInitialForName(stub.name))
      ) {
        return false
      }
      if (namesArg && namesArg.length > 0 && !namesArg.includes(stub.name.toLowerCase())) {
        return false
      }
      return true
    }),
    limit
  )
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
      const entry = buildWeaponEntry(stub, html, resolveAlsoSee)
      entriesBySubtype.get(stub.subtype)?.push(entry)
      console.log(`✓ ${stub.name}`)
    },
  })

  writeDatasets(entriesBySubtype, selectedSubtypes, lettersArg)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
