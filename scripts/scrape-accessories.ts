import * as fs from 'node:fs'
import * as path from 'node:path'
import elementsData from '../src/data/elements.json' with { type: 'json' }
import { computeFamilyFlags, computePriceType, normalizeLevel } from '../src/utils/variantHelpers.ts'
import {
  ACCESSORY_SUBTYPES,
  type Accessory,
  type AccessoryEntry,
  type AccessoryFamily,
  type AccessorySubtype,
} from '../src/types/accessory.ts'
import { convertImageTags, fetchPrintable, getPostContent } from './lib/printable-parser.ts'
import type { FamilySourceRef, LevelVariant } from '../src/types/item.ts'
import type { GuestAttack } from '../src/types/pet.ts'

const FORUM_BASE = 'https://forums2.battleon.com/f'
const ACCESSORIES_INDEX_URL = `${FORUM_BASE}/printable.asp?m=20985110`
const OUTPUT_DIR = path.resolve(import.meta.dirname, '../src/data')
const DELAY_MS = 900

type PriceType = Accessory['obtainMethods'][number]['priceType']

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

const elementEntries = (elementsData as {
  elements: Array<{ code: string; name: string; shortName: string }>
}).elements
const elementPatterns = elementEntries.map(entry => ({
  code: entry.code,
  patterns: [
    new RegExp(`\\b${entry.code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
    new RegExp(`\\b${entry.shortName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
    new RegExp(`\\b${entry.name.replace(/\s+Element$/i, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
  ],
}))

function getArg(name: string): string | undefined {
  return process.argv.slice(2).find(arg => arg.startsWith(`--${name}=`))?.split('=')[1]
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function getEntryDisplayName(entry: AccessoryEntry): string {
  return 'familyName' in entry ? entry.familyName : entry.name
}

function getInitialForName(name: string): string {
  return /^[A-Z]/i.test(name) ? name[0].toUpperCase() : '#'
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<hr[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
}

function normalizeStructuredText(html: string): string {
  let depth = 0
  let output = ''
  let i = 0
  let inTag = false
  let tagStart = -1

  while (i < html.length) {
    const char = html[i]

    if (char === '<' && !inTag) {
      const nextChars = html.slice(i, i + 12)
      if (/^<[a-zA-Z!\/]/.test(nextChars)) {
        inTag = true
        tagStart = i
      } else {
        output += char
      }
      i++
      continue
    }

    if (char === '>' && inTag) {
      inTag = false
      const tagContent = html.slice(tagStart, i + 1)

      if (/<ul|<ol/i.test(tagContent)) {
        depth++
        output += '\n'
      } else if (/<\/ul|<\/ol/i.test(tagContent)) {
        depth = Math.max(0, depth - 1)
        output += '\n'
      } else if (/<li/i.test(tagContent)) {
        const indent = '  '.repeat(Math.max(0, depth))
        output += `\n${indent}• `
      } else if (/<br/i.test(tagContent) || /<\/p/i.test(tagContent) || /<hr/i.test(tagContent)) {
        output += '\n'
      }

      i++
      continue
    }

    if (inTag) {
      i++
      continue
    }

    output += char
    i++
  }

  return decodeHtml(output)
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function findLastSection(html: string, sectionRegex: RegExp): string | undefined {
  const matches = [...html.matchAll(sectionRegex)]
  const last = matches.at(-1)
  if (!last || last.index === undefined) return undefined
  return html.slice(last.index + last[0].length)
}

function getAccessoryLeadHtml(html: string): string {
  const firstFieldIndex = [
    /(?:<b>)?Level:(?:<\/b>)?/i,
    /(?:<b>)?Element:(?:<\/b>)?/i,
    /(?:<b>)?Location:(?:<\/b>)?/i,
    /(?:<b>)?Stats:(?:<\/b>)?/i,
    /(?:<b>)?Resists:(?:<\/b>)?/i,
    /<u>Other [Ii]nformation<\/u>/i,
  ]
    .map(pattern => html.search(pattern))
    .filter(index => index >= 0)
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
    if (entry.patterns.some(pattern => pattern.test(value))) {
      found.add(entry.code)
    }
  }

  return [...found]
}

function parseFieldValue(text: string, labels: string[]): string | undefined {
  const escaped = labels.map(label => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
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
      ? normalizeStructuredText(match[1]).replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim()
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

  const label = normalizeStructuredText(match[1]).replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim()
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
  const otherInfoHtml = findLastSection(html, /<b><u>Other [Ii]nformation<\/u><\/b>/gi)

  if (otherInfoHtml) {
    const trimmedSection = otherInfoHtml
      .split(/<i>Thanks to|Also See:|<font color='#eeeeee'>/i)[0]
      .replace(/<img[^>]+src="[^"]+\.(?:png|jpg|jpeg|gif|bmp)"[^>]*>/gi, '')

    for (const line of normalizeStructuredText(trimmedSection).split('\n')) {
      if (!line.trim()) continue
      if (/\w+\s+--\s+\d+\/\d+\/\d+\s+\d+:\d+:\d+/.test(line)) continue
      noteLines.push(line)
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
        .map(line => line.trimEnd())
        .filter(line => {
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

  const otherInfoHtml = findLastSection(html, /<b><u>Other [Ii]nformation<\/u><\/b>/gi)
  if (otherInfoHtml) {
    const inlineOtherInfo = normalizeStructuredText(
      otherInfoHtml
        .split(/<i>Thanks to|<font color='#eeeeee'>/i)[0]
        .replace(/<img[^>]+src="[^"]+\.(?:png|jpg|jpeg|gif|bmp)"[^>]*>/gi, '')
    )
      .split('\n')
      .map(line => line.trimEnd())
      .filter(line => {
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
    .map(match => match[1])
    .find(src =>
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

function scoreTrinketAttackCandidate(candidate: GuestAttack, entryName: string, abilityName: string): number {
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

function parseTrinketAttacks(html: string, fallbackName: string, entryName: string): GuestAttack[] {
  const sections = splitTrinketAttackSections(html)
  const candidates = sections
    .map(section => buildTrinketAttackFromHtml(section, fallbackName))
    .filter(candidate => candidate.name || candidate.effect)

  if (candidates.length <= 1) return candidates

  const ranked = candidates
    .map(candidate => ({
      candidate,
      score: scoreTrinketAttackCandidate(candidate, entryName, fallbackName),
    }))
    .sort((a, b) => b.score - a.score)

  const bestScore = ranked[0]?.score ?? 0
  if (bestScore <= 0) return [ranked[0].candidate]
  return ranked.filter(item => item.score === bestScore).map(item => item.candidate)
}

function parseObtainMethods(html: string): Accessory['obtainMethods'] {
  const obtainMethods: Accessory['obtainMethods'] = []
  const firstFieldIndex = [
    /(?:<b>)?Level:(?:<\/b>)?/i,
    /(?:<b>)?Element:(?:<\/b>)?/i,
    /(?:<b>)?Stats:(?:<\/b>)?/i,
    /(?:<b>)?Resists:(?:<\/b>)?/i,
    /<u>Other [Ii]nformation<\/u>/i,
  ]
    .map(pattern => html.search(pattern))
    .filter(index => index >= 0)
    .sort((a, b) => a - b)[0] ?? html.length

  const introHtml = html
    .slice(0, firstFieldIndex)
    .replace(/<b>\s*<font[^>]*>\s*(Location|Requirements|Level\/Quest\/Items to unlock|Price|Sellback|Required Items|Required|Requires):\s*<\/font>\s*<\/b>/gi, '<b>$1:</b>')
    .replace(/(?:^|\s)(Location|Requirements|Level\/Quest\/Items to unlock|Price|Sellback|Required Items|Required|Requires):/gi, ' <b>$1:</b>')

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
    const rawLines = segment.split(/<br\s*\/?>/i).map(line => line.trim()).filter(Boolean)

    for (const rawLine of rawLines) {
      const hasDA = /<img[^>]+src=["'][^"']*\/tags\/DA\.(?:png|jpg|jpeg|gif)["']/i.test(rawLine)
      const hasDC = /<img[^>]+src=["'][^"']*\/tags\/DC\.(?:png|jpg|jpeg|gif)["']/i.test(rawLine)
      const hasDM = /<img[^>]+src=["'][^"']*\/tags\/DM\.(?:png|jpg|jpeg|gif)["']/i.test(rawLine)
      const fieldMatch = rawLine.match(/<b>(Location|Requirements|Level\/Quest\/Items to unlock|Price|Sellback|Required Items|Required|Requires):<\/b>\s*([\s\S]*)/i)
      if (!fieldMatch) continue

      const fieldName = fieldMatch[1].toLowerCase()
      const value = normalizeStructuredText(fieldMatch[2]).replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim()
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
      } else if (fieldName === 'required items' || fieldName === 'required' || fieldName === 'requires') {
        current.requiredItems = value
      }
    }
  }

  for (const block of blocks) {
    if (!block.location) continue
    const price = block.price?.trim() || 'N/A'
    const priceType: PriceType = computePriceType(price, block.requiredItems)
    obtainMethods.push({
      location: block.location,
      price,
      priceType,
      ...(block.sellback ? { sellback: block.sellback } : {}),
      ...(block.requiredItems ? { requiredItems: block.requiredItems } : {}),
      ...(block.requirements && !/^none$/i.test(block.requirements) ? { requirements: block.requirements } : {}),
      daRequired: block.daRequired,
      ...(block.dcRequired || priceType === 'dc' ? { dcRequired: true } : {}),
      ...(block.dmRequired || priceType === 'dm' ? { dmRequired: true } : {}),
    })
  }

  return obtainMethods
}

function extractAccessoryImages(html: string): {
  imageUrl?: string
  alternativeImages?: Array<{ url: string; caption: string }>
} {
  const skipPatterns = [
    /forums2\.battleon\.com/i,
    /\/f\/image\//i,
    /\/f\/upfiles\//i,
    /forumheader/i,
    /quantserve/i,
    /artix\.com\/shared/i,
    /artixgamelaunch/i,
    /\/tags\//i,
    /clear\.gif/i,
    /blank\.gif/i,
    /button/i,
    /attack/i,
  ]

  const isCandidateImage = (src: string) =>
    !skipPatterns.some(pattern => pattern.test(src)) &&
    /\.(?:png|jpg|jpeg|gif|bmp)(?:\?|$)/i.test(src)

  const otherInfoHtml = findLastSection(html, /<b><u>Other [Ii]nformation<\/u><\/b>/gi) ?? html
  const imageMatches = [...otherInfoHtml.matchAll(/<img[^>]+src="([^"]+)"[^>]*>/gi)]
    .map(match => match[1])
    .filter(isCandidateImage)
  const imageUrl = imageMatches.at(-1)

  const alternativeImages: Array<{ url: string; caption: string }> = []
  if (imageUrl) {
    const afterMain = otherInfoHtml.slice(otherInfoHtml.lastIndexOf(imageUrl) + imageUrl.length)
    const linkMatches = [...afterMain.matchAll(/<a[^>]+href="([^"]+\.(?:png|jpg|jpeg|gif|bmp))"[^>]*>([\s\S]*?)<\/a>/gi)]
    for (const match of linkMatches) {
      const url = match[1]
      const caption = stripHtml(decodeHtml(match[2])).trim()
      if (!caption || !isCandidateImage(url)) continue
      alternativeImages.push({ url, caption })
    }
  }

  return {
    ...(imageUrl ? { imageUrl } : {}),
    ...(alternativeImages.length > 0 ? { alternativeImages } : {}),
  }
}

function parseTagFlags(html: string) {
  const leadHtml = getAccessoryLeadHtml(html)
  return {
    daRequired: /\/tags\/DA\.png/i.test(leadHtml),
    dcRequired: /\/tags\/DC\.png/i.test(leadHtml),
    dmRequired: /\/tags\/DM\.png/i.test(leadHtml),
    isTemp: /\/tags\/Temp\.(?:png|jpg|jpeg|gif)/i.test(leadHtml),
    isRare: /\/tags\/Rare\.(?:png|jpg|jpeg|gif)/i.test(leadHtml),
    isSeasonal: /\/tags\/Seasonal\.(?:png|jpg|jpeg|gif)/i.test(leadHtml),
    isSpecialOffer: /\/tags\/SpecialOffer\.(?:png|jpg|jpeg|gif)/i.test(leadHtml),
    retired: /\/tags\/Retired\.(?:png|jpg|jpeg|gif)/i.test(leadHtml),
  }
}

function hasMultipleVersionHint(name: string): boolean {
  return /\((?:All Versions|[IVX]+(?:\s*[-,]\s*[IVX]+)+|[IVX]+-[IVX]+)\)/i.test(name)
}

function parseAccessoryTitle(html: string): string | undefined {
  const match =
    html.match(/<font[^>]*>\s*<b>([\s\S]*?)<\/b>\s*<\/font>/i) ??
    html.match(/<b>([\s\S]*?)<\/b>/i)

  const title = match ? normalizeStructuredText(match[1]).trim() : ''
  return title || undefined
}

function normalizeAccessoryFamilyName(name: string): string {
  return name
    .replace(/\s*\((?:All Versions|[IVXLCDM]+(?:\s*[-,]\s*[IVXLCDM]+)+|[IVXLCDM]+-[IVXLCDM]+)\)\s*/i, ' ')
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

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function parseNumericLevel(level?: string): number | undefined {
  if (!level) return undefined
  const trimmed = level.trim()
  if (/^\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10)
  return undefined
}

function allSame<T>(values: T[]): boolean {
  if (values.length <= 1) return true
  return values.every(value => JSON.stringify(value) === JSON.stringify(values[0]))
}

function buildAccessoryEntry(
  stub: AccessoryStub,
  html: string,
  override?: { name?: string; forumUrl?: string }
): Accessory {
  const normalizedText = normalizeStructuredText(html)
  const flags = parseTagFlags(html)
  const textSignals = {
    daRequired:
      /this item requires a dragon amulet/i.test(normalizedText) &&
      !/\(no da required\)/i.test(normalizedText),
  }
  const obtainMethods = parseObtainMethods(html).map(method => ({
    ...method,
    daRequired: method.daRequired || textSignals.daRequired,
  }))
  const explicitElement =
    parseHtmlField(html, ['Element']) ??
    parseFieldValue(normalizedText, ['Element'])
  const parsedElements = parseElementCodes(explicitElement)
  const firstMethod = obtainMethods[0]
  const primaryPriceType = firstMethod?.priceType
  const images = extractAccessoryImages(html)
  const levelValue = parseHtmlField(html, ['Level']) ?? parseFieldValue(normalizedText, ['Level'])
  const statsValue = parseHtmlField(html, ['Stats', 'Bonuses']) ?? parseFieldValue(normalizedText, ['Stats', 'Bonuses'])
  const resistsValue = parseHtmlField(html, ['Resists', 'Resistances']) ?? parseFieldValue(normalizedText, ['Resists', 'Resistances'])
  const abilityInfo = parseAbilityInfo(html)
  const abilityValue = abilityInfo.label ?? parseHtmlField(html, ['Ability']) ?? parseFieldValue(normalizedText, ['Ability'])
  const rarityValue = parseHtmlField(html, ['Rarity']) ?? parseFieldValue(normalizedText, ['Rarity'])
  const itemTypeValue = parseHtmlField(html, ['Item Type']) ?? parseFieldValue(normalizedText, ['Item Type'])
  const equipSpotValue = parseHtmlField(html, ['Equip Spot', 'Equip Slot']) ?? parseFieldValue(normalizedText, ['Equip Spot', 'Equip Slot'])
  const categoryValue = parseHtmlField(html, ['Category']) ?? parseFieldValue(normalizedText, ['Category'])

  return {
    id: `accessory-${slugify(override?.name ?? stub.name)}`,
    name: override?.name ?? stub.name,
    slug: `accessory-${slugify(override?.name ?? stub.name)}`,
    type: 'accessory',
    subtype: stub.subtype,
    description: parseDescription(html),
    forumUrl: override?.forumUrl ?? stub.forumUrl,
    releaseDate: '',
    ...(images.imageUrl ? { imageUrl: images.imageUrl } : {}),
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
    ...(categoryValue ? { category: categoryValue } : {}),
    obtainMethods,
    ...(parseNotes(html) ? { notes: parseNotes(html) } : {}),
    tags: [
      ...parsedElements.map(code => code.toLowerCase()),
      ...(primaryPriceType ? [primaryPriceType] : []),
    ],
    daRequired: textSignals.daRequired || obtainMethods.some(method => method.daRequired),
    ...(obtainMethods.some(method => method.dcRequired) ? { dcRequired: true } : {}),
    ...(obtainMethods.some(method => method.dmRequired) ? { dmRequired: true } : {}),
    ...(flags.isTemp ? { isTemp: true } : {}),
    ...(flags.isRare ? { isRare: true } : {}),
    ...(flags.isSeasonal ? { isSeasonal: true } : {}),
    ...(flags.isSpecialOffer ? { isSpecialOffer: true } : {}),
    ...(flags.retired ? { retired: true } : {}),
  }
}

async function enrichTrinketAbility(entry: Accessory, cookie: string): Promise<Accessory> {
  if (entry.subtype !== 'trinket' || !entry.abilityUrl) return entry

  const abilityMessageId = entry.abilityUrl.match(/m=(\d+)/i)?.[1]
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

function buildAccessoryFamily(stub: AccessoryStub, variants: Accessory[]): AccessoryFamily {
  const familyName = normalizeAccessoryFamilyName(stub.name)
  const descriptions = uniqueStrings(variants.map(variant => variant.description).filter(Boolean))
  const resists = uniqueStrings(variants.map(variant => variant.resists).filter(Boolean))
  const abilities = uniqueStrings(variants.map(variant => variant.ability).filter(Boolean))
  const attacks = variants.map(variant => variant.attacks).filter((value): value is GuestAttack[] => Boolean(value))
  const images = uniqueStrings(variants.map(variant => variant.imageUrl).filter(Boolean))
  const alternativeImages = variants
    .map(variant => variant.alternativeImages)
    .filter((value): value is NonNullable<Accessory['alternativeImages']> => Boolean(value))
  const rarities = uniqueStrings(variants.map(variant => variant.rarity).filter(Boolean))

  const levelVariants: LevelVariant[] = variants
    .map((variant, index) => {
      const normalizedLevel = normalizeLevel(variant.level ?? String(index + 1))
      const actualLevel = parseNumericLevel(variant.level)
      const variantName = deriveAccessoryVariantName(variant.name, familyName)
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
      return aLevel - bLevel || a.name.localeCompare(b.name)
    })

  const familySources: FamilySourceRef[] = variants.map((variant, index) => ({
    url: variant.forumUrl,
    title: `DF Encyclopedia: ${variant.name}`,
    variantLabel: variant.name,
    isPrimary: index === 0,
  }))

  const family = computeFamilyFlags({
    id: `accessory-${slugify(familyName)}`,
    familyName,
    slug: `accessory-${slugify(familyName)}`,
    aliasSlugs: variants.map(variant => variant.slug),
    type: 'accessory',
    subtype: stub.subtype,
    forumUrl: stub.forumUrl,
    familyOrigin: 'same-thread-multi-post',
    familySources,
    shared: {
      description: allSame(descriptions) ? descriptions[0] ?? '' : descriptions[0] ?? '',
      ...(resists.length === 1 ? { resists: resists[0] } : {}),
      ...(abilities.length === 1 ? { ability: abilities[0] } : {}),
      ...(attacks.length > 0 && allSame(attacks) ? { attacks: attacks[0] } : {}),
      ...(images.length === 1 ? { imageUrl: images[0] } : {}),
      ...(alternativeImages.length === 1 ? { alternativeImages: alternativeImages[0] } : {}),
      ...(rarities.length === 1 ? { rarity: rarities[0] } : {}),
    },
    levelVariants,
    itemType: variants.find(variant => variant.itemType)?.itemType,
    equipSlot: variants.find(variant => variant.equipSpot)?.equipSpot,
    category: variants.find(variant => variant.category)?.category,
    releaseDate: variants.find(variant => variant.releaseDate)?.releaseDate ?? '',
    tags: Array.from(new Set(variants.flatMap(variant => variant.tags))).sort(),
    isTemp: variants.some(variant => variant.isTemp) || undefined,
    isRare: variants.some(variant => variant.isRare) || undefined,
    isSeasonal: variants.some(variant => variant.isSeasonal) || undefined,
    isSpecialOffer: variants.some(variant => variant.isSpecialOffer) || undefined,
    retired: variants.some(variant => variant.retired) || undefined,
    hasDA: false,
    hasDC: false,
    hasDM: false,
    hasFree: false,
    hasMerge: false,
    levelRange: '',
    elements: Array.from(new Set(variants.flatMap(variant => variant.elements))),
  })

  family.shared.description = allSame(descriptions) ? descriptions[0] ?? '' : ''
  if (!family.shared.description) {
    const firstDescription = variants.find(variant => variant.description)?.description
    family.shared.description = firstDescription ?? ''
  }

  return family
}

function extractThreadPostHtml(threadHtml: string): Map<string, string> {
  const posts = new Map<string, string>()
  const regex =
    /<a\s+name=(\d+)\b[^>]*><\/a>[\s\S]*?<td\b[^>]*class=["']?msg["']?[^>]*>([\s\S]*?)<\/td>/gi

  for (const match of threadHtml.matchAll(regex)) {
    const messageId = match[1]
    const html = convertImageTags(match[2])
    posts.set(messageId, html)
  }

  return posts
}

async function buildAccessoryOrFamily(stub: AccessoryStub, cookie: string): Promise<AccessoryEntry> {
  const shouldInspectThread = hasMultipleVersionHint(stub.name)
  if (shouldInspectThread) {
    const threadHtml = await fetchPage(`${FORUM_BASE}/fb.asp?m=${stub.messageId}`, cookie)
    const messageIds = Array.from(new Set([...threadHtml.matchAll(/<a\s+name=(\d+)\b/gi)].map(match => match[1])))
    const postHtmlById = extractThreadPostHtml(threadHtml)
    const variants: Accessory[] = []

    for (const messageId of messageIds) {
      let html: string
      try {
        html = await fetchPostContent(messageId, cookie)
      } catch {
        html = postHtmlById.get(messageId) ?? ''
      }
      if (!html) continue
      const title = parseAccessoryTitle(html)
      if (!title) continue

      const variant = await enrichTrinketAbility(
        buildAccessoryEntry(stub, html, {
          name: title,
          forumUrl: `${FORUM_BASE}/fb.asp?m=${messageId}`,
        }),
        cookie
      )

      if (!variant.level && !variant.stats && variant.obtainMethods.length === 0) continue
      variants.push(variant)
      await sleep(Math.round(DELAY_MS / 2))
    }

    if (variants.length > 1) {
      return buildAccessoryFamily(stub, variants)
    }
  }

  const html = await fetchPostContent(stub.messageId, cookie)
  const title = parseAccessoryTitle(html)
  return enrichTrinketAbility(
    buildAccessoryEntry(stub, html, title ? { name: title } : undefined),
    cookie
  )
}

async function fetchPage(url: string, cookie: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      Cookie: cookie,
      'User-Agent': 'Mozilla/5.0',
      Accept: 'text/html,application/xhtml+xml',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`)
  }

  return response.text()
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
    return getPostContent(await fetchPrintable(messageId, cookie))
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

  return refs.map(ref => ({
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

  for (const match of content.matchAll(/<a[^>]+href="([^"]*tm\.asp\?m=(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = match[1]
    const messageId = match[2]
    const name = decodeHtml(match[3].replace(/<[^>]+>/g, '')).trim()

    if (!name) continue
    if (/^\([A-Z]-[A-Z]\)$/i.test(name)) continue
    if (/^A-Z\s+.*\bSkills\b/i.test(name)) continue
    if (/\bSkills\b/i.test(name) && !/\(All Versions\)|\([IVX, -]+\)|\bSkillstone\b/i.test(name)) continue
    if (/(?:Artifacts|Belts|Bracers|Capes\s*&\s*Wings|Helms|Necklaces|Rings|Trinkets)\s+\(A-Z\)/i.test(name)) continue
    if (seen.has(messageId)) continue
    seen.add(messageId)

    const forumUrl = href.startsWith('http')
      ? href
      : `${FORUM_BASE}/${href.replace(/^\.\//, '')}`

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

    if (lettersArg && lettersArg.length > 0) {
      const filePath = path.resolve(OUTPUT_DIR, meta.dataFile)
      const existingEntries = fs.existsSync(filePath)
        ? (JSON.parse(fs.readFileSync(filePath, 'utf-8')) as AccessoryEntry[])
        : []
      const excludedInitials = new Set(lettersArg)
      const preservedEntries = existingEntries.filter(
        entry => !excludedInitials.has(getInitialForName(getEntryDisplayName(entry)))
      )
      entries = [...preservedEntries, ...entries]
    }

    entries.sort((a, b) => {
      const aName = getEntryDisplayName(a)
      const bName = getEntryDisplayName(b)
      return aName.localeCompare(bName)
    })

    fs.writeFileSync(
      path.resolve(OUTPUT_DIR, meta.dataFile),
      `${JSON.stringify(entries, null, 2)}\n`,
      'utf-8'
    )
  }
}

async function main() {
  const cookie = process.env.FORUM_COOKIE
  if (!cookie) {
    throw new Error('FORUM_COOKIE is required in the environment to scrape accessories.')
  }

  const subtypeArg = getArg('subtype') as AccessorySubtype | undefined
  const subtypesArg = getArg('subtypes')
  const lettersArg = getArg('letters')?.toUpperCase().split(',').filter(Boolean)
  const indexHtml = await fetchPage(ACCESSORIES_INDEX_URL, cookie)
  const subtypeRefs = parseAccessoryIndex(indexHtml)
  const selectedSubtypes = subtypesArg
    ? new Set(subtypesArg.split(',').map(value => value.trim() as AccessorySubtype))
    : subtypeArg
      ? new Set<AccessorySubtype>([subtypeArg])
      : new Set<AccessorySubtype>(ACCESSORY_SUBTYPES.map(meta => meta.subtype))
  const allStubs: AccessoryStub[] = []

  for (const ref of subtypeRefs) {
    if (!selectedSubtypes.has(ref.subtype)) continue
    const subtypeHtml = await fetchPage(`${FORUM_BASE}/fb.asp?m=${ref.messageId}`, cookie)
    const subtypeContent = extractReplyMessageCell(subtypeHtml, ref.messageId)
    allStubs.push(...parseSubtypePage(subtypeContent, ref.subtype))
    await sleep(250)
  }

  const filteredStubs = allStubs.filter(stub => {
    if (!selectedSubtypes.has(stub.subtype)) return false
    if (!lettersArg || lettersArg.length === 0) return true
    const initial = /^[A-Z]/i.test(stub.name) ? stub.name[0].toUpperCase() : '#'
    return lettersArg.includes(initial)
  })
  const entriesBySubtype = new Map<AccessorySubtype, AccessoryEntry[]>(
    ACCESSORY_SUBTYPES.map(meta => [meta.subtype, []])
  )

  for (let index = 0; index < filteredStubs.length; index++) {
    const stub = filteredStubs[index]
    console.log(`[${index + 1}/${filteredStubs.length}] ${stub.name} (${stub.subtype})`)
    const entry = await buildAccessoryOrFamily(stub, cookie)
    entriesBySubtype.get(stub.subtype)?.push(entry)
    await sleep(DELAY_MS)
  }

  console.log(
    `Parsed accessory entries: ${filteredStubs.length}${
      selectedSubtypes.size === 1 ? ` for ${[...selectedSubtypes][0]}` : ''
    }`
  )
  writeDatasets(entriesBySubtype, selectedSubtypes, lettersArg)
}

if (import.meta.main) {
  main().catch(error => {
    console.error('❌ scrape-accessories failed:', error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
