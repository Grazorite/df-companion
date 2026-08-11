import * as fs from 'node:fs'
import * as path from 'node:path'
import elementsData from '../src/data/elements.json' with { type: 'json' }
import { parseArmorCustomization } from '../src/utils/armorCustomization.ts'
import type {
  AlsoSeeRef,
  AlternativeImage,
  FamilySourceRef,
  LevelVariant,
  ObtainVariant,
} from '../src/types/item.ts'
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
import {
  expandSlashCaptionFromText,
  inferImageCaptionFromUrl,
  normalizeImageCaption,
} from '../src/utils/imageLabels.ts'
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
  getFreshArg,
  getLimitArg,
  getNameFilterArgs,
  matchesNameFilter,
  stripTrailingParenthetical,
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
const INFERRED_ON_HIT_SPECIAL_IMAGE_URL =
  'https://github.com/DF-Pedia/DF-Pedia/raw/master/weapons/Special-Button-OnHit.png'

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
  const slug = slugify(name)
  return `weapon-${slug || 'default'}`
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

function isCorDemiCodexName(name: string): boolean {
  return /\bCorDemi\s*Codex\b/i.test(name)
}

function shouldSkipWeaponStubForSubtype(stub: WeaponStub): boolean {
  return stub.subtype !== 'sword-axe-mace' && isCorDemiCodexName(stub.name)
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
    const indentLength = line.match(/^\s*/)?.[0].length ?? 0
    if (indentLength > 0 && noteLines.length > 0) {
      noteLines.push(`${' '.repeat(indentLength)}• ${cleanedText}`)
    } else {
      noteLines.push(cleanedText)
    }
  }

  return noteLines.length > 0 ? noteLines.join('\n') : undefined
}

function repairWeaponNoteNesting(notes: string | undefined): string | undefined {
  if (!notes) return undefined
  if (
    !/Special'?s DoT became mutually exclusive|Weapons'? special became mutually exclusive/i.test(
      notes
    )
  ) {
    return notes
  }

  return notes
    .split('\n')
    .map((line) =>
      /^\s{2}•\s+(?:'(?:DOOM|Destiny|Destroyer's Spirit|Spirit of (?:Ice|Light))|All 'Spirit' effects)/i.test(
        line
      )
        ? `  ${line}`
        : line
    )
    .join('\n')
}

