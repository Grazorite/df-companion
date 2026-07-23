import * as fs from 'node:fs'
import * as path from 'node:path'
import elementsData from '../src/data/elements.json' with { type: 'json' }
import {
  computeFamilyFlags,
  computePriceType,
  normalizeLevel,
  obtainVariantHasDC,
} from '../src/utils/variantHelpers.ts'
import { compareTitles, titleSortKey } from '../src/utils/displayText.ts'
import {
  ACCESSORY_SUBTYPES,
  type Accessory,
  type AccessoryEntry,
  type AccessoryFamily,
  type AccessorySubtype,
} from '../src/types/accessory.ts'
import {
  convertImageTags,
  extractThreadPostContents,
  fetchPrintable,
  fetchThreadPages as fetchForumThreadPages,
  getPostContent,
} from './lib/printable-parser.ts'
import { rephraseTimedSellback } from './lib/obtain-formatting.ts'
import { repairAccessFlags } from './lib/access-flag-repair.ts'
import { getAccessorySubtypeStrategy } from './lib/accessories/index.ts'
import { extractAlsoSeeRefs, type ParsedAlsoSeeRef } from './lib/also-see.ts'
import type { FamilySourceRef, LevelVariant } from '../src/types/item.ts'
import type { AlsoSeeRef } from '../src/types/item.ts'
import type { GuestAttack } from '../src/types/pet.ts'
import {
  FORUM_BASE,
  fetchForumPage as fetchPage,
  loadForumCookie,
  sleep,
  withRetry,
} from './lib/forum.ts'
import {
  decodeHtml,
  normalizeStructuredText,
  slugify,
  stripSimpleHtml as stripHtml,
  uniqueStrings,
} from './lib/text.ts'
import { applyLimit, getArg, getConcurrencyArg, getLimitArg } from './lib/scraper-cli.ts'
import { processWithConcurrency } from './lib/work-queue.ts'

const ACCESSORIES_INDEX_URL = `${FORUM_BASE}/printable.asp?m=20985110`
const OUTPUT_DIR = path.resolve(import.meta.dirname, '../src/data')
const DELAY_MS = 900
const ACCESSORY_IMAGE_OVERRIDES: Record<string, string> = {
  "Baltael's Aventail":
    "https://github.com/DF-Pedia/DF-Pedia/raw/master/accessories/Baltael'sAventail.png",
  "Frost Moglin Knight's Cloak": 'https://i.imgur.com/StWTUCm.png',
  "Frost Moglin Knight's Helm": 'https://i.imgur.com/UWUlCbM.png',
  "Navigator's Hat":
    "https://github.com/DF-Pedia/DF-Pedia/raw/master/accessories/Navigator'sHat-CC.png",
}

type PriceType = Accessory['obtainMethods'][number]['priceType']
type AccessoryImageBundle = {
  imageUrl?: string
  alternativeImages?: Array<{ url: string; caption: string }>
}

interface AccessoryStub {
  name: string
  forumUrl: string
  messageId: string
  subtype: AccessorySubtype
}

interface SubtypeIndexRef {
  subtype: AccessorySubtype
  messageId: string
}

type AccessoryRefResolver = (refs: ParsedAlsoSeeRef[]) => AlsoSeeRef[]

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
    return loadForumCookie('accessory scraper')
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error))
  }
}

function accessorySlugForName(name: string): string {
  return `accessory-${slugify(normalizeAccessoryFamilyName(name))}`
}

function preserveStubVariantSuffix(stubName: string, title?: string): string | undefined {
  if (!title) return undefined
  const stubMatch = stubName.match(/^(.*?)\s*(\([^)]*\))\s*$/)
  if (!stubMatch) return title

  const suffix = stubMatch[2].trim()
  if (
    /\((?:All Versions|[IVXLCDM]+(?:\s*[-,]\s*[IVXLCDM]+)+|[IVXLCDM]+-[IVXLCDM]+)\)/i.test(suffix)
  ) {
    return title
  }

  const stubBaseName = normalizeAccessoryFamilyName(stubMatch[1]).toLowerCase()
  const titleBaseName = normalizeAccessoryFamilyName(title).toLowerCase()
  if (stubBaseName === titleBaseName && !title.endsWith(suffix)) {
    return `${title} ${suffix}`
  }

  return title
}

function getAccessoryImageOverride(name: string): string | undefined {
  return (
    ACCESSORY_IMAGE_OVERRIDES[normalizeAccessoryFamilyName(name)] ?? ACCESSORY_IMAGE_OVERRIDES[name]
  )
}

function getEntryDisplayName(entry: AccessoryEntry): string {
  return 'familyName' in entry ? entry.familyName : entry.name
}

function getInitialForName(name: string): string {
  const sortableName = titleSortKey(name)
  return /^[A-Z]/i.test(sortableName) ? sortableName[0].toUpperCase() : '#'
}

function isALInitial(name: string): boolean {
  const initial = getInitialForName(name)
  return initial >= 'A' && initial <= 'L'
}

function normalizeForumUrl(url: string): string {
  if (!url) return url
  if (url.startsWith('http')) return url
  return `${FORUM_BASE}/${url.replace(/^\.\//, '')}`
}

function createAccessoryRefResolver(stubs: AccessoryStub[]): AccessoryRefResolver {
  const stubByMessageId = new Map(stubs.map((stub) => [stub.messageId, stub]))
  const stubByName = new Map(
    stubs.map((stub) => [normalizeAccessoryFamilyName(stub.name).toLowerCase(), stub])
  )

  return (refs) => {
    const resolved = new Map<string, AlsoSeeRef>()

    for (const ref of refs) {
      const messageId = ref.url?.match(/[?&]m=(\d+)/i)?.[1]
      const targetStub =
        (messageId ? stubByMessageId.get(messageId) : undefined) ??
        stubByName.get(normalizeAccessoryFamilyName(ref.name).toLowerCase())
      const name = normalizeAccessoryFamilyName(targetStub?.name ?? ref.name)
      const slug = targetStub
        ? accessorySlugForName(targetStub.name)
        : accessorySlugForName(ref.name)
      const url = ref.url ? normalizeForumUrl(ref.url) : targetStub?.forumUrl
      const key = `${slug}|${url ?? ''}`

      if (resolved.has(key)) continue
      resolved.set(key, {
        name,
        slug,
        type: 'accessory',
        ...(url ? { url } : {}),
      })
    }

    return Array.from(resolved.values()).sort((a, b) => compareTitles(a.name, b.name))
  }
}

function getAccessoryDataFiles(meta: { dataFiles: string[] }): string[] {
  return meta.dataFiles
}

function entryBelongsInDataFile(entry: AccessoryEntry, dataFile: string): boolean {
  const name = getEntryDisplayName(entry)
  if (dataFile.endsWith('-a-l.json')) return isALInitial(name)
  if (dataFile.endsWith('-m-z.json')) return !isALInitial(name)
  return true
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
    findLastSection(
      html,
      /(?:<b>\s*)?Other [Ii]nformation\s*(?:<\/b>)?(?=\s*(?:<br\s*\/?>|\n))/gi
    ) ??
    findLastSection(html, /\bOther [Ii]nformation\b/gi)
  )
}

function getAccessoryLeadHtml(html: string): string {
  const firstFieldIndex =
    [
      /(?:<b>)?Level:(?:<\/b>)?/i,
      /(?:<b>)?Element:(?:<\/b>)?/i,
      /(?:<b>)?Location:(?:<\/b>)?/i,
      /(?:<b>)?Stats:(?:<\/b>)?/i,
      /(?:<b>)?Resists:(?:<\/b>)?/i,
      /<u>\s*Other [Ii]nformation\s*<\/u>/i,
      /(?:<b>\s*)?Other [Ii]nformation\s*:/i,
      /(?:<b>\s*)?Other [Ii]nformation\s*(?:<\/b>)?(?=\s*(?:<br\s*\/?>|\n))/i,
      /\bOther [Ii]nformation\b/i,
    ]
      .map((pattern) => html.search(pattern))
      .filter((index) => index >= 0)
      .sort((a, b) => a - b)[0] ?? html.length

  return html.slice(0, firstFieldIndex)
}