function combineNoteBlocks(...notes: Array<string | undefined>): string | undefined {
  const blocks = notes
    .map((note) => repairWeaponNoteNesting(note)?.trim())
    .filter((note): note is string => Boolean(note))
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

function inferOnHitWeaponSpecialFromNotes(notes?: string): WeaponSpecial | undefined {
  if (!notes) return undefined
  if (!/Special'?s DoT/i.test(notes)) return undefined
  if (!/Activation rate/i.test(notes) && !/\b\d+%\s+chance\b/i.test(notes)) return undefined

  const rate =
    notes.match(/Activation rate was increased from \d+% to (\d+%)/i)?.[1] ??
    notes.match(/Activation rate[^.\n]*?(\d+%)/i)?.[1] ??
    notes.match(/\b(\d+%)\s+chance\b/i)?.[1]
  const damage =
    notes.match(/Special'?s DoT damage was increased from \d+% to (\d+%)/i)?.[1] ??
    notes.match(/Special'?s DoT damage[^.\n]*?(\d+%)/i)?.[1]
  const effectParts = [
    damage ? `Applies a ${damage} on-hit DoT effect.` : 'Applies an on-hit DoT effect.',
    rate ? `Activation rate: ${rate}.` : undefined,
  ].filter(Boolean)

  return {
    activation: 'on-hit',
    trigger: 'Weapon special activates on hit.',
    effect: effectParts.join(' '),
    imageUrl: INFERRED_ON_HIT_SPECIAL_IMAGE_URL,
  }
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
  const imageCaptionText = normalizeStructuredText(scanHtml)
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
            expandSlashCaptionFromText(
              normalizeWeaponImageCaption(candidate.caption, candidate.url) ??
                inferImageCaptionFromUrl(candidate.url),
              imageCaptionText
            ) ??
            normalizeWeaponImageCaption(candidate.caption, candidate.url) ??
            inferImageCaptionFromUrl(candidate.url) ??
            `Alternative ${index + 1}`,
        }))
        .filter((candidate) => !/^weapon'?s artwork$/i.test(candidate.caption))
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
  const armorCustomization =
    parseArmorCustomization(notes) ??
    parseArmorCustomization(description) ??
    parseArmorCustomization(normalizedText) ??
    parseArmorCustomization(html)
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
  const armorCustomization =
    parseArmorCustomization(notes) ??
    parseArmorCustomization(parseDescription(html)) ??
    parseArmorCustomization(normalizeStructuredText(html)) ??
    parseArmorCustomization(html)
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
          familyForm ? `${familyForm} (DC)` : roman ? `${roman} (DC)` : '(DC)',
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
  const normalizeParticles = (value: string) => value.replace(/\bOf\b/g, 'of')
  if (name === 'Half Foam Hammer') return 'Half of a Foam Hammer'
  if (/\bKey,\s*The$/i.test(name)) return name.replace(/,\s*The$/i, '').trim()
  if (/^(?:.+)\s+\((?:Aria In Wanderland|Card Shoppe|\d+)\)$/i.test(name)) {
    return normalizeParticles(
      displayTitle(stripVersionSuffix(name.replace(/\s+\([^)]+\)\s*$/, '').trim()))
    )
  }
  const repeatedDefaultMatch = name.match(/^(.*?)\s+\((.*?)\s+Default\)$/i)
  if (
    repeatedDefaultMatch &&
    normalizeWeaponLookupName(repeatedDefaultMatch[1] ?? '') ===
      normalizeWeaponLookupName(repeatedDefaultMatch[2] ?? '')
  ) {
    return normalizeParticles(displayTitle(stripVersionSuffix(repeatedDefaultMatch[1] ?? '')))
  }
  return normalizeParticles(displayTitle(stripVersionSuffix(name)))
}

function normalizeWeaponVariantDisplayName(name: string, familyName: string): string {
  const displayName = name
    .replace(/\s+\([12]\)\s*$/i, '')
    .trim()
    .replace(/\bOf\b/g, 'of')
  if (normalizeWeaponLookupName(name) === normalizeWeaponLookupName(familyName)) return familyName
  if (/\bKey,\s*The$/i.test(displayName)) return displayName.replace(/,\s*The$/i, '').trim()
  return displayName
}

function normalizeWeaponSourceVariantLabel(name: string): string {
  return displayTitle(stripVersionSuffix(name))
}

function normalizeWeaponSourceLabelForFamily(label: string, familyName: string): string {
  const normalizedLabel = normalizeWeaponSourceVariantLabel(label)
  return normalizeWeaponComparableTitle(normalizedLabel) ===
    normalizeWeaponComparableTitle(`The ${familyName}`)
    ? familyName
    : normalizedLabel
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

  const parentheticalVariant = getWeaponParentheticalVariantName(name, familyName)
  if (parentheticalVariant) return parentheticalVariant

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

function getWeaponParentheticalVariantName(name: string, familyName: string): string | undefined {
  const match = familyName.match(/^(.*?)\s*\(([^)]+)\)\s*$/)
  if (!match) return undefined

  const baseName = (match[1] ?? '').trim()
  const variants = (match[2] ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  if (!baseName || variants.length === 0) return undefined

  const normalizedName = normalizeWeaponLookupName(name)
  const normalizedBase = normalizeWeaponLookupName(baseName)

  for (const variant of variants) {
    const normalizedVariant = normalizeWeaponLookupName(variant)
    const candidateNames = [
      `${normalizedBase} ${normalizedVariant}`,
      `${normalizedBase}${normalizedVariant}`,
    ]
    if (candidateNames.includes(normalizedName)) return displayTitle(variant)
  }

  return undefined
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
  const seen = new Map<string, number>()
  const result: LevelVariant[] = []

  for (const level of levels) {
    const key = [
      normalizeWeaponComparableTitle(level.name),
      level.actualLevel ?? '',
      level.levelDisplay,
      level.sourceUrl ?? '',
      JSON.stringify(level.obtainVariants),
    ].join('|')

    const existingIndex = seen.get(key)
    if (existingIndex !== undefined) {
      const existing = result[existingIndex]
      const existingExplicitBranch =
        existing.variantName && /^(?:\(Base\)|\(DC\)|.+\s\(DC\))$/i.test(existing.variantName)
      const incomingExplicitBranch =
        level.variantName && /^(?:\(Base\)|\(DC\)|.+\s\(DC\))$/i.test(level.variantName)
      const incomingShouldReplace =
        Boolean(incomingExplicitBranch) &&
        (!existingExplicitBranch ||
          (level.obtainVariants.some(obtainVariantHasDC) &&
            !existing.obtainVariants.some(obtainVariantHasDC)))

      if (incomingShouldReplace) {
        result[existingIndex] = level
      }
      continue
    }

    seen.set(key, result.length)
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
  existingAliases: string[] = [],
  canonicalSlug: string = weaponSlugForName(familyName)
): string[] {
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
    aliasSlugs: buildWeaponFamilyAliasSlugs(
      family.familyName,
      levelVariants,
      family.aliasSlugs,
      family.slug
    ),
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
        aliasSlugs: buildWeaponFamilyAliasSlugs(
          family.familyName,
          mergedLevels,
          [...(family.aliasSlugs ?? []), ...standalones.map((entry) => entry.slug)],
          family.slug
        ),
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
    aliasSlugs: buildWeaponFamilyAliasSlugs(
      family.familyName,
      mergedLevels,
      [...(family.aliasSlugs ?? []), ...standalones.map((entry) => entry.slug)],
      family.slug
    ),
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
  const cleanName = name.replace(/\s+\([12]\)\s*$/i, '').trim()
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
  if (familyName === 'Under Current') {
    if (/^Under Current$/i.test(cleanName)) return '(Base)'
    if (/^Rip Tide$/i.test(cleanName)) return 'Rip Tide'
    if (/^Swift Under Current$/i.test(cleanName)) return 'Swift'
  }
  if (familyName === 'Rip Tide') {
    const match = cleanName.match(
      /^(Intense|Sharp|Fierce|Killer|Roiling|Swift|Deadly|Fast|Strong)\s+Rip Tide$/i
    )
    if (match?.[1]) return titleCaseWeaponTokens([match[1]])
  }
  const cardStaffMatch = familyName.match(/^Staff of (Clubs|Diamonds|Hearts|Spades)$/i)
  if (
    cardStaffMatch &&
    /\b(?:Ace of|Staff of|Great|Greater|High|Elite|Knave|Queen|King)\b/i.test(cleanName)
  ) {
    const suit = cardStaffMatch[1]
    if (new RegExp(`^Ace of ${suit} Staff$`, 'i').test(cleanName)) return `Ace of ${suit} Staff`
    if (new RegExp(`^Staff of ${suit}$`, 'i').test(cleanName)) return '(Base)'
    const match = cleanName.match(/^(Great|Greater|High|Elite|Knave|Queen|King)\s+Staff\s+of\s+/i)
    if (match?.[1]) return titleCaseWeaponTokens([match[1]])
  }
  if (familyName === 'Dirk of Spades') {
    if (/^Ace of Spades Dirk$/i.test(cleanName)) return 'Ace of Spades Dirk'
    if (/^Dirk of Spades$/i.test(cleanName)) return '(Base)'
    const match = cleanName.match(
      /^(Great|Greater|High|Elite|Knave|Queen|King|Ultimate)\s+Dirk\s+of\s+Spades$/i
    )
    if (match?.[1]) return titleCaseWeaponTokens([match[1]])
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

function getSourceDisplayTitle(sourceTitle: string | undefined): string | undefined {
  if (!sourceTitle) return undefined
  const title = stripVersionSuffix(sourceTitle.replace(/^DF Encyclopedia:\s*/i, '').trim())
  return title || undefined
}

function getWeaponFamilySourceVariantLabel(
  level: LevelVariant,
  familyName: string,
  sourceTitle?: string
): string {
  if (familyName === 'Eternal Drumstick') {
    const baseVariant = level.variantName?.replace(/\s+\(DC\)$/i, '').trim()
    if (baseVariant === '(L)' || baseVariant === '(XL)') {
      return `${familyName} ${baseVariant}`
    }
    return familyName
  }

  return level.variantName === '(Base)'
    ? (getSourceDisplayTitle(sourceTitle) ?? familyName)
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

function getEllialSuitStaffImageUrl(family: WeaponFamily): string | undefined {
  const match = family.familyName.match(/^Staff of (Clubs|Diamonds|Hearts|Spades)$/i)
  if (!match?.[1] || family.slug.includes('card-shoppe') || family.slug.includes('aria')) {
    return undefined
  }
  const locations = family.levelVariants.flatMap((level) =>
    level.obtainVariants.map((method) => method.location)
  )
  if (
    locations.length === 0 ||
    locations.some((location) => !/(?:Ellial's Weapon Shop|Best of 2010 shop)/i.test(location))
  ) {
    return undefined
  }
  const suit = titleCaseWeaponTokens([match[1]])
  return `https://github.com/DF-Pedia/DF-Pedia/raw/master/weapons/StaffOf${suit}-2.png`
}

function buildWeaponCrossPostFamily(
  group: WeaponEntry[],
  familyNameOverride?: string,
  familySlugOverride?: string
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
  const familySlug = familySlugOverride ?? familyAnchor?.slug ?? weaponSlugForName(familyName)
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
  const inferredSpecials = levelVariants
    .map((variant) => inferOnHitWeaponSpecialFromNotes(variant.notes))
    .filter((value): value is WeaponSpecial => Boolean(value))
  const specials = [
    ...sorted
      .map((entry) =>
        isWeaponFamilyEntry(entry) ? entry.shared.weaponSpecial : entry.weaponSpecial
      )
      .filter((value): value is WeaponSpecial => Boolean(value)),
    ...inferredSpecials,
  ]
  const specialKeys = new Set<string>()
  const dedupedSpecials = specials.filter((special) => {
    const key = JSON.stringify(special)
    if (specialKeys.has(key)) return false
    specialKeys.add(key)
    return true
  })
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
      ...(dedupedSpecials.length > 0 && allWeaponValuesSame(dedupedSpecials)
        ? { weaponSpecial: dedupedSpecials[0] }
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
    hasSpecial: dedupedSpecials.length > 0 || undefined,
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
        if (imageUrls.length > 0 && allWeaponValuesSame(imageUrls)) {
          return { imageUrl: imageUrls[0] }
        }
        if (imageUrls.length === 0 && family.shared.imageUrl) {
          return { imageUrl: family.shared.imageUrl }
        }
        return { imageUrl: undefined }
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

interface MixedVariantWeaponSplitGroup {
  familyName: string
  matches: (level: LevelVariant) => boolean
  getVariantName?: (level: LevelVariant) => string | undefined
}

interface MixedVariantWeaponSplitSpec {
  sourceFamilyNames: string[]
  groups: MixedVariantWeaponSplitGroup[]
}

function getRomanVariantFromLevel(level: LevelVariant): string | undefined {
  return (
    getVariantRomanFromName(level.variantName ?? '') ??
    getVariantRomanFromName(level.name) ??
    getVariantRomanFromName(String(level.levelDisplay ?? ''))
  )
}

function hasRomanVariantInRange(level: LevelVariant, min: number, max: number): boolean {
  const roman = getRomanVariantFromLevel(level)
  const value = roman ? parseRomanNumeral(roman) : null
  return value !== null && value >= min && value <= max
}

function isBaseOrRomanProgressionVariant(level: LevelVariant, maxRoman: number): boolean {
  if (level.variantName === '(Base)') return true
  return hasRomanVariantInRange(level, 1, maxRoman)
}

function isYearVariant(level: LevelVariant, year: '09' | '10'): boolean {
  return new RegExp(`(?:^|\\s)'?${year}$`, 'i').test(level.variantName ?? level.name)
}

function isModernSeaVariant(level: LevelVariant): boolean {
  return !isYearVariant(level, '09') && !isYearVariant(level, '10')
}

function getRomanOrExistingVariantName(level: LevelVariant): string | undefined {
  return getRomanVariantFromLevel(level) ?? level.variantName
}

const MIXED_VARIANT_WEAPON_SPLIT_SPECS: MixedVariantWeaponSplitSpec[] = [
  {
    sourceFamilyNames: ['Batwing Blade'],
    groups: [
      {
        familyName: 'Batwing Blade (I, II, III)',
        matches: (level) => /^Batwing Blade (?:I|II|III)$/i.test(level.name),
      },
      {
        familyName: 'Dark Batwing Blade',
        matches: (level) => /^Dark Batwing Blade$/i.test(level.name),
      },
    ],
  },
  {
    sourceFamilyNames: ['Batwing Broom'],
    groups: [
      {
        familyName: 'Batwing Broom (I, II, III)',
        matches: (level) => /^Batwing Broom (?:I|II|III)$/i.test(level.name),
      },
      {
        familyName: 'Dark Batwing Broom',
        matches: (level) => /^Dark Batwing Broom$/i.test(level.name),
      },
    ],
  },
  {
    sourceFamilyNames: ['Batwing Hatchet'],
    groups: [
      {
        familyName: 'Batwing Hatchet (I, II, III)',
        matches: (level) => /^Batwing Hatchet (?:I|II|III)$/i.test(level.name),
      },
      {
        familyName: 'Dark Batwing Hatchet',
        matches: (level) => /^Dark Batwing Hatchet$/i.test(level.name),
      },
    ],
  },
  {
    sourceFamilyNames: ["ShadowWalker's Chakram"],
    groups: [
      {
        familyName: "ShadowWalker's Chakram (I-IV)",
        matches: (level) => /^ShadowWalker's Chakram (?:I|II|III|IV)$/i.test(level.name),
      },
      {
        familyName: "Reforged ShadowWalker's Chakram",
        matches: (level) => /^Reforged ShadowWalker's Chakram$/i.test(level.name),
      },
    ],
  },
  {
    sourceFamilyNames: ['Wavecrest'],
    groups: [
      {
        familyName: 'Wavecrest (I-V)',
        matches: (level) => isBaseOrRomanProgressionVariant(level, 5),
      },
      {
        familyName: 'Wavecrest (Missed, Lost, Stray, Wayward)',
        matches: (level) => /^(?:Missed|Lost|Stray|Wayward)\s+Wavecrest$/i.test(level.name),
        getVariantName: (level) =>
          level.name.match(/^(Missed|Lost|Stray|Wayward)\s+Wavecrest$/i)?.[1],
      },
    ],
  },
  {
    sourceFamilyNames: ['High Tide'],
    groups: [
      {
        familyName: 'High Tide (I-V)',
        matches: (level) => isBaseOrRomanProgressionVariant(level, 5),
      },
      {
        familyName: 'High Tide (Misplaced, Missed, Lost, Stray, Wayward)',
        matches: (level) =>
          /^(?:Misplaced|Missed|Lost|Stray|Wayward)\s+High Tide$/i.test(level.name),
        getVariantName: (level) =>
          level.name.match(/^(Misplaced|Missed|Lost|Stray|Wayward)\s+High Tide$/i)?.[1],
      },
    ],
  },
  {
    sourceFamilyNames: ['Deluge'],
    groups: [
      {
        familyName: 'Deluge (I-V)',
        matches: (level) => isBaseOrRomanProgressionVariant(level, 5),
      },
      {
        familyName: 'Deluge (Misplaced, Missed, Lost, Stray, Wayward)',
        matches: (level) => /^(?:Misplaced|Missed|Lost|Stray|Wayward)\s+Deluge$/i.test(level.name),
        getVariantName: (level) =>
          level.name.match(/^(Misplaced|Missed|Lost|Stray|Wayward)\s+Deluge$/i)?.[1],
      },
    ],
  },
  ...(["Sea's Blessing", "Sea's Favor", "Sea's Bounty"] as const).map((familyName) => ({
    sourceFamilyNames: [familyName],
    groups: [
      {
        familyName: `${familyName} '09`,
        matches: (level: LevelVariant) => isYearVariant(level, '09'),
      },
      {
        familyName: `${familyName} '10`,
        matches: (level: LevelVariant) => isYearVariant(level, '10'),
      },
      {
        familyName,
        matches: isModernSeaVariant,
      },
    ],
  })),
  {
    sourceFamilyNames: ['Amaterasu'],
    groups: [
      {
        familyName: 'Amaterasu (I-II)',
        matches: (level) => hasRomanVariantInRange(level, 1, 2),
      },
      {
        familyName: 'Amaterasu-Omikami',
        matches: (level) => /^Amaterasu-Omikami$/i.test(level.name),
      },
    ],
  },
  {
    sourceFamilyNames: ['Tsukuyomi'],
    groups: [
      {
        familyName: 'Tsukuyomi (I-II)',
        matches: (level) => hasRomanVariantInRange(level, 1, 2),
      },
      {
        familyName: 'Tsukuyomi-no-Mikoto',
        matches: (level) => /^Tsukuyomi-no-Mikoto$/i.test(level.name),
      },
    ],
  },
  {
    sourceFamilyNames: ['The Threadcutter (Alpha, I-IX)', 'The Threadcutter'],
    groups: [
      {
        familyName: 'The Threadcutter Alpha',
        matches: (level) => /\bAlpha$/i.test(level.name),
      },
      {
        familyName: 'The Threadcutter (I-IX)',
        matches: (level) => hasRomanVariantInRange(level, 1, 9),
        getVariantName: getRomanOrExistingVariantName,
      },
    ],
  },
  {
    sourceFamilyNames: ["Time's Harvest (Alpha, I-IX)", "Time's Harvest"],
    groups: [
      {
        familyName: "Time's Harvest Alpha",
        matches: (level) => /\bAlpha$/i.test(level.name),
      },
      {
        familyName: "Time's Harvest (I-IX)",
        matches: (level) => hasRomanVariantInRange(level, 1, 9),
        getVariantName: getRomanOrExistingVariantName,
      },
    ],
  },
  {
    sourceFamilyNames: ['The Massive Axe'],
    groups: [
      {
        familyName: 'The Massive Axe (I-IV)',
        matches: (level) => hasRomanVariantInRange(level, 1, 4),
      },
      {
        familyName: 'The Massive Axe XL',
        matches: (level) => /\bXL$/i.test(level.name),
      },
    ],
  },
]

function getMixedVariantWeaponSplitSpec(
  familyName: string
): MixedVariantWeaponSplitSpec | undefined {
  const normalizedName = normalizeWeaponComparableTitle(familyName)
  return MIXED_VARIANT_WEAPON_SPLIT_SPECS.find((spec) =>
    spec.sourceFamilyNames.some(
      (sourceName) => normalizeWeaponComparableTitle(sourceName) === normalizedName
    )
  )
}

function getWeaponFamilyRef(family: WeaponFamily): AlsoSeeRef {
  return {
    name: family.familyName,
    slug: family.slug,
    type: 'weapon',
    url: family.forumUrl,
  }
}

function addWeaponSplitSiblingRefs(families: WeaponFamily[]): WeaponFamily[] {
  const siblingSlugs = new Set(families.map((family) => family.slug))

  return families.map((family) => {
    const siblingRefs = families
      .filter((sibling) => sibling.slug !== family.slug)
      .map(getWeaponFamilyRef)
    const existingRefs = (family.shared.alsoSee ?? []).filter(
      (ref) => !siblingSlugs.has(ref.slug) && ref.slug !== family.slug
    )
    const alsoSee = Array.from(
      new Map(
        [...existingRefs, ...siblingRefs].map((ref) => [
          `${ref.type}:${ref.slug}`.toLowerCase(),
          ref,
        ])
      ).values()
    )

    return {
      ...family,
      shared: {
        ...family.shared,
        ...(alsoSee.length > 0 ? { alsoSee } : { alsoSee: undefined }),
      },
    }
  })
}

function cloneMixedVariantWeaponFamilyGroup(
  family: WeaponFamily,
  group: MixedVariantWeaponSplitGroup,
  levels: LevelVariant[]
): WeaponFamily {
  const adjustedLevels = group.getVariantName
    ? levels.map((level) => ({
        ...level,
        variantName: group.getVariantName?.(level) ?? level.variantName,
      }))
    : levels
  return cloneWeaponFamilyWithLevels(family, group.familyName, adjustedLevels)
}

export function splitApprovedMixedVariantWeaponFamilies(entries: WeaponEntry[]): WeaponEntry[] {
  return entries.flatMap<WeaponEntry>((entry) => {
    if (!isWeaponFamilyEntry(entry)) return [entry]
    const normalizedEntry = dedupeWeaponFamilyEntry(entry)
    const spec = getMixedVariantWeaponSplitSpec(normalizedEntry.familyName)
    if (!spec) return [normalizedEntry]

    const matchedLevelNames = new Set<string>()
    const splitFamilies = spec.groups
      .map((group) => {
        const levels = normalizedEntry.levelVariants.filter((level) => {
          const matched = group.matches(level)
          if (matched) matchedLevelNames.add(level.name)
          return matched
        })
        return levels.length > 0
          ? cloneMixedVariantWeaponFamilyGroup(normalizedEntry, group, levels)
          : undefined
      })
      .filter((family): family is WeaponFamily => Boolean(family))

    if (splitFamilies.length <= 1) return [normalizedEntry]

    const unmatchedLevels = normalizedEntry.levelVariants.filter(
      (level) => !matchedLevelNames.has(level.name)
    )
    if (unmatchedLevels.length > 0) {
      splitFamilies.push(
        cloneWeaponFamilyWithLevels(normalizedEntry, normalizedEntry.familyName, unmatchedLevels)
      )
    }

    return addWeaponSplitSiblingRefs(splitFamilies)
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

function buildStandaloneWeaponFromLevelVariant(
  level: LevelVariant,
  subtype: WeaponSubtype
): Weapon {
  const methods = dedupeObtainVariants(level.obtainVariants)
  const hasDA = methods.some((method) => method.daRequired)
  const hasDC = methods.some((method) => obtainVariantHasDC(method))
  const hasDM = methods.some((method) => method.dmRequired)

  return {
    id: weaponSlugForName(level.name),
    name: level.name,
    slug: weaponSlugForName(level.name),
    type: 'weapon',
    subtype,
    description: level.description ?? '',
    forumUrl: level.sourceUrl ?? '',
    releaseDate: '',
    ...(level.imageUrl ? { imageUrl: level.imageUrl } : {}),
    ...(level.alternativeImages ? { alternativeImages: level.alternativeImages } : {}),
    elements: level.element ? [level.element] : [],
    level: String(level.actualLevel ?? level.levelDisplay),
    damage: level.damage,
    stats: level.stats,
    ...(level.resists ? { resists: level.resists } : {}),
    ...(level.rarity ? { rarity: level.rarity } : {}),
    ...(level.itemType ? { itemType: level.itemType } : {}),
    obtainMethods: methods,
    tags: Array.from(new Set(methods.map((method) => method.priceType))),
    daRequired: Boolean(hasDA),
    ...(hasDC ? { dcRequired: true } : {}),
    ...(hasDM ? { dmRequired: true } : {}),
    ...(level.notes ? { notes: level.notes } : {}),
  }
}

type PlayingCardSuit = 'Clubs' | 'Hearts' | 'Diamonds' | 'Spades'
type PlayingCardSuitKind = 'Sword' | 'Blade' | 'Staff' | 'Dagger' | 'Dirk'
type PlayingCardSuitSeries = 'ellial' | 'card' | 'dragon-card'

interface PlayingCardSuitSeriesMatch {
  kind: PlayingCardSuitKind
  suit: PlayingCardSuit
  series: PlayingCardSuitSeries
}

function getFirstObtainLocation(methods?: ObtainVariant[]): string {
  return methods?.[0]?.location ?? ''
}

function getPlayingCardSuitSeriesMatch(
  name: string,
  methods?: ObtainVariant[]
): PlayingCardSuitSeriesMatch | undefined {
  const normalizedName = name.replace(/\s+\(\d+\)\s*$/, '').trim()
  const rankPattern = '(?:Great|Greater|High|Elite|Knave|Queen|King)'
  const suitPattern = '(Clubs|Hearts|Diamonds|Spades)'
  const simpleMatch = normalizedName.match(
    new RegExp(
      `^(?:High\\s+|Elite\\s+(?:High\\s+)?|)(Sword|Staff|Dagger)\\s+of\\s+${suitPattern}$`,
      'i'
    )
  )
  if (simpleMatch) {
    const kind = titleCaseWeaponTokens([simpleMatch[1]]) as 'Sword' | 'Staff' | 'Dagger'
    const suit = titleCaseWeaponTokens([simpleMatch[2]]) as PlayingCardSuit
    const location = getFirstObtainLocation(methods)
    if (kind === 'Staff' && /Card Shoppe/i.test(location)) {
      return { kind, suit, series: 'card' }
    }
    if (location && !/(?:Ellial's Weapon Shop|Best of 2010 shop)/i.test(location)) {
      return undefined
    }
    return { kind, suit, series: 'ellial' }
  }

  const cardMatch = normalizedName.match(
    new RegExp(
      `^(?:Ace of ${suitPattern} (Blade|Staff|Dirk)|(Blade|Staff|Dirk) of ${suitPattern}|${rankPattern}\\s+(Blade|Staff|Dirk)\\s+of\\s+${suitPattern})$`,
      'i'
    )
  )
  if (cardMatch) {
    const kind = titleCaseWeaponTokens([cardMatch[2] ?? cardMatch[3] ?? cardMatch[5]]) as
      'Blade' | 'Staff' | 'Dirk'
    const suit = titleCaseWeaponTokens([
      cardMatch[1] ?? cardMatch[4] ?? cardMatch[6],
    ]) as PlayingCardSuit
    const location = getFirstObtainLocation(methods)
    if (location && !/Card Shoppe/i.test(location)) return undefined
    return { kind, suit, series: 'card' }
  }

  const dragonMatch = normalizedName.match(
    new RegExp(
      `^(?:Dragon Ace of ${suitPattern} (Blade|Staff|Dirk)|Dragon (Blade|Staff|Dirk) of ${suitPattern}|${rankPattern}\\s+Dragon\\s+(Blade|Staff|Dirk)\\s+of\\s+${suitPattern})$`,
      'i'
    )
  )
  if (!dragonMatch) return undefined

  return {
    kind: titleCaseWeaponTokens([dragonMatch[2] ?? dragonMatch[3] ?? dragonMatch[5]]) as
      'Blade' | 'Staff' | 'Dirk',
    suit: titleCaseWeaponTokens([
      dragonMatch[1] ?? dragonMatch[4] ?? dragonMatch[6],
    ]) as PlayingCardSuit,
    series: 'dragon-card',
  }
}

function getPlayingCardSuitFamilyName(
  spec: { kind: PlayingCardSuitKind; series: PlayingCardSuitSeries; familyKind: string },
  suit: PlayingCardSuit
): string {
  return `${spec.familyKind} of ${suit}`
}

function getPlayingCardSuitFamilySlug(
  spec: { kind: PlayingCardSuitKind; series: PlayingCardSuitSeries },
  familyName: string
): string | undefined {
  if (spec.kind === 'Staff' && spec.series === 'card') {
    return weaponSlugForName(`${familyName} (Card Shoppe)`)
  }
  return undefined
}

function splitPlayingCardSuitWeaponFamilies(entries: WeaponEntry[]): WeaponEntry[] {
  const replacements = new Map<string, WeaponEntry[]>()
  const appendReplacement = (slug: string, replacement: WeaponEntry) => {
    replacements.set(slug, [...(replacements.get(slug) ?? []), replacement])
  }
  const suits: PlayingCardSuit[] = ['Clubs', 'Hearts', 'Diamonds', 'Spades']
  const specs: Array<{
    kind: PlayingCardSuitKind
    series: PlayingCardSuitSeries
    subtype: WeaponSubtype
    familyKind: string
  }> = [
    { kind: 'Sword', series: 'ellial', subtype: 'sword-axe-mace', familyKind: 'Sword' },
    { kind: 'Blade', series: 'card', subtype: 'sword-axe-mace', familyKind: 'Blade' },
    { kind: 'Blade', series: 'dragon-card', subtype: 'sword-axe-mace', familyKind: 'Dragon Blade' },
    { kind: 'Staff', series: 'ellial', subtype: 'staff-wand', familyKind: 'Staff' },
    { kind: 'Staff', series: 'card', subtype: 'staff-wand', familyKind: 'Staff' },
    { kind: 'Staff', series: 'dragon-card', subtype: 'staff-wand', familyKind: 'Dragon Staff' },
    { kind: 'Dagger', series: 'ellial', subtype: 'dagger', familyKind: 'Dagger' },
    { kind: 'Dirk', series: 'card', subtype: 'dagger', familyKind: 'Dirk' },
    { kind: 'Dirk', series: 'dragon-card', subtype: 'dagger', familyKind: 'Dragon Dirk' },
  ]

  for (const spec of specs) {
    for (const suit of suits) {
      const sourceEntries = entries.filter((entry) => {
        if (entry.subtype !== spec.subtype) return false
        if (entryHasObtainLocation(entry, /Aria In Wanderland/i)) return false
        if (!isWeaponFamilyEntry(entry)) {
          const entryMatch = getPlayingCardSuitSeriesMatch(entry.name, entry.obtainMethods)
          return (
            entryMatch?.kind === spec.kind &&
            entryMatch.suit === suit &&
            entryMatch.series === spec.series
          )
        }
        return entry.levelVariants.some((level) => {
          const match = getPlayingCardSuitSeriesMatch(level.name, level.obtainVariants)
          return match?.kind === spec.kind && match.suit === suit && match.series === spec.series
        })
      })

      const matchedLevels = sourceEntries.flatMap((entry) =>
        isWeaponFamilyEntry(entry)
          ? entry.levelVariants
              .filter((level) => {
                const match = getPlayingCardSuitSeriesMatch(level.name, level.obtainVariants)
                return (
                  match?.kind === spec.kind && match.suit === suit && match.series === spec.series
                )
              })
              .map((level) => ({ ...level, sourceUrl: level.sourceUrl ?? entry.forumUrl }))
          : (() => {
              const match = getPlayingCardSuitSeriesMatch(entry.name, entry.obtainMethods)
              return match?.kind === spec.kind &&
                match.suit === suit &&
                match.series === spec.series
                ? [buildLevelVariantFromWeapon(entry, entry.name)]
                : []
            })()
      )

      if (matchedLevels.length < 2) continue

      const familyName = getPlayingCardSuitFamilyName(spec, suit)
      const familySlug = getPlayingCardSuitFamilySlug(spec, familyName)
      const family = buildWeaponCrossPostFamily(
        matchedLevels.map((level) => buildStandaloneWeaponFromLevelVariant(level, spec.subtype)),
        familyName,
        familySlug
      )

      const internalSlugs = new Set([
        ...sourceEntries.map((entry) => entry.slug),
        ...matchedLevels.map((level) => weaponSlugForName(level.name)),
      ])
      const externalRefs = gatherWeaponExternalRefs(sourceEntries, internalSlugs)
      const patchedFamily = {
        ...family,
        shared: {
          ...family.shared,
          ...(externalRefs.length > 0
            ? {
                alsoSee: Array.from(
                  new Map(
                    [...(family.shared.alsoSee ?? []), ...externalRefs].map((ref) => [
                      `${ref.type}:${ref.slug}:${ref.url ?? ''}`.toLowerCase(),
                      ref,
                    ])
                  ).values()
                ).sort((a, b) => compareTitles(a.name, b.name)),
              }
            : {}),
        },
      }

      appendReplacement(sourceEntries[0].slug, patchedFamily)
      for (const entry of sourceEntries.slice(1)) {
        if (!replacements.has(entry.slug)) replacements.set(entry.slug, [])
      }
    }
  }

  if (replacements.size === 0) return entries
  return entries.flatMap((entry) => replacements.get(entry.slug) ?? [entry])
}

function isAriaSuitWeaponEntry(entry: WeaponEntry): entry is Weapon {
  if (isWeaponFamilyEntry(entry)) return false
  if (!entry.obtainMethods.some((method) => /Aria In Wanderland/i.test(method.location))) {
    return false
  }
  return /^(?:Greater\s+|Ultimate\s+|)?(?:Staff|Dirk)\s+of\s+(?:Hearts|Spades)(?:\s+\(\d+\))?$/i.test(
    entry.name
  )
}

function disambiguateAriaSuitWeaponEntries(entries: WeaponEntry[]): WeaponEntry[] {
  return entries.map((entry) => {
    if (!isAriaSuitWeaponEntry(entry)) return entry
    const name = entry.name.replace(/\s+\(\d+\)\s*$/, '').trim()
    const slug = weaponSlugForName(`${name} (Aria In Wanderland)`)
    return {
      ...entry,
      id: slug,
      name,
      slug,
    }
  })
}

function entryHasObtainLocation(entry: WeaponEntry, pattern: RegExp): boolean {
  const methods = isWeaponFamilyEntry(entry)
    ? entry.levelVariants.flatMap((level) => level.obtainVariants)
    : entry.obtainMethods
  return methods.some((method) => pattern.test(method.location))
}

function mergeHardcodedWeaponFamily(
  entries: WeaponEntry[],
  familyName: string,
  familySlug: string,
  isMember: (entry: WeaponEntry) => boolean
): WeaponEntry[] {
  const members = entries.filter(isMember)
  if (members.length < 2) return entries
  const memberSlugs = new Set(members.map((entry) => entry.slug))
  const family = buildWeaponCrossPostFamily(members, familyName, familySlug)
  return [family, ...entries.filter((entry) => !memberSlugs.has(entry.slug))]
}

function mergeCorDemiCodexFamily(entries: WeaponEntry[]): WeaponEntry[] {
  const tierOrder = ['Basic CorDemi Codex', 'Advanced CorDemi Codex', 'Master CorDemi Codex']
  const tierIndexes = new Map(
    tierOrder.map((name, index) => [normalizeWeaponLookupName(name), index])
  )
  const getTierLabel = (name: string): string =>
    stripVersionSuffix(name)
      .replace(/\s+CorDemi\s+Codex$/i, '')
      .trim()
  const members = entries.filter(
    (entry) =>
      entry.subtype === 'sword-axe-mace' &&
      tierIndexes.has(normalizeWeaponLookupName(getWeaponEntryName(entry)))
  )

  if (members.length < 2) return entries

  const memberSlugs = new Set(members.map((entry) => entry.slug))
  const sortedMembers = [...members].sort(
    (first, second) =>
      (tierIndexes.get(normalizeWeaponLookupName(getWeaponEntryName(first))) ?? 99) -
      (tierIndexes.get(normalizeWeaponLookupName(getWeaponEntryName(second))) ?? 99)
  )
  const internalSlugs = new Set(sortedMembers.map((entry) => entry.slug))
  const levelVariants = dedupeWeaponLevelVariants(
    sortedMembers.flatMap((entry) => {
      const tierName = getWeaponEntryName(entry)
      const tierLabel = getTierLabel(tierName)
      const shared = isWeaponFamilyEntry(entry) ? entry.shared : undefined
      const levels = isWeaponFamilyEntry(entry)
        ? entry.levelVariants.map((level) => ({
            ...level,
            sourceUrl: level.sourceUrl ?? entry.forumUrl,
            imageUrl: level.imageUrl ?? shared?.imageUrl,
            alternativeImages: level.alternativeImages ?? shared?.alternativeImages,
            notes: level.notes ?? shared?.notes,
          }))
        : [buildLevelVariantFromWeapon(entry, 'CorDemi Codex')]

      return levels.map((level) => ({
        ...level,
        variantName: level.obtainVariants.some(obtainVariantHasDC)
          ? `${tierLabel} (DC)`
          : tierLabel,
      }))
    })
  ).sort((first, second) => {
    const firstTier =
      tierIndexes.get(normalizeWeaponLookupName(first.name)) ??
      tierIndexes.get(normalizeWeaponLookupName(first.variantName ?? '')) ??
      99
    const secondTier =
      tierIndexes.get(normalizeWeaponLookupName(second.name)) ??
      tierIndexes.get(normalizeWeaponLookupName(second.variantName ?? '')) ??
      99
    return (
      firstTier - secondTier ||
      Number(first.obtainVariants.some(obtainVariantHasDC)) -
        Number(second.obtainVariants.some(obtainVariantHasDC))
    )
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
  const sharedImageUrls = sortedMembers
    .map((entry) => (isWeaponFamilyEntry(entry) ? entry.shared.imageUrl : entry.imageUrl))
    .filter((value): value is string => Boolean(value))
  const sharedAlternativeImages = sortedMembers
    .flatMap((entry) =>
      isWeaponFamilyEntry(entry)
        ? (entry.shared.alternativeImages ?? [])
        : (entry.alternativeImages ?? [])
    )
    .filter((value): value is AlternativeImage => Boolean(value?.url))
  const elements = Array.from(
    new Set(
      levelVariants
        .map((variant) => variant.element)
        .filter((value): value is string => Boolean(value))
    )
  )
  const notes = levelVariants
    .map((variant) => variant.notes)
    .filter((value): value is string => Boolean(value))
  const familySources = dedupeWeaponFamilySources(
    sortedMembers.flatMap((entry) =>
      isWeaponFamilyEntry(entry) && entry.familySources?.length
        ? entry.familySources.map((source) => ({
            ...source,
            variantLabel: getSourceDisplayTitle(source.title) ?? source.variantLabel,
          }))
        : [
            {
              url: entry.forumUrl,
              title: `DF Encyclopedia: ${getWeaponEntryName(entry)}`,
              variantLabel: getWeaponEntryName(entry),
              isPrimary: false,
            },
          ]
    )
  ).map((source, index) => ({ ...source, isPrimary: index === 0 }))
  const family: WeaponFamily = computeFamilyFlags({
    id: 'weapon-cordemi-codex',
    familyName: 'CorDemi Codex',
    slug: 'weapon-cordemi-codex',
    aliasSlugs: Array.from(
      new Set([
        ...internalSlugs,
        ...sortedMembers.flatMap((entry) =>
          isWeaponFamilyEntry(entry) ? (entry.aliasSlugs ?? []) : []
        ),
      ])
    ).filter((slug) => slug !== 'weapon-cordemi-codex'),
    type: 'weapon',
    subtype: 'sword-axe-mace' as WeaponSubtype,
    forumUrl: sortedMembers[0].forumUrl,
    familyOrigin: 'cross-post',
    familySources,
    itemType: 'Sword',
    shared: {
      description: descriptions[0] ?? '',
      ...(sharedImageUrls.length > 0
        ? { imageUrl: sharedImageUrls[0] }
        : imageUrls.length > 0 && allWeaponValuesSame(imageUrls)
          ? { imageUrl: imageUrls[0] }
          : {}),
      ...(sharedAlternativeImages.length > 0
        ? { alternativeImages: sharedAlternativeImages }
        : alternativeImages.length > 0 && allWeaponValuesSame(alternativeImages)
          ? { alternativeImages: alternativeImages[0] }
          : {}),
      ...(elements.length === 1 ? { element: elements[0] } : {}),
      ...(notes.length > 0 && allWeaponValuesSame(notes) ? { notes: notes[0] } : {}),
      alsoSee: [],
    },
    levelVariants,
    category: 'Weapon',
    releaseDate: '',
    tags: Array.from(
      new Set([
        ...sortedMembers.flatMap((entry) => entry.tags ?? []),
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
    levelRange: '',
  })

  return [family, ...entries.filter((entry) => !memberSlugs.has(entry.slug))]
}

function mergeHardcodedWeaponFamilies(entries: WeaponEntry[]): WeaponEntry[] {
  let merged = entries

  merged = mergeCorDemiCodexFamily(merged)

  merged = mergeHardcodedWeaponFamily(
    merged,
    'Staff of Hearts',
    'weapon-staff-of-hearts-aria-in-wanderland',
    (entry) =>
      entry.subtype === 'staff-wand' &&
      entryHasObtainLocation(entry, /Aria In Wanderland/i) &&
      /^(?:Greater\s+|Ultimate\s+|)?Staff of Hearts(?:\s+\(\d+\))?$/i.test(
        getWeaponEntryName(entry)
      )
  )

  merged = mergeHardcodedWeaponFamily(
    merged,
    'Dirk of Spades',
    'weapon-dirk-of-spades-aria-in-wanderland',
    (entry) =>
      entry.subtype === 'dagger' &&
      entryHasObtainLocation(entry, /Aria In Wanderland/i) &&
      /^(?:Greater\s+|Ultimate\s+|)?Dirk of Spades(?:\s+\(\d+\))?$/i.test(getWeaponEntryName(entry))
  )

  merged = mergeHardcodedWeaponFamily(
    merged,
    'Under Current',
    'weapon-under-current',
    (entry) =>
      entry.subtype === 'dagger' &&
      (entry.slug === 'weapon-under-current' ||
        entry.slug === 'weapon-rip-tide-2' ||
        /^Swift Under Current$/i.test(getWeaponEntryName(entry)))
  )

  merged = mergeHardcodedWeaponFamily(
    merged,
    'Rip Tide',
    'weapon-rip-tide',
    (entry) =>
      entry.subtype === 'sword-axe-mace' &&
      entryHasObtainLocation(entry, /^Rip Tide Shop$/i) &&
      /^(?:Intense|Sharp|Fierce|Killer|Roiling|Swift|Deadly|Fast|Strong)\s+Rip Tide$/i.test(
        getWeaponEntryName(entry)
      )
  )

  return merged
}

function levelHasObtainLocation(level: LevelVariant, pattern: RegExp): boolean {
  return level.obtainVariants.some((method) => pattern.test(method.location))
}

function splitAriaSuitLevelsFromMixedWeaponFamilies(entries: WeaponEntry[]): WeaponEntry[] {
  return entries.flatMap<WeaponEntry>((entry): WeaponEntry[] => {
    if (!isWeaponFamilyEntry(entry)) return [entry]

    const normalizedFamilyName = normalizeWeaponFamilyName(entry.familyName)
    const ariaSlug =
      /^Staff of Hearts$/i.test(normalizedFamilyName) && entry.subtype === 'staff-wand'
        ? 'weapon-staff-of-hearts-aria-in-wanderland'
        : /^Dirk of Spades$/i.test(normalizedFamilyName) && entry.subtype === 'dagger'
          ? 'weapon-dirk-of-spades-aria-in-wanderland'
          : undefined
    if (!ariaSlug) return [entry]

    const ariaLevels = entry.levelVariants.filter((level) =>
      levelHasObtainLocation(level, /Aria In Wanderland/i)
    )
    const otherLevels = entry.levelVariants.filter(
      (level) => !levelHasObtainLocation(level, /Aria In Wanderland/i)
    )
    if (ariaLevels.length === 0 || otherLevels.length === 0) return [entry]

    const ariaFamily = buildWeaponCrossPostFamily(
      ariaLevels.map((level) => buildStandaloneWeaponFromLevelVariant(level, entry.subtype)),
      normalizedFamilyName,
      ariaSlug
    )

    const sourceUrlsToRemove = new Set(ariaLevels.map((level) => level.sourceUrl).filter(Boolean))
    const otherFamily = computeFamilyFlags({
      ...entry,
      familyName: normalizedFamilyName,
      levelVariants: otherLevels,
      familySources: entry.familySources?.filter((source) => !sourceUrlsToRemove.has(source.url)),
      aliasSlugs: entry.aliasSlugs?.filter((slug) => !ariaFamily.aliasSlugs?.includes(slug)),
      hasDA: false,
      hasDC: false,
      hasDM: false,
      hasFree: false,
      hasMerge: false,
    })

    return [otherFamily, ariaFamily]
  })
}

function applyInferredWeaponSpecials(entries: WeaponEntry[]): WeaponEntry[] {
  const repairInferredOnHitImage = (special: WeaponSpecial): WeaponSpecial => {
    if (special.imageUrl || special.activation !== 'on-hit') return special
    if (!/on-hit DoT effect/i.test(special.effect)) return special
    return { ...special, imageUrl: INFERRED_ON_HIT_SPECIAL_IMAGE_URL }
  }

  return entries.map((entry) => {
    if (isWeaponFamilyEntry(entry) && (entry.shared.weaponSpecial || entry.shared.weaponSpecials)) {
      const weaponSpecial = entry.shared.weaponSpecial
        ? repairInferredOnHitImage(entry.shared.weaponSpecial)
        : undefined
      const weaponSpecials = entry.shared.weaponSpecials?.map(repairInferredOnHitImage)
      const changed =
        (weaponSpecial && weaponSpecial !== entry.shared.weaponSpecial) ||
        weaponSpecials?.some((special, index) => special !== entry.shared.weaponSpecials?.[index])
      if (!changed) return entry
      return {
        ...entry,
        shared: {
          ...entry.shared,
          ...(weaponSpecial ? { weaponSpecial } : {}),
          ...(weaponSpecials ? { weaponSpecials } : {}),
        },
      }
    }

    if (!isWeaponFamilyEntry(entry) || entry.shared.weaponSpecial || entry.shared.weaponSpecials) {
      return entry
    }

    const specialKeys = new Set<string>()
    const specials = entry.levelVariants
      .map((variant) => inferOnHitWeaponSpecialFromNotes(variant.notes))
      .filter((special): special is WeaponSpecial => Boolean(special))
      .filter((special) => {
        const key = JSON.stringify(special)
        if (specialKeys.has(key)) return false
        specialKeys.add(key)
        return true
      })

    if (specials.length === 0) return entry

    return computeFamilyFlags({
      ...entry,
      shared: {
        ...entry.shared,
        weaponSpecial: specials[0],
        ...(specials.length > 1 ? { weaponSpecials: specials } : {}),
      },
      hasSpecial: true,
      tags: Array.from(new Set([...(entry.tags ?? []), 'special'])).sort(),
      hasDA: false,
      hasDC: false,
      hasDM: false,
      hasFree: false,
      hasMerge: false,
    })
  })
}

function applyParsedArmorCustomizations(entries: WeaponEntry[]): WeaponEntry[] {
  return entries.map((entry) => {
    if (isWeaponFamilyEntry(entry)) {
      const armorCustomization =
        entry.shared.armorCustomization ??
        parseArmorCustomization(
          [
            entry.shared.notes,
            entry.shared.description,
            ...entry.levelVariants.flatMap((variant) => [variant.notes, variant.description]),
          ]
            .filter(Boolean)
            .join('\n')
        )
      if (!armorCustomization) return entry

      return {
        ...entry,
        shared: {
          ...entry.shared,
          armorCustomization,
        },
        hasArmorCustomization: true,
        tags: Array.from(new Set([...(entry.tags ?? []), 'armor-customization'])).sort(),
      }
    }

    const armorCustomization =
      entry.armorCustomization ??
      parseArmorCustomization([entry.notes, entry.description].filter(Boolean).join('\n'))
    if (!armorCustomization) return entry

    return {
      ...entry,
      armorCustomization,
      hasArmorCustomization: true,
      tags: Array.from(new Set([...(entry.tags ?? []), 'armor-customization'])).sort(),
    }
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

function getPostContentForMessageId(html: string, messageId: string): string {
  return (
    splitPrintablePosts(html).find((post) => {
      const sourceUrl = getPrintablePostSourceUrl(post, '')
      return getMessageIdFromForumUrl(sourceUrl) === messageId
    }) ?? html
  )
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

function normalizedSelectedWeaponNameCandidates(value: string): string[] {
  const preserveParentheticalList =
    /\([^)]*,[^)]*\)\s*$/i.test(value) &&
    !/\((?:[ivxlcdm]+(?:\s*[-,]\s*[ivxlcdm]+|\s*,\s*[ivxlcdm]+)*)\)\s*$/i.test(value)
  const parentheticalStripped = preserveParentheticalList
    ? value
    : stripTrailingParenthetical(value)
  return Array.from(
    new Set([
      normalizeWeaponTitleKey(value),
      normalizeWeaponTitleKey(parentheticalStripped),
      normalizeWeaponTitleKey(stripVersionSuffix(value)),
      normalizeWeaponTitleKey(
        stripTrailingParenthetical(stripVersionSuffix(parentheticalStripped))
      ),
    ])
  ).filter(Boolean)
}

function weaponEntryMatchesSelectedNames(
  entry: WeaponEntry,
  selectedNames: string[] | undefined
): boolean {
  if (!selectedNames || selectedNames.length === 0) return false
  const selected = new Set(selectedNames.flatMap(normalizedSelectedWeaponNameCandidates))
  const values = [
    getWeaponEntryName(entry),
    ...('aliasSlugs' in entry
      ? (entry.aliasSlugs ?? []).map((slug) => slug.replace(/^weapon-/, ''))
      : []),
    ...('familySources' in entry
      ? (entry.familySources ?? []).flatMap((source) => [source.title, source.variantLabel])
      : []),
  ].filter((value): value is string => Boolean(value))

  return values.some((value) =>
    normalizedSelectedWeaponNameCandidates(value).some((candidate) => selected.has(candidate))
  )
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

  const getEntryRefs = (entry: WeaponEntry) =>
    isWeaponFamilyEntry(entry) ? entry.shared.alsoSee : entry.alsoSee

  const patchWeaponRefs = (entry: WeaponEntry, refs?: AlsoSeeRef[]) => {
    let patched = refs ?? []
    if (entry.slug === 'weapon-staff-of-hearts-aria-in-wanderland') {
      patched = []
    } else {
      patched = patched.filter((ref) => ref.slug !== 'weapon-staff-of-hearts-aria-in-wanderland')
    }

    if (entry.slug === 'weapon-rip-tide') {
      patched = [
        ...patched,
        {
          name: 'Rip Current',
          slug: 'weapon-rip-current',
          type: 'weapon',
          url: 'https://forums2.battleon.com/f/tm.asp?m=21615021',
        },
      ]
      patched = patched.filter((ref) => ref.slug !== 'weapon-under-current')
    } else if (entry.slug === 'weapon-rip-current') {
      patched = [
        ...patched,
        {
          name: 'Rip Tide',
          slug: 'weapon-rip-tide',
          type: 'weapon',
          url: 'https://forums2.battleon.com/f/tm.asp?m=21615107',
        },
      ]
    } else if (entry.slug === 'weapon-under-current') {
      patched = patched.filter((ref) => ref.slug !== 'weapon-rip-current')
    }

    const destinyRefs: AlsoSeeRef[] = [
      {
        name: 'Blinding Light of Destiny',
        slug: 'weapon-blinding-light-of-destiny',
        type: 'weapon',
        url: 'https://forums2.battleon.com/f/tm.asp?m=17778584',
      },
      {
        name: 'Dragonstaff of Destiny',
        slug: 'weapon-dragonstaff-of-destiny',
        type: 'weapon',
        url: 'https://forums2.battleon.com/f/tm.asp?m=17778651',
      },
      {
        name: 'Twin Blades of Destiny',
        slug: 'weapon-twin-blades-of-destiny',
        type: 'weapon',
        url: 'https://forums2.battleon.com/f/tm.asp?m=17778632',
      },
    ]
    if (destinyRefs.some((ref) => ref.slug === entry.slug)) {
      patched = [...patched, ...destinyRefs.filter((ref) => ref.slug !== entry.slug)]
    }

    return Array.from(
      new Map(patched.map((ref) => [`${ref.type}:${ref.slug}`.toLowerCase(), ref])).values()
    )
  }

  return entries.map((entry) => {
    const alsoSee = patchWeaponRefs(entry, dedupeRefs(getEntryRefs(entry)))?.filter(
      (ref) => ref.slug !== entry.slug
    )
    if ('levelVariants' in entry) {
      return {
        ...entry,
        shared: {
          ...entry.shared,
          alsoSee,
        },
      }
    }

    return {
      ...entry,
      alsoSee,
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
          const explicitBranchVariantName =
            level.variantName && /^(?:\(Base\)|\(DC\)|.+\s\(DC\))$/i.test(level.variantName)
              ? level.variantName
              : undefined
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
              explicitBranchVariantName ??
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
        .map((level) => [
          level.sourceUrl!,
          getWeaponFamilySourceVariantLabel(
            level,
            familyName,
            level.sourceUrl ? sourceByUrl.get(level.sourceUrl)?.title : undefined
          ),
        ])
    )
    const ellialSuitStaffImageUrl = getEllialSuitStaffImageUrl({
      ...entry,
      familyName,
      levelVariants,
    })
    return {
      ...entry,
      id: entry.id === entry.slug ? entry.slug : entry.id,
      familyName,
      slug: entry.slug,
      aliasSlugs: buildWeaponFamilyAliasSlugs(
        familyName,
        [...entry.levelVariants, ...levelVariants],
        [...(entry.aliasSlugs ?? []), entry.slug],
        entry.slug
      ),
      familySources: entry.familySources
        ? dedupeWeaponFamilySources(
            entry.familySources.map((source) => {
              const sourceVariantLabel =
                sourceLabelByUrl.get(source.url) ??
                (source.variantLabel
                  ? normalizeWeaponSourceLabelForFamily(source.variantLabel, familyName)
                  : undefined)
              return {
                ...source,
                ...(sourceVariantLabel ? { variantLabel: sourceVariantLabel } : {}),
              }
            })
          )
        : undefined,
      shared: {
        ...entry.shared,
        ...(ellialSuitStaffImageUrl && !entry.shared.imageUrl
          ? { imageUrl: ellialSuitStaffImageUrl }
          : {}),
      },
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

export function removeConflictingWeaponAliasSlugs(entries: WeaponEntry[]): WeaponEntry[] {
  const canonicalBySubtype = new Set(entries.map((entry) => `${entry.subtype}:${entry.slug}`))

  return entries.map((entry) => {
    if (!isWeaponFamilyEntry(entry) || !entry.aliasSlugs?.length) return entry

    const aliasSlugs = entry.aliasSlugs.filter((aliasSlug) => {
      if (aliasSlug === entry.slug) return true
      return !canonicalBySubtype.has(`${entry.subtype}:${aliasSlug}`)
    })

    return aliasSlugs.length > 0 ? { ...entry, aliasSlugs } : { ...entry, aliasSlugs: undefined }
  })
}

export function removeMisleadingCrossSubtypeWeaponAliases(entries: WeaponEntry[]): WeaponEntry[] {
  return entries.map((entry) => {
    if (!isWeaponFamilyEntry(entry) || entry.slug !== 'weapon-under-current') return entry
    const aliasSlugs = entry.aliasSlugs?.filter((slug) => slug !== 'weapon-rip-tide')
    return aliasSlugs && aliasSlugs.length > 0
      ? { ...entry, aliasSlugs }
      : { ...entry, aliasSlugs: undefined }
  })
}

export function removeDuplicateWeaponAliasClaims(entries: WeaponEntry[]): WeaponEntry[] {
  const claimCounts = new Map<string, number>()
  for (const entry of entries) {
    if (!isWeaponFamilyEntry(entry) || !entry.aliasSlugs?.length) continue
    for (const aliasSlug of entry.aliasSlugs) {
      const key = `${entry.subtype}:${aliasSlug}`
      claimCounts.set(key, (claimCounts.get(key) ?? 0) + 1)
    }
  }

  return entries.map((entry) => {
    if (!isWeaponFamilyEntry(entry) || !entry.aliasSlugs?.length) return entry
    const aliasSlugs = entry.aliasSlugs.filter(
      (aliasSlug) => (claimCounts.get(`${entry.subtype}:${aliasSlug}`) ?? 0) <= 1
    )
    return aliasSlugs.length > 0 ? { ...entry, aliasSlugs } : { ...entry, aliasSlugs: undefined }
  })
}

export function normalizeDisambiguatedStandaloneWeaponNames(entries: WeaponEntry[]): WeaponEntry[] {
  return entries.map((entry) => {
    if (isWeaponFamilyEntry(entry)) return entry
    const cleanName = entry.name.replace(/\s+\([12]\)\s*$/i, '').trim()
    if (cleanName === entry.name) return entry
    return {
      ...entry,
      name: cleanName,
    }
  })
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
  selectedMessageIds?: Set<string>,
  fresh = false
) {
  for (const subtype of selectedSubtypes) {
    const incoming = disambiguateAriaSuitWeaponEntries(entriesBySubtype.get(subtype) ?? [])
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
      if (fresh && weaponEntryMatchesSelectedNames(entry, selectedNames)) {
        return false
      }
      if (!fresh && selectedNames && matchesNameFilter(displayName, { names: selectedNames })) {
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
    let merged = disambiguateAriaSuitWeaponEntries([...preserved, ...incoming])
    merged = mergeSameSlugWeaponFamilies(merged)
    merged = promoteWeaponCrossPostFamilies(merged)
    merged = mergeHardcodedWeaponFamilies(merged)
    merged = splitPlayingCardSuitWeaponFamilies(merged)
    merged = splitAriaSuitLevelsFromMixedWeaponFamilies(merged)
    merged = splitApprovedMixedVariantWeaponFamilies(merged)
    merged = mergeHardcodedWeaponFamilies(merged)
    merged = mergeFoamHammerStandaloneMembers(merged)
    merged = normalizeWeaponFamilyDisplayLabels(merged)
    merged = applyInferredWeaponSpecials(merged)
    merged = applyParsedArmorCustomizations(merged)
    merged = splitFoamRolithStandaloneEntry(merged)
    merged = dedupeWeaponEntriesBySlug(merged)
    merged = removeDuplicateWeaponAliasClaims(merged)
    merged = removeConflictingWeaponAliasSlugs(merged)
    merged = removeMisleadingCrossSubtypeWeaponAliases(merged)
    merged = canonicalizeWeaponAlsoSeeRefs(merged)
    merged = addFoamHammerSiblingRefs(merged)
    merged = normalizeDisambiguatedStandaloneWeaponNames(merged)
    merged = removeWeaponAliasStandaloneEntries(merged).sort((a, b) =>
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
  const fresh = getFreshArg()
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
      const html = /\bfb\.asp\?/i.test(url)
        ? getPostContentForMessageId(await fetchThreadPostContent(messageId, cookie), messageId)
        : await fetchPostContent(messageId, cookie)
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
    if (shouldSkipWeaponStubForSubtype(stub)) return false
    if (directMessageIds.size > 0 && !directMessageIds.has(stub.messageId)) return false
    if (lettersArg && lettersArg.length > 0 && !lettersArg.includes(getInitialForName(stub.name))) {
      return false
    }
    return true
  })
  const namedStubs = applyNameFilter(scopedStubs, nameFilter, (stub) => stub.name)
  if (namedStubs.message) console.log(namedStubs.message)
  const selectedStubs = applyLimit(
    directMessageIds.size > 0
      ? namedStubs.entries
      : dedupeCrossSubtypeSelectedStubs(namedStubs.entries, crossSubtypeContext),
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
    directMessageIds.size > 0 ? parsedMessageIds : undefined,
    fresh
  )
}

if (process.argv[1] && path.basename(process.argv[1]) === 'scrape-weapons.ts') {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