function normalizeSubtypeHeading(rawHeading: string): AccessorySubtype | undefined {
  const heading = rawHeading.toLowerCase()
  if (heading.startsWith('artifacts')) return 'artifact'
  if (heading.startsWith('belts')) return 'belt'
  if (heading.startsWith('bracers')) return 'bracer'
  if (heading.startsWith('capes & wings')) return 'cape-wing'
  if (heading.startsWith('helms')) return 'helm'
  if (heading.startsWith('necklaces')) return 'necklace'
  if (heading.startsWith('rings')) return 'ring'
  if (heading.startsWith('trinkets')) return 'trinket'
  return undefined
}

function parseElementCodes(value?: string): string[] {
  if (!value) return []
  const found = new Set<string>()

  for (const entry of elementPatterns) {
    if (entry.patterns.some((pattern) => pattern.test(value))) {
      found.add(entry.code)
    }
  }

  return [...found]
}

function parseFieldValue(text: string, labels: string[]): string | undefined {
  const escaped = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const match = text.match(new RegExp(`(?:^|\\n)(?:${escaped.join('|')}):\\s*([^\\n]+)`, 'i'))
  const value = match?.[1]?.trim()
  return value && !/^n\/a$/i.test(value) ? value : value
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

function parseAbilityInfo(html: string): { label?: string; url?: string } {
  const match = html.match(
    /(?:<b>\s*)?Ability:(?:\s*<\/b>)?\s*([\s\S]*?)(?=<br\s*\/?>|<\/span>|<b><u>|$)/i
  )
  if (!match) return {}

  const label = normalizeStructuredText(match[1])
    .replace(/\n+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
  const urlMatch = match[1].match(/<a[^>]+href="([^"]+)"[^>]*>/i)

  return {
    ...(label ? { label } : {}),
    ...(urlMatch?.[1] ? { url: urlMatch[1] } : {}),
  }
}

function parseDescription(html: string): string {
  const introHtml = getAccessoryLeadHtml(html)
  const italicMatches = [...introHtml.matchAll(/<i>([\s\S]*?)<\/i>/gi)]

  for (const match of italicMatches) {
    const text = normalizeStructuredText(match[1]).trim()
    if (!text) continue
    if (/thanks to/i.test(text)) continue
    return text
  }

  return ''
}

function parseNotes(html: string): string | undefined {
  const noteLines: string[] = []
  const otherInfoHtml = findOtherInformationSection(html)

  if (otherInfoHtml) {
    const trimmedSection = otherInfoHtml
      .split(/<i>Thanks to|Also See:|<font color='#eeeeee'>/i)[0]
      .replace(
        /<a[^>]+href=(["'])([^"']*?\.(?:png|jpg|jpeg|gif|bmp)(?:\?[^"']*)?)\1[^>]*>[\s\S]*?<\/a>/gi,
        ''
      )
      .replace(/<img[^>]+src="[^"]+\.(?:png|jpg|jpeg|gif|bmp)"[^>]*>/gi, '')
      .replace(/https?:\/\/[^\s"'<>]+\.(?:png|jpg|jpeg|gif|bmp)(?:\?[^\s"'<>]*)?/gi, '')

    for (const line of normalizeStructuredText(trimmedSection).split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      if (/\w+\s+--\s+\d+\/\d+\/\d+\s+\d+:\d+:\d+/.test(trimmed)) continue
      if (
        /^(?:clicked appearance|alternative image|alt(?:ernative)? appearance|appearance(?:\s+\d.*)?|2nd appearance)$/i.test(
          trimmed
        )
      )
        continue
      noteLines.push(trimmed)
    }
  }

  return noteLines.length > 0 ? noteLines.join('\n') : undefined
}

function buildTrinketAttackFromHtml(html: string, fallbackName: string): GuestAttack {
  const title = parseAccessoryTitle(html) ?? fallbackName
  const description = parseDescription(html) || undefined
  const requirements =
    parseHtmlField(html, ['Requirements', 'Level/Quest/Items required']) ??
    parseFieldValue(normalizeStructuredText(html), ['Requirements', 'Level/Quest/Items required'])
  const effectMatch = html.match(/Effect:\s*([\s\S]*?)(?=\s*Mana Cost:|<font color='#eeeeee'>|$)/i)
  let effect = effectMatch
    ? normalizeStructuredText(effectMatch[1])
        .split('\n')
        .map((line) => line.trimEnd())
        .filter((line) => {
          const trimmed = line.trim()
          return (
            trimmed.length > 0 &&
            !/^Mana Cost:/i.test(trimmed) &&
            !/^Cooldown:/i.test(trimmed) &&
            !/^(?:Damage|Attack) Type:/i.test(trimmed) &&
            !/^Element:/i.test(trimmed)
          )
        })
        .join('\n')
        .trim()
    : 'Unknown effect'

  const otherInfoHtml = findOtherInformationSection(html)
  if (otherInfoHtml) {
    const inlineOtherInfo = normalizeStructuredText(
      otherInfoHtml
        .split(/<i>Thanks to|<font color='#eeeeee'>/i)[0]
        .replace(/<img[^>]+src="[^"]+\.(?:png|jpg|jpeg|gif|bmp)"[^>]*>/gi, '')
    )
      .split('\n')
      .map((line) => line.trimEnd())
      .filter((line) => {
        const trimmed = line.trim()
        return (
          trimmed.length > 0 &&
          !/^appearance(?:\s+\d.*)?$/i.test(trimmed) &&
          !/^appearance$/i.test(trimmed)
        )
      })
      .join('\n')
      .trim()

    if (inlineOtherInfo) {
      effect = effect === 'Unknown effect' ? inlineOtherInfo : `${effect}\n${inlineOtherInfo}`
    }
  }

  const manaCost = parseHtmlField(html, ['Mana Cost']) ?? '—'
  const cooldown = parseHtmlField(html, ['Cooldown']) ?? '—'
  const damageType =
    parseHtmlField(html, ['Damage Type', 'Attack Type']) ??
    parseFieldValue(normalizeStructuredText(html), ['Damage Type', 'Attack Type']) ??
    '—'
  const element =
    parseHtmlField(html, ['Element']) ??
    parseFieldValue(normalizeStructuredText(html), ['Element']) ??
    '—'

  const buttonImageUrl = [...html.matchAll(/<img[^>]+src="([^"]+)"[^>]*>/gi)]
    .map((match) => match[1])
    .find(
      (src) =>
        /(?:github\.com\/DF-Pedia|githubusercontent\.com|imgur\.com)/i.test(src) &&
        !/Appearance/i.test(src)
    )

  const appearanceUrl = html.match(/<a[^>]+href="([^"]+)"[^>]*>([^<]*Appearance[^<]*)<\/a>/i)?.[1]

  return {
    name: title,
    ...(description ? { description } : {}),
    ...(requirements && requirements.toLowerCase() !== 'none' ? { requirements } : {}),
    effect,
    manaCost,
    cooldown,
    damageType,
    element,
    ...(buttonImageUrl ? { buttonImageUrl } : {}),
    ...(appearanceUrl ? { appearanceUrl } : {}),
  }
}

function splitTrinketAttackSections(html: string): string[] {
  const titleRegex = /<font[^>]*>\s*<b>[\s\S]*?<\/b>\s*<\/font>/gi
  const matches = [...html.matchAll(titleRegex)]
  if (matches.length <= 1) return [html]

  return matches.map((match, index) => {
    const start = match.index ?? 0
    const end = matches[index + 1]?.index ?? html.length
    return html.slice(start, end)
  })
}

function scoreTrinketAttackCandidate(
  candidate: GuestAttack,
  entryName: string,
  abilityName: string
): number {
  const haystacks = [
    candidate.name,
    candidate.description,
    candidate.requirements,
    candidate.effect,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  const accessoryNeedle = entryName.toLowerCase()
  const abilityNeedle = abilityName.toLowerCase()

  let score = 0
  if (candidate.requirements?.toLowerCase().includes(accessoryNeedle)) score += 8
  if (candidate.name.toLowerCase() === abilityNeedle) score += 4
  else if (candidate.name.toLowerCase().includes(abilityNeedle)) score += 2
  if (haystacks.includes(accessoryNeedle)) score += 3
  if (haystacks.includes(abilityNeedle)) score += 2
  return score
}

function getTrinketAttackDetailScore(candidate: GuestAttack): number {
  let score = 0
  if (candidate.effect && candidate.effect !== 'Unknown effect') score += 6
  if (candidate.buttonImageUrl) score += 4
  if (candidate.appearanceUrl) score += 2
  if (candidate.manaCost && candidate.manaCost !== '—') score += 2
  if (candidate.cooldown && candidate.cooldown !== '—') score += 2
  if (candidate.damageType && candidate.damageType !== '—') score += 1
  if (candidate.element && candidate.element !== '—') score += 1
  if (candidate.requirements) score += 1
  if (candidate.description) score += 1
  return score
}

function dedupeTrinketAttacks(candidates: GuestAttack[]): GuestAttack[] {
  const grouped = new Map<string, GuestAttack[]>()

  for (const candidate of candidates) {
    const key = candidate.name.trim().toLowerCase()
    const existing = grouped.get(key)
    if (existing) {
      existing.push(candidate)
    } else {
      grouped.set(key, [candidate])
    }
  }

  return Array.from(grouped.values()).map((group) => {
    if (group.length === 1) return group[0]

    return [...group].sort((a, b) => {
      return getTrinketAttackDetailScore(b) - getTrinketAttackDetailScore(a)
    })[0]
  })
}

function parseTrinketAttacks(html: string, fallbackName: string, entryName: string): GuestAttack[] {
  const sections = splitTrinketAttackSections(html)
  const candidates = sections
    .map((section) => buildTrinketAttackFromHtml(section, fallbackName))
    .filter((candidate) => candidate.name || candidate.effect)

  if (candidates.length <= 1) return candidates

  const ranked = candidates
    .map((candidate) => ({
      candidate,
      score: scoreTrinketAttackCandidate(candidate, entryName, fallbackName),
    }))
    .sort((a, b) => b.score - a.score)

  const bestScore = ranked[0]?.score ?? 0
  if (bestScore <= 0) return dedupeTrinketAttacks([ranked[0].candidate])
  return dedupeTrinketAttacks(
    ranked.filter((item) => item.score === bestScore).map((item) => item.candidate)
  )
}

function parseObtainMethods(html: string): Accessory['obtainMethods'] {
  const obtainMethods: Accessory['obtainMethods'] = []
  const firstFieldIndex =
    [
      /(?:<b>)?Level:(?:<\/b>)?/i,
      /(?:<b>)?Element:(?:<\/b>)?/i,
      /(?:<b>)?Stats:(?:<\/b>)?/i,
      /(?:<b>)?Resists:(?:<\/b>)?/i,
      /<u>Other [Ii]nformation<\/u>/i,
    ]
      .map((pattern) => html.search(pattern))
      .filter((index) => index >= 0)
      .sort((a, b) => a - b)[0] ?? html.length

  const introHtml = html
    .slice(0, firstFieldIndex)
    .replace(
      /<b>\s*<font[^>]*>\s*(Location|Requirements|Level\/Quest\/Items to unlock|Price|Sellback|Required Items?|Required|Requires):\s*<\/font>\s*<\/b>/gi,
      '<b>$1:</b>'
    )
    .replace(
      /(?:^|\s)(Location|Requirements|Level\/Quest\/Items to unlock|Price|Sellback|Required Items?|Required|Requires):/gi,
      ' <b>$1:</b>'
    )

  const blocks: Array<{
    location?: string
    requirements?: string
    price?: string
    sellback?: string
    requiredItems?: string
    daRequired: boolean
    dcRequired: boolean
    dmRequired: boolean
  }> = []

  const headerRegex =
    /(?:<img[^>]+src=["'][^"']*\/tags\/(?:DA|DC|DM)\.(?:png|jpg|jpeg|gif)["'][^>]*>\s*)*(?:<font[^>]*>\s*<b>[\s\S]*?<\/b>\s*<\/font>|<b>\s*<font[^>]*>[\s\S]*?<\/font>\s*<\/b>)/gi
  const headerMatches = [...introHtml.matchAll(headerRegex)]
  const segments =
    headerMatches.length > 1
      ? headerMatches.map((match, index) => {
          const start = match.index ?? 0
          const end = headerMatches[index + 1]?.index ?? introHtml.length
          return introHtml.slice(start, end)
        })
      : [introHtml]

  for (const segment of segments) {
    let current: (typeof blocks)[number] | undefined
    const rawLines = segment
      .split(/<br\s*\/?>/i)
      .map((line) => line.trim())
      .filter(Boolean)

    for (const rawLine of rawLines) {
      const hasDA = /<img[^>]+src=["'][^"']*\/tags\/DA\.(?:png|jpg|jpeg|gif)["']/i.test(rawLine)
      const hasDC = /<img[^>]+src=["'][^"']*\/tags\/DC\.(?:png|jpg|jpeg|gif)["']/i.test(rawLine)
      const hasDM = /<img[^>]+src=["'][^"']*\/tags\/DM\.(?:png|jpg|jpeg|gif)["']/i.test(rawLine)
      const fieldMatch = rawLine.match(
        /<b>(Location|Requirements|Level\/Quest\/Items to unlock|Price|Sellback|Required Items?|Required|Requires):<\/b>\s*([\s\S]*)/i
      )
      if (!fieldMatch) continue

      const fieldName = fieldMatch[1].toLowerCase()
      const value = normalizeStructuredText(fieldMatch[2])
        .replace(/\n+/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim()
      if (!value) continue

      if (fieldName === 'location') {
        current = {
          location: value,
          daRequired: hasDA || /this item requires a dragon amulet/i.test(segment),
          dcRequired: hasDC,
          dmRequired: hasDM,
        }
        blocks.push(current)
        continue
      }

      if (!current) {
        current = {
          daRequired: hasDA,
          dcRequired: hasDC,
          dmRequired: hasDM,
        }
        blocks.push(current)
      }

      current.daRequired ||= hasDA
      current.dcRequired ||= hasDC
      current.dmRequired ||= hasDM

      if (fieldName === 'requirements' || fieldName === 'level/quest/items to unlock') {
        current.requirements = value
      } else if (fieldName === 'price') {
        current.price = value
      } else if (fieldName === 'sellback') {
        current.sellback = value
      } else if (
        fieldName === 'required item' ||
        fieldName === 'required items' ||
        fieldName === 'required' ||
        fieldName === 'requires'
      ) {
        current.requiredItems = value
      }
    }
  }

  for (const block of blocks) {
    if (!block.location) continue
    const price = block.price?.trim() || 'N/A'
    const priceType: PriceType = computePriceType(price, block.requiredItems)
    const methodDetails = {
      location: block.location,
      price,
      priceType,
      ...(block.sellback ? { sellback: rephraseTimedSellback(block.sellback) } : {}),
      ...(block.requiredItems ? { requiredItems: block.requiredItems } : {}),
      ...(block.requirements && !/^none$/i.test(block.requirements)
        ? { requirements: block.requirements }
        : {}),
      ...(block.dmRequired || priceType === 'dm' ? { dmRequired: true } : {}),
    }
    const inferredDC =
      block.dcRequired || obtainVariantHasDC({ ...methodDetails, daRequired: block.daRequired })
    obtainMethods.push({
      ...methodDetails,
      daRequired: inferredDC ? false : block.daRequired,
      ...(inferredDC ? { dcRequired: true } : {}),
    })
  }

  return obtainMethods
}

function extractAccessoryImages(html: string): AccessoryImageBundle {
  const skipPatterns = [
    /\/f\/image\//i,
    /^image\//i,
    /^micons\//i,
    /forumheader/i,
    /quantserve/i,
    /artix\.com\/shared/i,
    /artixgamelaunch/i,
    /\/tags\//i,
    /clear\.gif/i,
    /blank\.gif/i,
    /face\.gif/i,
    /pm\.gif/i,
    /address\.gif/i,
    /block\.gif/i,
    /asc\.gif/i,
    /print\.gif/i,
    /icon\d*\.gif/i,
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
    ].map((match) => ({
      url: normalizeImageUrl(match[0]),
    })),
  ].filter((candidate) => isCandidateImage(candidate.url))

  const seenImageUrls = new Set<string>()
  const uniqueImageCandidates = imageCandidates.filter((candidate) => {
    if (seenImageUrls.has(candidate.url)) return false
    seenImageUrls.add(candidate.url)
    return true
  })
  const preferredImageCandidates = uniqueImageCandidates.filter(
    (candidate) => !/forums2\.battleon\.com\/f\/upfiles\//i.test(candidate.url)
  )
  const displayImageCandidates =
    preferredImageCandidates.length > 0 ? preferredImageCandidates : uniqueImageCandidates
  const imageUrl = displayImageCandidates[0]?.url

  const alternativeImages: Array<{ url: string; caption: string }> = []
  if (imageUrl) {
    for (const [index, candidate] of displayImageCandidates.entries()) {
      if (candidate.url === imageUrl) continue
      const caption = candidate.caption?.trim() || `Alternative ${index}`
      alternativeImages.push({ url: candidate.url, caption })
    }
  }

  return {
    ...(imageUrl ? { imageUrl } : {}),
    ...(alternativeImages.length > 0 ? { alternativeImages } : {}),
  }
}

function parseTagFlags(html: string) {
  const leadHtml = getAccessoryLeadHtml(html)
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

function hasMultipleVersionHint(name: string): boolean {
  return (
    /\((?:All Versions|[IVX]+(?:\s*[-,]\s*[IVX]+)+|[IVX]+-[IVX]+)\)/i.test(name) ||
    hasAccessoryFormVariantHint(name)
  )
}

function shouldInspectThreadForSubtype(subtype: AccessorySubtype): boolean {
  return subtype === 'helm' || subtype === 'cape-wing'
}

function hasAccessoryFormVariantHint(name: string): boolean {
  const match = name.match(/\(([^)]+)\)/)
  if (!match) return false

  const forms = match[1]
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
  if (forms.length === 0) return false

  const knownForms = new Set(['mask', 'head', 'helm', 'hood', 'cowl'])
  return forms.every((form) => knownForms.has(form))
}

function parseAccessoryTitle(html: string): string | undefined {
  const match =
    html.match(/<font[^>]*>\s*<b>([\s\S]*?)<\/b>\s*<\/font>/i) ?? html.match(/<b>([\s\S]*?)<\/b>/i)

  const title = match ? normalizeStructuredText(match[1]).trim() : ''
  return title || undefined
}

function normalizeAccessoryFamilyName(name: string): string {
  return name
    .replace(
      /\s*\((?:All Versions|[IVXLCDM]+(?:\s*[-,]\s*[IVXLCDM]+)+|[IVXLCDM]+-[IVXLCDM]+)\)\s*/i,
      ' '
    )
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function deriveAccessoryVariantName(name: string, familyName: string): string | undefined {
  const normalizedName = name.trim()
  const trailingGroupMatch = familyName.match(/^(.*?)(\s*\([^)]*\))$/)
  if (trailingGroupMatch) {
    const prefix = trailingGroupMatch[1].trim()
    const suffix = trailingGroupMatch[2].trim()
    if (normalizedName.startsWith(prefix) && normalizedName.endsWith(suffix)) {
      const middle = normalizedName
        .slice(prefix.length, normalizedName.length - suffix.length)
        .trim()
      if (middle) return middle
    }
  }

  if (normalizedName.startsWith(`${familyName} `)) {
    const remainder = normalizedName.slice(familyName.length).trim()
    if (remainder) return remainder
  }

  return undefined
}

function mergeAccessoryAlsoSee(variants: Accessory[], familySlug: string): AlsoSeeRef[] {
  const variantSlugs = new Set(variants.map((variant) => variant.slug))
  const refs = new Map<string, AlsoSeeRef>()

  for (const ref of variants.flatMap((variant) => variant.alsoSee ?? [])) {
    if (ref.slug === familySlug || variantSlugs.has(ref.slug)) continue
    refs.set(`${ref.type}:${ref.slug}:${ref.url ?? ''}`, ref)
  }

  return Array.from(refs.values()).sort((a, b) => compareTitles(a.name, b.name))
}

function mergeAlternativeImages(
  first?: Array<{ url: string; caption: string }>,
  second?: Array<{ url: string; caption: string }>
) {
  const merged = [...(first ?? []), ...(second ?? [])]
  const seen = new Set<string>()
  return merged.filter((image) => {
    const key = `${image.url}::${image.caption}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function mergeObtainMethods(methods: Accessory['obtainMethods']): Accessory['obtainMethods']
function mergeObtainMethods(
  methods: Array<Accessory['obtainMethods'][number]>
): Array<Accessory['obtainMethods'][number]> {
  const seen = new Set<string>()
  return methods.filter((method) => {
    const key = JSON.stringify(method)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function parseNumericLevel(level?: string): number | undefined {
  if (!level) return undefined
  const trimmed = level.trim()
  if (/^\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10)
  return undefined
}

function romanToNumber(value: string): number {
  const romanValues: Record<string, number> = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
    D: 500,
    M: 1000,
  }

  let total = 0
  const upper = value.toUpperCase()
  for (let index = 0; index < upper.length; index += 1) {
    const current = romanValues[upper[index]] ?? 0
    const next = romanValues[upper[index + 1]] ?? 0
    total += next > current ? -current : current
  }
  return total
}

function numberToRoman(value: number): string {
  const numerals: Array<[number, string]> = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ]

  let remaining = value
  let output = ''
  for (const [amount, roman] of numerals) {
    while (remaining >= amount) {
      output += roman
      remaining -= amount
    }
  }
  return output
}

function getExpectedRomanVariants(name: string): string[] {
  const group = name.match(/\(([^)]*)\)/)?.[1]
  if (!group || !/^[IVXLCDM,\s-]+$/i.test(group)) return []

  const rangeMatch = group.match(/^\s*([IVXLCDM]+)\s*-\s*([IVXLCDM]+)\s*$/i)
  if (rangeMatch) {
    const start = romanToNumber(rangeMatch[1])
    const end = romanToNumber(rangeMatch[2])
    if (!start || !end || end < start) return []
    return Array.from({ length: end - start + 1 }, (_, index) => numberToRoman(start + index))
  }

  return group
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter((value) => /^[IVXLCDM]+$/.test(value))
}

function allSame<T>(values: T[]): boolean {
  if (values.length <= 1) return true
  return values.every((value) => JSON.stringify(value) === JSON.stringify(values[0]))
}

function getAccessoryVariantCompletenessScore(variant: Accessory): number {
  return (
    [
      variant.level,
      variant.stats,
      variant.resists,
      variant.ability,
      variant.rarity,
      variant.itemType,
      variant.equipSpot,
      variant.modifies,
      variant.category,
      variant.imageUrl,
      variant.description,
      variant.notes,
    ].filter(Boolean).length +
    variant.elements.length +
    variant.obtainMethods.length +
    (variant.alternativeImages?.length ?? 0) +
    (variant.attacks?.length ?? 0)
  )
}

function enrichAccessorySiblingVariants(variants: Accessory[]): Accessory[] {
  const grouped = new Map<string, Accessory[]>()

  for (const variant of variants) {
    const levelKey = variant.level?.trim().toLowerCase()
    if (!levelKey) {
      const passthroughKey = `${variant.name.trim().toLowerCase()}::__unique__${variant.slug}`
      grouped.set(passthroughKey, [variant])
      continue
    }

    const key = `${variant.name.trim().toLowerCase()}::${levelKey}`
    const existing = grouped.get(key)
    if (existing) {
      existing.push(variant)
    } else {
      grouped.set(key, [variant])
    }
  }

  return Array.from(grouped.values()).flatMap((group) => {
    if (group.length === 1) return group

    const sorted = [...group].sort(
      (a, b) => getAccessoryVariantCompletenessScore(b) - getAccessoryVariantCompletenessScore(a)
    )
    const primary = sorted[0]

    return sorted.map((variant) => ({
      ...variant,
      description:
        getAccessoryVariantCompletenessScore(primary) >
          getAccessoryVariantCompletenessScore(variant) && primary.description
          ? primary.description
          : variant.description || primary.description,
      forumUrl: variant.forumUrl || primary.forumUrl,
      imageUrl: variant.imageUrl ?? primary.imageUrl,
      alternativeImages: mergeAlternativeImages(
        variant.alternativeImages,
        primary.alternativeImages
      ),
      elements: Array.from(new Set([...variant.elements, ...primary.elements])),
      level: variant.level ?? primary.level,
      stats: variant.stats ?? primary.stats,
      resists: variant.resists ?? primary.resists,
      ability: variant.ability ?? primary.ability,
      abilityUrl: variant.abilityUrl ?? primary.abilityUrl,
      attacks: variant.attacks ?? primary.attacks,
      rarity: variant.rarity ?? primary.rarity,
      itemType: variant.itemType ?? primary.itemType,
      equipSpot: variant.equipSpot ?? primary.equipSpot,
      modifies: variant.modifies ?? primary.modifies,
      category: variant.category ?? primary.category,
      notes:
        variant.notes && primary.notes && variant.notes !== primary.notes
          ? `${variant.notes}\n${primary.notes}`
          : (variant.notes ?? primary.notes),
      tags: Array.from(new Set([...variant.tags, ...primary.tags])).sort(),
      daRequired: variant.daRequired || primary.daRequired,
      ...(variant.dcRequired || primary.dcRequired ? { dcRequired: true } : {}),
      ...(variant.dmRequired || primary.dmRequired ? { dmRequired: true } : {}),
      ...(variant.isTemp || primary.isTemp ? { isTemp: true } : {}),
      ...(variant.isRare || primary.isRare ? { isRare: true } : {}),
      ...(variant.isSeasonal || primary.isSeasonal ? { isSeasonal: true } : {}),
      ...(variant.isSpecialOffer || primary.isSpecialOffer ? { isSpecialOffer: true } : {}),
      ...(variant.retired || primary.retired ? { retired: true } : {}),
      obtainMethods: mergeObtainMethods(variant.obtainMethods),
    }))
  })
}

function expandAccessoryFamilyVariants(variants: Accessory[]): Accessory[] {
  return variants.flatMap((variant) => {
    if (variant.obtainMethods.length <= 1) return [variant]

    return variant.obtainMethods.map((method) => {
      const { dcRequired: _dcRequired, dmRequired: _dmRequired, ...baseVariant } = variant

      return {
        ...baseVariant,
        obtainMethods: [method],
        daRequired: method.daRequired,
        ...(method.dcRequired || method.priceType === 'dc' ? { dcRequired: true } : {}),
        ...(method.dmRequired || method.priceType === 'dm' ? { dmRequired: true } : {}),
        tags: Array.from(
          new Set([
            ...variant.tags.filter((tag) => !['free', 'merge', 'gold', 'dc', 'dm'].includes(tag)),
            method.priceType,
          ])
        ).sort(),
      }
    })
  })
}

function buildAccessoryEntry(
  stub: AccessoryStub,
  html: string,
  resolveAlsoSee: AccessoryRefResolver,
  override?: { name?: string; forumUrl?: string }
): Accessory {
  const normalizedText = normalizeStructuredText(html)
  const flags = parseTagFlags(html)
  const textSignals = {
    daRequired:
      /this item requires a dragon amulet/i.test(normalizedText) &&
      !/\(no da required\)/i.test(normalizedText),
  }
  const obtainMethods = parseObtainMethods(html).map((method) => ({
    ...method,
    daRequired: method.daRequired || flags.daRequired || textSignals.daRequired,
    ...(flags.dcRequired || method.dcRequired ? { dcRequired: true } : {}),
    ...(flags.dmRequired || method.dmRequired ? { dmRequired: true } : {}),
  }))
  const explicitElement =
    parseHtmlField(html, ['Element']) ?? parseFieldValue(normalizedText, ['Element'])
  const parsedElements = parseElementCodes(explicitElement)
  const firstMethod = obtainMethods[0]
  const primaryPriceType = firstMethod?.priceType
  const levelValue = parseHtmlField(html, ['Level']) ?? parseFieldValue(normalizedText, ['Level'])
  const statsValue =
    parseHtmlField(html, ['Stats', 'Bonuses']) ??
    parseFieldValue(normalizedText, ['Stats', 'Bonuses'])
  const resistsValue =
    parseHtmlField(html, ['Resists', 'Resistances']) ??
    parseFieldValue(normalizedText, ['Resists', 'Resistances'])
  const abilityInfo = parseAbilityInfo(html)
  const abilityValue =
    abilityInfo.label ??
    parseHtmlField(html, ['Ability']) ??
    parseFieldValue(normalizedText, ['Ability'])
  const rarityValue =
    parseHtmlField(html, ['Rarity']) ?? parseFieldValue(normalizedText, ['Rarity'])
  const itemTypeValue =
    parseHtmlField(html, ['Item Type']) ?? parseFieldValue(normalizedText, ['Item Type'])
  const equipSpotValue =
    parseHtmlField(html, ['Equip Spot', 'Equip Slot']) ??
    parseFieldValue(normalizedText, ['Equip Spot', 'Equip Slot'])
  const modifiesValue =
    parseHtmlField(html, ['Modifies']) ?? parseFieldValue(normalizedText, ['Modifies'])
  const categoryValue =
    parseHtmlField(html, ['Category']) ?? parseFieldValue(normalizedText, ['Category'])
  const strategy = getAccessorySubtypeStrategy(stub.subtype)
  const images = strategy.shouldExtractImages({
    name: override?.name ?? stub.name,
    subtype: stub.subtype,
    itemType: itemTypeValue,
    equipSpot: equipSpotValue,
  })
    ? extractAccessoryImages(html)
    : {}
  const imageOverride = getAccessoryImageOverride(override?.name ?? stub.name)
  const alsoSee = resolveAlsoSee(extractAlsoSeeRefs(html))

  return {
    id: `accessory-${slugify(override?.name ?? stub.name)}`,
    name: override?.name ?? stub.name,
    slug: `accessory-${slugify(override?.name ?? stub.name)}`,
    type: 'accessory',
    subtype: stub.subtype,
    description: parseDescription(html),
    forumUrl: override?.forumUrl ?? stub.forumUrl,
    releaseDate: '',
    ...(imageOverride || images.imageUrl ? { imageUrl: imageOverride ?? images.imageUrl } : {}),
    ...(images.alternativeImages ? { alternativeImages: images.alternativeImages } : {}),
    elements: parsedElements,
    ...(levelValue ? { level: levelValue } : {}),
    ...(statsValue ? { stats: statsValue } : {}),
    ...(resistsValue ? { resists: resistsValue } : {}),
    ...(abilityValue ? { ability: abilityValue } : {}),
    ...(abilityInfo.url ? { abilityUrl: abilityInfo.url } : {}),
    ...(rarityValue ? { rarity: rarityValue } : {}),
    ...(itemTypeValue ? { itemType: itemTypeValue } : {}),
    ...(equipSpotValue ? { equipSpot: equipSpotValue } : {}),
    ...(modifiesValue ? { modifies: modifiesValue } : {}),
    ...(categoryValue ? { category: categoryValue } : {}),
    obtainMethods,
    ...(parseNotes(html) ? { notes: parseNotes(html) } : {}),
    ...(alsoSee.length > 0 ? { alsoSee } : {}),
    tags: [
      ...parsedElements.map((code) => code.toLowerCase()),
      ...(primaryPriceType ? [primaryPriceType] : []),
    ],
    daRequired:
      flags.daRequired ||
      textSignals.daRequired ||
      obtainMethods.some((method) => method.daRequired),
    ...(flags.dcRequired || obtainMethods.some((method) => method.dcRequired)
      ? { dcRequired: true }
      : {}),
    ...(flags.dmRequired || obtainMethods.some((method) => method.dmRequired)
      ? { dmRequired: true }
      : {}),
    ...(flags.isTemp ? { isTemp: true } : {}),
    ...(flags.isRare ? { isRare: true } : {}),
    ...(flags.isSeasonal ? { isSeasonal: true } : {}),
    ...(flags.isSpecialOffer ? { isSpecialOffer: true } : {}),
    ...(flags.retired ? { retired: true } : {}),
  }
}

async function enrichAccessoryAbility(entry: Accessory, cookie: string): Promise<Accessory> {
  const strategy = getAccessorySubtypeStrategy(entry.subtype)
  if (!strategy.shouldEnrichAbility(entry)) return entry

  const abilityUrl = entry.abilityUrl
  if (!abilityUrl) return entry

  const abilityMessageId = abilityUrl.match(/m=(\d+)/i)?.[1]
  if (!abilityMessageId) return entry

  try {
    const abilityHtml = await fetchPostContent(abilityMessageId, cookie)
    const attacks = parseTrinketAttacks(abilityHtml, entry.ability ?? entry.name, entry.name)
    if (attacks.length === 0) return entry
    return {
      ...entry,
      attacks,
    }
  } catch {
    return entry
  }
}

function buildAccessoryFamily(
  stub: AccessoryStub,
  variants: Accessory[],
  fallbackImages: AccessoryImageBundle = {},
  fallbackNotes?: string
): AccessoryFamily {
  const consolidatedVariants = expandAccessoryFamilyVariants(
    enrichAccessorySiblingVariants(variants)
  )
  const familyName = normalizeAccessoryFamilyName(stub.name)
  const familySlug = accessorySlugForName(familyName)
  const imageOverride = getAccessoryImageOverride(familyName)
  const expectedRomanVariants = getExpectedRomanVariants(stub.name)
  const descriptions = uniqueStrings(
    consolidatedVariants.map((variant) => variant.description).filter(Boolean)
  )
  const resists = uniqueStrings(
    consolidatedVariants.map((variant) => variant.resists).filter(Boolean)
  )
  const abilities = uniqueStrings(
    consolidatedVariants.map((variant) => variant.ability).filter(Boolean)
  )
  const attacks = consolidatedVariants
    .map((variant) => variant.attacks)
    .filter((value): value is GuestAttack[] => Boolean(value))
  const images = uniqueStrings(
    consolidatedVariants.map((variant) => variant.imageUrl).filter(Boolean)
  )
  const alternativeImages = consolidatedVariants
    .map((variant) => variant.alternativeImages)
    .filter((value): value is NonNullable<Accessory['alternativeImages']> => Boolean(value))
  const sharedImageUrl =
    imageOverride ?? fallbackImages.imageUrl ?? (images.length === 1 ? images[0] : undefined)
  const sharedAlternativeImages =
    fallbackImages.alternativeImages ??
    (alternativeImages.length === 1 ? alternativeImages[0] : undefined)
  const rarities = uniqueStrings(
    consolidatedVariants.map((variant) => variant.rarity).filter(Boolean)
  )
  const modifies = uniqueStrings(
    consolidatedVariants.map((variant) => variant.modifies).filter(Boolean)
  )
  const alsoSee = mergeAccessoryAlsoSee(consolidatedVariants, familySlug)
  const notes = uniqueStrings(consolidatedVariants.map((variant) => variant.notes).filter(Boolean))
  const sharedNotes = fallbackNotes ?? (notes.length === 1 ? notes[0] : undefined)

  const levelVariants: LevelVariant[] = consolidatedVariants
    .map((variant, index) => {
      const normalizedLevel = normalizeLevel(variant.level ?? String(index + 1))
      const actualLevel = parseNumericLevel(variant.level)
      const derivedVariantName = deriveAccessoryVariantName(variant.name, familyName)
      const variantName =
        derivedVariantName ??
        (expectedRomanVariants[0] === 'I' && variant.name.trim() === familyName ? 'I' : undefined)
      const displayLevel = String(actualLevel ?? normalizedLevel.display)
      const resolvedVariantName =
        variantName && variantName !== normalizedLevel.display && variantName !== displayLevel
          ? variantName
          : undefined

      return {
        levelNumber: normalizedLevel.number,
        levelDisplay: normalizedLevel.display,
        ...(actualLevel !== undefined ? { actualLevel } : {}),
        ...(resolvedVariantName ? { variantName: resolvedVariantName } : {}),
        name: variant.name,
        damage: '',
        stats: variant.stats ?? 'None',
        obtainVariants: variant.obtainMethods,
        sourceUrl: variant.forumUrl,
        ...(variant.description ? { description: variant.description } : {}),
        ...(variant.imageUrl ? { imageUrl: variant.imageUrl } : {}),
        ...(variant.alternativeImages ? { alternativeImages: variant.alternativeImages } : {}),
        ...(variant.elements[0] ? { element: variant.elements[0] } : {}),
        ...(variant.resists ? { resists: variant.resists } : {}),
        ...(variant.attacks ? { attacks: variant.attacks } : {}),
        ...(variant.rarity ? { rarity: variant.rarity } : {}),
        ...(variant.notes ? { notes: variant.notes } : {}),
      }
    })
    .sort((a, b) => {
      const aLevel = a.actualLevel ?? a.levelNumber
      const bLevel = b.actualLevel ?? b.levelNumber
      return aLevel - bLevel || compareTitles(a.name, b.name)
    })

  const familySources: FamilySourceRef[] = variants.map((variant, index) => ({
    url: variant.forumUrl,
    title: `DF Encyclopedia: ${variant.name}`,
    variantLabel: variant.name,
    isPrimary: index === 0,
  }))

  const family = computeFamilyFlags({
    id: familySlug,
    familyName,
    slug: familySlug,
    aliasSlugs: variants.map((variant) => variant.slug),
    type: 'accessory',
    subtype: stub.subtype,
    forumUrl: stub.forumUrl,
    familyOrigin: 'same-thread-multi-post',
    familySources,
    shared: {
      description: allSame(descriptions) ? (descriptions[0] ?? '') : (descriptions[0] ?? ''),
      ...(resists.length === 1 ? { resists: resists[0] } : {}),
      ...(abilities.length === 1 ? { ability: abilities[0] } : {}),
      ...(attacks.length > 0 && allSame(attacks) ? { attacks: attacks[0] } : {}),
      ...(sharedImageUrl ? { imageUrl: sharedImageUrl } : {}),
      ...(sharedAlternativeImages ? { alternativeImages: sharedAlternativeImages } : {}),
      ...(rarities.length === 1 ? { rarity: rarities[0] } : {}),
      ...(sharedNotes ? { notes: sharedNotes } : {}),
      ...(alsoSee.length > 0 ? { alsoSee } : {}),
    },
    levelVariants,
    itemType: consolidatedVariants.find((variant) => variant.itemType)?.itemType,
    equipSlot: consolidatedVariants.find((variant) => variant.equipSpot)?.equipSpot,
    modifies:
      modifies.length === 1
        ? modifies[0]
        : consolidatedVariants.find((variant) => variant.modifies)?.modifies,
    category: consolidatedVariants.find((variant) => variant.category)?.category,
    releaseDate: consolidatedVariants.find((variant) => variant.releaseDate)?.releaseDate ?? '',
    tags: Array.from(new Set(consolidatedVariants.flatMap((variant) => variant.tags))).sort(),
    isTemp: consolidatedVariants.some((variant) => variant.isTemp) || undefined,
    isRare: consolidatedVariants.some((variant) => variant.isRare) || undefined,
    isSeasonal: consolidatedVariants.some((variant) => variant.isSeasonal) || undefined,
    isSpecialOffer: consolidatedVariants.some((variant) => variant.isSpecialOffer) || undefined,
    retired: consolidatedVariants.some((variant) => variant.retired) || undefined,
    hasDA: false,
    hasDC: false,
    hasDM: false,
    hasFree: false,
    hasMerge: false,
    levelRange: '',
    elements: Array.from(new Set(consolidatedVariants.flatMap((variant) => variant.elements))),
  })

  family.shared.description = allSame(descriptions) ? (descriptions[0] ?? '') : ''
  if (!family.shared.description) {
    const firstDescription = consolidatedVariants.find(
      (variant) => variant.description
    )?.description
    family.shared.description = firstDescription ?? ''
  }

  if (family.familyName === 'Harmonized Cowbell') {
    const binaryVariants = uniqueStrings(
      levelVariants.map((variant) => variant.variantName)
    ).filter((variant) => /^[01]+$/.test(variant))
    if (binaryVariants.length >= 2) {
      family.levelRange = `${binaryVariants[0]}-${binaryVariants.at(-1)}`
    }
  }

  return family
}

async function buildAccessoryOrFamily(
  stub: AccessoryStub,
  cookie: string,
  resolveAlsoSee: AccessoryRefResolver
): Promise<AccessoryEntry> {
  const hasExplicitThreadHint = hasMultipleVersionHint(stub.name)
  const shouldInspectThread = hasExplicitThreadHint || shouldInspectThreadForSubtype(stub.subtype)
  if (shouldInspectThread) {
    const threadHtml = await withRetry(`thread ${stub.messageId}`, () =>
      fetchForumThreadPages(stub.messageId, cookie)
    )
    const threadPosts = extractThreadPostContents(threadHtml)
    const variants: Accessory[] = []
    const strategy = getAccessorySubtypeStrategy(stub.subtype)
    const messageHtml = threadPosts.map((post) => post.html).join('\n')
    const fallbackImages = strategy.shouldExtractImages({ name: stub.name, subtype: stub.subtype })
      ? extractAccessoryImages(messageHtml)
      : {}
    const threadNotes = uniqueStrings([parseNotes(messageHtml)].filter(Boolean))

    for (const post of threadPosts) {
      let html: string
      try {
        html = await fetchPostContent(post.messageId, cookie)
      } catch {
        html = post.html
      }
      if (!html) continue
      const postNotes = parseNotes(html)
      if (postNotes) threadNotes.push(postNotes)
      const title = preserveStubVariantSuffix(stub.name, parseAccessoryTitle(html))
      if (!title) continue

      const variant = await enrichAccessoryAbility(
        buildAccessoryEntry(stub, html, resolveAlsoSee, {
          name: title,
          forumUrl: post.sourceUrl,
        }),
        cookie
      )

      if (!variant.level && !variant.stats && variant.obtainMethods.length === 0) continue
      if (
        !hasExplicitThreadHint &&
        normalizeAccessoryFamilyName(variant.name) !== normalizeAccessoryFamilyName(stub.name)
      ) {
        continue
      }
      variants.push(variant)
      await sleep(Math.round(DELAY_MS / 2))
    }

    if (variants.length > 1) {
      const fallbackNotes = uniqueStrings(threadNotes).join('\n') || undefined
      return buildAccessoryFamily(stub, variants, fallbackImages, fallbackNotes)
    }
  }

  const html = await fetchPostContent(stub.messageId, cookie)
  const title = parseAccessoryTitle(html)
  const resolvedTitle =
    title && /\(Retired\)/i.test(stub.name) && !/\(Retired\)/i.test(title)
      ? `${title} (Retired)`
      : preserveStubVariantSuffix(stub.name, title)
  const entry = await enrichAccessoryAbility(
    buildAccessoryEntry(
      stub,
      html,
      resolveAlsoSee,
      resolvedTitle ? { name: resolvedTitle } : undefined
    ),
    cookie
  )
  const strategy = getAccessorySubtypeStrategy(stub.subtype)
  if (
    strategy.shouldExtractImages({
      name: entry.name,
      subtype: entry.subtype,
      itemType: entry.itemType,
      equipSpot: entry.equipSpot,
    }) &&
    !entry.imageUrl &&
    !entry.alternativeImages?.length
  ) {
    const threadHtml = await withRetry(`thread ${stub.messageId}`, () =>
      fetchForumThreadPages(stub.messageId, cookie)
    )
    const messageHtml = extractThreadPostContents(threadHtml)
      .map((post) => post.html)
      .join('\n')
    const fallbackImages = extractAccessoryImages(messageHtml)
    return {
      ...entry,
      ...(fallbackImages.imageUrl ? { imageUrl: fallbackImages.imageUrl } : {}),
      ...(fallbackImages.alternativeImages
        ? { alternativeImages: fallbackImages.alternativeImages }
        : {}),
    }
  }

  return entry
}

function extractReplyPostContent(html: string, messageId: string): string {
  const anchorRegex = new RegExp(`<a\\s+name=${messageId}\\b[^>]*><\\/a>`, 'i')
  const anchorMatch = anchorRegex.exec(html)
  if (!anchorMatch || anchorMatch.index === undefined) {
    throw new Error(`Could not find reply anchor for message ${messageId}`)
  }

  const slice = html.slice(anchorMatch.index)
  const cellMatch = slice.match(/<td\b[^>]*class=["']?msg["']?[^>]*>([\s\S]*?)<\/td>/i)
  if (!cellMatch) {
    throw new Error(`Could not find reply content block for message ${messageId}`)
  }

  return convertImageTags(cellMatch[1])
}

async function fetchPostContent(messageId: string, cookie: string): Promise<string> {
  try {
    return getPostContent(
      await withRetry(`printable ${messageId}`, () => fetchPrintable(messageId, cookie))
    )
  } catch (error) {
    if (!(error instanceof Error) || !/HTTP 500/i.test(error.message)) {
      throw error
    }

    const forumHtml = await fetchPage(`${FORUM_BASE}/fb.asp?m=${messageId}`, cookie)
    return extractReplyPostContent(forumHtml, messageId)
  }
}

function parseAccessoryIndex(html: string): AccessoryStub[] {
  const refs: SubtypeIndexRef[] = []
  let pendingSubtype: AccessorySubtype | undefined
  const contentMatch = html.match(/<span\s+class=["']?msg["']?[^>]*>([\s\S]*?)<\/span>/i)
  const content = contentMatch ? contentMatch[1] : html
  const markerRegex = /<b>\s*(?:<a[^>]+href="[^"]*m=(\d+)[^"]*"[^>]*>(.*?)<\/a>|([^<]+))\s*<\/b>/gi

  for (const match of content.matchAll(markerRegex)) {
    const linkedText = decodeHtml((match[2] ?? '').replace(/<[^>]+>/g, '')).trim()
    const plainText = decodeHtml(match[3] ?? '').trim()
    const label = linkedText || plainText

    if (!label) continue

    const headingSubtype = normalizeSubtypeHeading(label)
    if (headingSubtype) {
      if (match[1]) {
        refs.push({ subtype: headingSubtype, messageId: match[1] })
        pendingSubtype = undefined
      } else {
        pendingSubtype = headingSubtype
      }
      continue
    }

    if (pendingSubtype && match[1] && /^\([A-Z]-[A-Z]\)$/i.test(label)) {
      refs.push({ subtype: pendingSubtype, messageId: match[1] })
    }
  }

  return refs.map((ref) => ({
    name: '',
    forumUrl: '',
    messageId: ref.messageId,
    subtype: ref.subtype,
  }))
}

function extractReplyMessageCell(html: string, messageId: string): string {
  const anchorRegex = new RegExp(`<a\\s+name=${messageId}\\b[^>]*><\\/a>`, 'i')
  const anchorMatch = anchorRegex.exec(html)
  if (!anchorMatch || anchorMatch.index === undefined) {
    throw new Error(`Could not find message anchor for ${messageId}`)
  }

  const slice = html.slice(anchorMatch.index)
  const cellMatch = slice.match(/<td\b[^>]*class=["']?msg["']?[^>]*>([\s\S]*?)<\/td>/i)
  if (!cellMatch) {
    throw new Error(`Could not find message cell for ${messageId}`)
  }

  return cellMatch[1]
}

function parseSubtypePage(html: string, subtype: AccessorySubtype): AccessoryStub[] {
  const content = html
  const stubs: AccessoryStub[] = []
  const seen = new Set<string>()

  for (const match of content.matchAll(
    /<a[^>]+href="([^"]*tm\.asp\?m=(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi
  )) {
    const href = match[1]
    const messageId = match[2]
    const name = decodeHtml(match[3].replace(/<[^>]+>/g, '')).trim()

    if (!name) continue
    if (/^\([A-Z]-[A-Z]\)$/i.test(name)) continue
    if (/^A-Z\s+.*\bSkills\b/i.test(name)) continue
    if (/\bSkills\b/i.test(name) && !/\(All Versions\)|\([IVX, -]+\)|\bSkillstone\b/i.test(name))
      continue
    if (
      /(?:Artifacts|Belts|Bracers|Capes\s*&\s*Wings|Helms|Necklaces|Rings|Trinkets)\s+\(A-Z\)/i.test(
        name
      )
    )
      continue
    if (seen.has(messageId)) continue
    seen.add(messageId)

    const forumUrl = href.startsWith('http') ? href : `${FORUM_BASE}/${href.replace(/^\.\//, '')}`

    stubs.push({
      name,
      forumUrl,
      messageId,
      subtype,
    })
  }

  return stubs
}

function writeDatasets(
  entriesBySubtype: Map<AccessorySubtype, AccessoryEntry[]>,
  selectedSubtypes: Set<AccessorySubtype>,
  lettersArg?: string[]
) {
  for (const meta of ACCESSORY_SUBTYPES) {
    if (!selectedSubtypes.has(meta.subtype)) continue
    let entries = entriesBySubtype.get(meta.subtype) ?? []
    const dataFiles = getAccessoryDataFiles(meta)

    if (lettersArg && lettersArg.length > 0) {
      const existingEntries = dataFiles.flatMap((dataFile) => {
        const filePath = path.resolve(OUTPUT_DIR, dataFile)
        return fs.existsSync(filePath)
          ? (JSON.parse(fs.readFileSync(filePath, 'utf-8')) as AccessoryEntry[])
          : []
      })
      const excludedInitials = new Set(lettersArg)
      const preservedEntries = existingEntries.filter(
        (entry) => !excludedInitials.has(getInitialForName(getEntryDisplayName(entry)))
      )
      entries = [...preservedEntries, ...entries]
    }

    entries = repairAccessFlags(
      Array.from(new Map(entries.map((entry) => [entry.slug, entry])).values())
    )

    entries.sort((a, b) => {
      const aName = getEntryDisplayName(a)
      const bName = getEntryDisplayName(b)
      return compareTitles(aName, bName)
    })

    for (const dataFile of dataFiles) {
      const fileEntries = entries.filter((entry) => entryBelongsInDataFile(entry, dataFile))
      fs.writeFileSync(
        path.resolve(OUTPUT_DIR, dataFile),
        `${JSON.stringify(fileEntries, null, 2)}\n`,
        'utf-8'
      )
    }
  }

  writeAccessoryManifest()
}

function writeAccessoryManifest() {
  const bySubtype = Object.fromEntries(
    ACCESSORY_SUBTYPES.map((meta) => {
      const count = getAccessoryDataFiles(meta).reduce((sum, dataFile) => {
        const filePath = path.resolve(OUTPUT_DIR, dataFile)
        if (!fs.existsSync(filePath)) return sum
        const entries = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as AccessoryEntry[]
        return sum + entries.length
      }, 0)

      return [meta.subtype, count]
    })
  ) as Record<AccessorySubtype, number>

  const total = Object.values(bySubtype).reduce((sum, count) => sum + count, 0)
  fs.writeFileSync(
    path.resolve(OUTPUT_DIR, 'accessory-manifest.json'),
    `${JSON.stringify({ total, bySubtype }, null, 2)}\n`,
    'utf-8'
  )
}

function loadExistingAccessoryEntry(stub: AccessoryStub): AccessoryEntry | undefined {
  const meta = ACCESSORY_SUBTYPES.find((item) => item.subtype === stub.subtype)
  if (!meta) return undefined
  const expectedSlug = accessorySlugForName(stub.name)

  for (const dataFile of getAccessoryDataFiles(meta)) {
    const filePath = path.resolve(OUTPUT_DIR, dataFile)
    if (!fs.existsSync(filePath)) continue
    const entries = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as AccessoryEntry[]
    const existing = entries.find((entry) => entry.slug === expectedSlug)
    if (existing) return existing
  }

  return undefined
}

async function main() {
  const cookie = loadCookie()

  const subtypeArg = getArg('subtype') as AccessorySubtype | undefined
  const subtypesArg = getArg('subtypes')
  const lettersArg = getArg('letters')?.toUpperCase().split(',').filter(Boolean)
  const limitArg = getLimitArg()
  const concurrencyArg = getConcurrencyArg()
  const indexHtml = await fetchPage(ACCESSORIES_INDEX_URL, cookie)
  const subtypeRefs = parseAccessoryIndex(indexHtml)
  const selectedSubtypes = subtypesArg
    ? new Set(subtypesArg.split(',').map((value) => value.trim() as AccessorySubtype))
    : subtypeArg
      ? new Set<AccessorySubtype>([subtypeArg])
      : new Set<AccessorySubtype>(ACCESSORY_SUBTYPES.map((meta) => meta.subtype))
  const allStubs: AccessoryStub[] = []

  for (const ref of subtypeRefs) {
    if (!selectedSubtypes.has(ref.subtype)) continue
    const subtypeHtml = await fetchPage(`${FORUM_BASE}/fb.asp?m=${ref.messageId}`, cookie)
    const subtypeContent = extractReplyMessageCell(subtypeHtml, ref.messageId)
    allStubs.push(...parseSubtypePage(subtypeContent, ref.subtype))
    await sleep(250)
  }

  const filteredStubs = applyLimit(
    allStubs.filter((stub) => {
      if (!selectedSubtypes.has(stub.subtype)) return false
      if (!lettersArg || lettersArg.length === 0) return true
      return lettersArg.includes(getInitialForName(stub.name))
    }),
    limitArg
  )
  const resolveAlsoSee = createAccessoryRefResolver(allStubs)
  const entriesBySubtype = new Map<AccessorySubtype, AccessoryEntry[]>(
    ACCESSORY_SUBTYPES.map((meta) => [meta.subtype, []])
  )

  console.log(`Detail concurrency: ${concurrencyArg} (entry starts spaced ${DELAY_MS}ms apart)`)

  await processWithConcurrency({
    items: filteredStubs,
    concurrency: concurrencyArg,
    startDelayMs: DELAY_MS,
    processItem: async (stub, index) => {
      console.log(`[${index + 1}/${filteredStubs.length}] ${stub.name} (${stub.subtype})`)
      try {
        const entry = await buildAccessoryOrFamily(stub, cookie, resolveAlsoSee)
        entriesBySubtype.get(stub.subtype)?.push(entry)
      } catch (error) {
        const existing = loadExistingAccessoryEntry(stub)
        if (!existing) throw error
        console.warn(
          `⚠️  Keeping existing ${stub.name} after scrape failure: ${
            error instanceof Error ? error.message : String(error)
          }`
        )
        entriesBySubtype.get(stub.subtype)?.push(existing)
      }
    },
  })

  console.log(
    `Parsed accessory entries: ${filteredStubs.length}${
      selectedSubtypes.size === 1 ? ` for ${[...selectedSubtypes][0]}` : ''
    }`
  )
  writeDatasets(entriesBySubtype, selectedSubtypes, lettersArg)
}

if (import.meta.main) {
  main().catch((error) => {
    console.error('❌ scrape-accessories failed:', error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
