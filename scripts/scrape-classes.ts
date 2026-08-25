import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type {
  ClassAbilityEntry,
  ClassAbilityItem,
  ClassAbilitySubtype,
  ClassSubcategory,
  ConsumableKind,
} from '../src/types/classAbility'
import type { LevelVariant, ObtainVariant } from '../src/types/item'
import type { GuestAttack } from '../src/types/pet'
import { computePriceType, isDefenderMedalText } from '../src/utils/variantHelpers.ts'
import { writeClassAbilitiesManifest } from './lib/data-manifests.ts'
import { directForumPostUrl, fetchForumPage, loadForumCookie, sleep } from './lib/forum.ts'
import { extractAlsoSeeRefs } from './lib/also-see.ts'
import { normalizeStructuredText, slugify } from './lib/text.ts'
import {
  hasRareTag,
  hasRetiredTag,
  hasSeasonalTag as hasSeasonalForumTag,
  hasSpecialOfferTag,
} from './lib/tags.ts'
import { rephraseTimedSellback } from './lib/obtain-formatting.ts'

interface ScrapeOptions {
  subtype: ClassAbilitySubtype
  classSubcategory?: ClassSubcategory
  fresh: boolean
  limit?: number
  names?: string[]
  letters?: string[]
  urls?: string[]
}

interface ListingEntry {
  name: string
  forumUrl: string
  tags: string[]
  subtype: ClassAbilitySubtype
  classSubcategory?: ClassSubcategory
  consumableKind?: ConsumableKind
  isRare?: boolean
  isSeasonal?: boolean
  isSpecialOffer?: boolean
  retired?: boolean
}

interface ParsedDetail {
  name: string
  description: string
  forumUrl: string
  sourceUrl: string
  location?: string
  price: string
  sellback?: string
  requiredItems?: string
  requirements?: string
  effect?: string
  effectType?: string
  equipsClass?: string
  equipsClassUrl?: string
  attacks?: GuestAttack[]
  dialogue?: string
  level?: string
  rarity?: string
  itemType?: string
  consumableKind?: ConsumableKind
  notes?: string
  obtainMethods: ObtainVariant[]
}

const CONSUMABLES_URL = 'https://forums2.battleon.com/f/fb.asp?m=22304639'
const CONSUMABLE_EFFECT_TYPES_URL = 'https://forums2.battleon.com/f/fb.asp?m=22304644'
const ARMORS_URL = 'https://forums2.battleon.com/f/fb.asp?m=22303582'
const DATA_DIR = resolve(import.meta.dirname, '../src/data')
const SUPPLEMENTAL_CONSUMABLES: ListingEntry[] = [
  {
    name: 'Health Potion',
    forumUrl: 'https://forums2.battleon.com/f/tm.asp?m=4159197',
    tags: [],
    subtype: 'consumable',
    isRare: false,
    isSeasonal: false,
    isSpecialOffer: false,
    retired: false,
  },
  {
    name: 'Mana Potion',
    forumUrl: 'https://forums2.battleon.com/f/tm.asp?m=4159198',
    tags: [],
    subtype: 'consumable',
    isRare: false,
    isSeasonal: false,
    isSpecialOffer: false,
    retired: false,
  },
]
const POTION_BUTTON_IMAGES = new Map([
  [
    'health potion',
    'https://github.com/DF-Pedia/DF-Pedia/raw/master/classes_abilities/Skill-HP.png',
  ],
  [
    'mana potion',
    'https://github.com/DF-Pedia/DF-Pedia/raw/master/classes_abilities/Skill-MP.png',
  ],
])

function parseArgs(): ScrapeOptions {
  const args = process.argv.slice(2)
  const argValue = (prefix: string) => {
    const arg = args.find((candidate) => candidate.startsWith(prefix))
    return arg ? arg.slice(prefix.length) : undefined
  }
  const subtypeArg = argValue('--subtype=')
  const subtype: ClassAbilitySubtype = subtypeArg === 'class' ? 'class' : 'consumable'
  const subcategoryArg = argValue('--class-subcategory=')
  const classSubcategory: ClassSubcategory | undefined =
    subcategoryArg === 'regular' || subcategoryArg === 'miscellaneous'
      ? subcategoryArg
      : subtype === 'class'
        ? 'armor'
        : undefined
  const limitArg = argValue('--limit=')
  const namesArg = argValue('--names=')
  const lettersArg = argValue('--letters=')
  const urlsArg = argValue('--urls=') ?? argValue('--url=')
  return {
    subtype,
    ...(classSubcategory ? { classSubcategory } : {}),
    fresh: args.includes('--fresh'),
    ...(limitArg ? { limit: Number.parseInt(limitArg, 10) } : {}),
    ...(namesArg ? { names: namesArg.split('|').map((name) => name.trim()).filter(Boolean) } : {}),
    ...(lettersArg
      ? { letters: lettersArg.split(',').map((letter) => letter.trim().toUpperCase()).filter(Boolean) }
      : {}),
    ...(urlsArg
      ? { urls: urlsArg.split('|').map((url) => directUrl(url.trim())).filter(Boolean) }
      : {}),
  }
}

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function normalizeLinkedImageUrl(url: string): string {
  const decoded = decodeHtml(url.trim())
  if (!decoded) return decoded
  if (/github\.com\/DF-Pedia\/DF-Pedia\/blob\/master\//i.test(decoded)) {
    return decoded.replace(
      /^https?:\/\/github\.com\/DF-Pedia\/DF-Pedia\/blob\/master\//i,
      'https://raw.githubusercontent.com/DF-Pedia/DF-Pedia/master/'
    )
  }
  if (/github\.com\/DF-Pedia\/DF-Pedia\/raw\/master\//i.test(decoded)) {
    return decoded.replace(
      /^https?:\/\/github\.com\/DF-Pedia\/DF-Pedia\/raw\/master\//i,
      'https://raw.githubusercontent.com/DF-Pedia/DF-Pedia/master/'
    )
  }
  if (/^https?:\/\/imgur\.com\/[A-Za-z0-9]+$/i.test(decoded)) {
    const id = decoded.split('/').pop()
    return `https://i.imgur.com/${id}.png`
  }
  return decoded
}

function isLikelyLinkedImageUrl(url: string): boolean {
  return /\.(?:png|jpg|jpeg|gif|bmp)(?:[?#].*)?$/i.test(url)
}

function stripTags(html: string): string {
  return decodeHtml(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function directUrl(url: string): string {
  const messageId = url.match(/[?&]m=(\d+)/i)?.[1]
  return messageId ? directForumPostUrl(messageId) : url
}

function normalizeName(name: string): string {
  return stripTags(name)
    .replace(/^DF Encyclopedia:\s*/i, '')
    .replace(/^All Classes\s*-\s*/i, '')
    .replace(/\s+\(All Versions\)$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isDefaultTempConsumable(name: string): boolean {
  return !/^(?:Health Potion|Mana Potion)$/i.test(normalizeName(name))
}

function tagNamesFromHtml(html: string): string[] {
  const pathTags = [...html.matchAll(/\/tags\/([^/"']+?)\.(?:png|jpg|jpeg|gif)/gi)].map(
    (match) => match[1]
  )
  const labelledTags = [
    ...html.matchAll(/<(?:img|a)\b[^>]*(?:alt|title)=(["'])([^"']+)\1[^>]*>/gi),
  ].map((match) => match[2])
  return [...pathTags, ...labelledTags]
    .map((tag) => tag.toLowerCase().replace(/[^a-z0-9]+/g, ''))
    .filter(isClassAbilityTag)
}

function isClassAbilityTag(tag: string): boolean {
  return (
    /^(?:da|dc|dm|temp|rare|seasonal|retired|dust|food|rune)$/.test(tag) ||
    /^(?:specialoffer|specialcharacter|alexandersaga|archknight)$/.test(tag) ||
    /^(?:holiday|frostval|mogloween|heroheart|friday13)$/.test(tag)
  )
}

function hasSeasonalAliasTag(tags: Iterable<string>): boolean {
  return [...tags].some((tag) =>
    /seasonal|holiday|frostval|mogloween|heroheart|friday13/.test(tag)
  )
}

function isListingRare(rowText: string, tags: string[]): boolean {
  return tags.includes('rare') || hasRareTag(rowText) || /\bRare\b/i.test(rowText)
}

function isListingSpecialOffer(rowHtml: string, tags: string[]): boolean {
  const rowText = stripTags(rowHtml)
  return (
    tags.includes('specialoffer') ||
    tags.includes('special-offer') ||
    hasSpecialOfferTag(rowHtml) ||
    /\b(?:Special Offer|S-Offer)\b/i.test(rowText)
  )
}

function isListingRetired(rowText: string, tags: string[]): boolean {
  return tags.includes('retired') || /\bRetired\b/i.test(rowText)
}

function consumableKindFromTags(tags: string[]): ConsumableKind | undefined {
  if (tags.includes('dust')) return 'dust'
  if (tags.includes('food')) return 'food'
  if (tags.includes('rune')) return 'rune'
  return undefined
}

function consumableKindFromPrefix(prefix: string | undefined): ConsumableKind | undefined {
  if (!prefix) return undefined
  if (prefix.toUpperCase() === 'D') return 'dust'
  if (prefix.toUpperCase() === 'F') return 'food'
  if (prefix.toUpperCase() === 'R') return 'rune'
  return undefined
}

function consumableKindFromItemType(itemType: string | undefined): ConsumableKind | undefined {
  const normalized = itemType?.trim().toLowerCase()
  if (normalized === 'dust') return 'dust'
  if (normalized === 'food') return 'food'
  if (normalized === 'rune') return 'rune'
  return undefined
}

function normalizeEffectTypeLookupName(name: string): string {
  return normalizeName(name)
    .replace(/[’]/g, "'")
    .replace(/\s*\((?:lasts|requires|when|while|if|only if)[^)]*\)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function isEffectTypeHeading(value: string): boolean {
  return (
    value.length > 1 &&
    !/^(?:Consumables Sorted by Effects?|Contents|Legend|Effect|Effects?|Other information|Also See|Thanks to)$/i.test(
      value
    ) &&
    /^[A-Z][A-Za-z /&+-]*$/.test(value)
  )
}

function extractEffectTypeSections(html: string): Array<{ effectType: string; html: string }> {
  const headingRegex =
    /<(?:b|strong)>\s*<u>([\s\S]*?)<\/u>\s*<\/(?:b|strong)>|<u>\s*<(?:b|strong)>([\s\S]*?)<\/(?:b|strong)>\s*<\/u>/gi
  const headings = [...html.matchAll(headingRegex)]
    .map((match) => {
      const index = match.index ?? 0
      const effectType = stripTags(match[1] ?? match[2] ?? '').replace(/:$/, '').trim()
      return {
        index,
        end: index + match[0].length,
        effectType,
      }
    })
    .filter(({ effectType }) => isEffectTypeHeading(effectType))

  return headings.map((heading, index) => ({
    effectType: heading.effectType,
    html: html.slice(heading.end, headings[index + 1]?.index ?? html.length),
  }))
}

function cleanSortedEffectItemName(name: string): string {
  return name
    .replace(/^•\s*/, '')
    .replace(/\s*\((?:lasts|requires|when|while|clicks?|only if|if )[^)]*\)\s*$/i, '')
    .trim()
}

function isLikelySortedEffectItemName(name: string): boolean {
  return (
    Boolean(name) &&
    name.length <= 90 &&
    !/^(?:none|n\/?a|effect|effects?|location|price|sellback|rarity|item type)$/i.test(name) &&
    /^[A-Z0-9<][A-Za-z0-9 '<>’().,&/+:-]+$/.test(name)
  )
}

function addConsumableEffectType(
  effectTypesByItem: Map<string, Set<string>>,
  itemName: string,
  effectType: string
) {
  const key = normalizeEffectTypeLookupName(itemName)
  if (!key) return
  const existing = effectTypesByItem.get(key) ?? new Set<string>()
  existing.add(effectType)
  effectTypesByItem.set(key, existing)
}

function parseConsumableEffectTypes(html: string): Map<string, string> {
  const effectTypesByItem = new Map<string, Set<string>>()
  for (const section of extractEffectTypeSections(html)) {
    for (const match of section.html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)) {
      const itemName = cleanSortedEffectItemName(stripTags(match[1] ?? ''))
      if (isLikelySortedEffectItemName(itemName)) {
        addConsumableEffectType(effectTypesByItem, itemName, section.effectType)
      }
    }
  }

  return new Map(
    [...effectTypesByItem.entries()].map(([itemName, effectTypes]) => [
      itemName,
      [...effectTypes].join(', '),
    ])
  )
}

async function fetchConsumableEffectTypes(cookie: string): Promise<Map<string, string>> {
  try {
    const html = await fetchForumPage(CONSUMABLE_EFFECT_TYPES_URL, cookie)
    return parseConsumableEffectTypes(html)
  } catch (error) {
    console.warn(
      `Could not fetch consumable effect types: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
    return new Map()
  }
}

function resolveConsumableEffectType(
  name: string,
  effectTypesByItem: Map<string, string>
): string | undefined {
  return effectTypesByItem.get(normalizeEffectTypeLookupName(name))
}

function classTagsFromListing(
  name: string,
  rowHtml: string,
  subtype: ClassAbilitySubtype
): ListingEntry['tags'] {
  const tags = new Set<string>()
  for (const tag of tagNamesFromHtml(rowHtml)) tags.add(tag)
  if (hasSeasonalAliasTag(tags) || /\bSeasonal\b/i.test(stripTags(rowHtml)) || hasSeasonalForumTag(rowHtml)) {
    tags.add('seasonal')
  }
  if (hasSpecialOfferTag(rowHtml) || /\bS-Offer\b/i.test(stripTags(rowHtml))) {
    tags.add('specialoffer')
  }
  const normalized = normalizeName(name)
  if (subtype === 'consumable' && isDefaultTempConsumable(normalized)) {
    tags.add('temp')
  } else {
    tags.delete('temp')
  }
  return [...tags].sort()
}

function classTagsFromDetail(listing: ListingEntry, html: string): string[] {
  const tags = new Set(listing.tags)
  for (const tag of tagNamesFromHtml(html)) tags.add(tag)
  if (hasSeasonalAliasTag(tags) || hasSeasonalForumTag(html)) tags.add('seasonal')
  if (hasSpecialOfferTag(html)) tags.add('specialoffer')
  return [...tags].sort()
}

function parseConsumableListing(html: string): ListingEntry[] {
  const sectionStart = html.search(/Consumables/i)
  const section = sectionStart >= 0 ? html.slice(sectionStart) : html
  const entries: ListingEntry[] = []
  const seen = new Set<string>()
  const anchorRegex = /<a\b[^>]*href=(["'])([^"']*?(?:tm|fb)\.asp\?m=\d+[^"']*)\1[^>]*>([\s\S]*?)<\/a>/gi

  for (const match of section.matchAll(anchorRegex)) {
    const rawName = stripTags(match[3])
    const name = normalizeName(rawName)
    if (
      !name ||
      /^(?:Dust|Food|Rune|Consumables?|Classes?|Armors?|Regular|Miscellaneous|Alphabetical Consumables Listing|Consumables Sorted by Effects)$/i.test(
        name
      )
    ) {
      continue
    }
    const forumUrl = directUrl(decodeHtml(match[2]))
    const lineStart = section.lastIndexOf('<br', match.index ?? 0)
    const lineEnd = section.indexOf('<br', (match.index ?? 0) + match[0].length)
    const rowHtml = section.slice(Math.max(0, lineStart), lineEnd === -1 ? section.length : lineEnd)
    const tags = classTagsFromListing(name, rowHtml, 'consumable')
    const prefixKind = consumableKindFromPrefix(stripTags(rowHtml).match(/\[([DFR])\]/i)?.[1])
    const rowText = stripTags(rowHtml)
    const key = `${name.toLowerCase()}|${forumUrl}`
    if (seen.has(key)) continue
    seen.add(key)
    entries.push({
      name,
      forumUrl,
      tags,
      subtype: 'consumable',
      consumableKind: prefixKind ?? consumableKindFromTags(tags),
      isRare: isListingRare(rowText, tags),
      isSeasonal: tags.includes('seasonal'),
      isSpecialOffer: isListingSpecialOffer(rowHtml, tags),
      retired: isListingRetired(rowText, tags),
    })
  }

  return entries
}

function parseArmorListing(html: string): ListingEntry[] {
  const sectionStart = html.search(/Physical armors that can be stored/i)
  const sectionEnd = html.search(/Regular classes that are able to be purchased/i)
  const section =
    sectionStart >= 0
      ? html.slice(sectionStart, sectionEnd > sectionStart ? sectionEnd : undefined)
      : html
  const entries: ListingEntry[] = []
  const seen = new Set<string>()
  const anchorRegex = /<a\b[^>]*href=(["'])([^"']*?(?:tm|fb)\.asp\?m=\d+[^"']*)\1[^>]*>([\s\S]*?)<\/a>/gi

  for (const match of section.matchAll(anchorRegex)) {
    const rawName = stripTags(match[3])
    const name = normalizeName(rawName)
    if (
      !name ||
      /^(?:Classes?|Abilities?|Armors?|Armors \(A-Z\)|Regular|Miscellaneous|Regular Classes \(A-Z\)|Miscellaneous Classes \(A-Z\)|Alphabetical Armors Listing)$/i.test(
        name
      )
    ) {
      continue
    }
    const forumUrl = directUrl(decodeHtml(match[2]))
    const lineStart = section.lastIndexOf('<br', match.index ?? 0)
    const lineEnd = section.indexOf('<br', (match.index ?? 0) + match[0].length)
    const rowHtml = section.slice(Math.max(0, lineStart), lineEnd === -1 ? section.length : lineEnd)
    const tags = classTagsFromListing(name, rowHtml, 'class')
    const rowText = stripTags(rowHtml)
    const key = `${name.toLowerCase()}|${forumUrl}`
    if (seen.has(key)) continue
    seen.add(key)
    entries.push({
      name,
      forumUrl,
      tags,
      subtype: 'class',
      classSubcategory: 'armor',
      isRare: isListingRare(rowText, tags),
      isSeasonal: tags.includes('seasonal'),
      isSpecialOffer: isListingSpecialOffer(rowHtml, tags),
      retired: isListingRetired(rowText, tags),
    })
  }

  return entries
}

function htmlToLines(html: string): string[] {
  return normalizeStructuredText(html, { preserveIndentation: true })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function firstField(lines: string[], label: string): string | undefined {
  const pattern = new RegExp(`^${label}:\\s*(.*)$`, 'i')
  return lines.find((line) => pattern.test(line))?.replace(pattern, '$1').trim()
}

function firstFieldMatching(lines: string[], pattern: RegExp): string | undefined {
  const line = lines.find((candidate) => pattern.test(candidate))
  return line?.replace(pattern, '$1').trim()
}

function cleanOptionalField(value: string | undefined): string | undefined {
  if (!value) return undefined
  const cleaned = cleanInlineText(value)
  return /^(?:none|n\/?a)$/i.test(cleaned) ? undefined : cleaned
}

function cleanInlineText(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([([{])\s+/g, '$1')
    .replace(/\s+([)\]}])/g, '$1')
    .trim()
}

function extractForumPageTitle(html: string): string | undefined {
  const rawTitle = html.match(/<title>\s*([\s\S]*?)\s*<\/title>/i)?.[1]
  const title = rawTitle ? normalizeName(decodeHtml(rawTitle)) : undefined
  return title || undefined
}

function classAbilityTagsWithInferredFlags(
  tags: string[],
  listing: ListingEntry
): string[] {
  const output = new Set(tags)
  if (listing.isSpecialOffer) {
    output.add('specialoffer')
  }
  return [...output].sort()
}

function cleanOtherInfo(notes: string | undefined): string | undefined {
  if (!notes) return undefined
  const cleaned = notes
    .split('\n')
    .filter((line) => !/^Appearance(?:\s+\S.*)?$/i.test(line.trim()))
    .join('\n')
    .replace(/(?:\n\s*)*<\s*Message edited by[\s\S]*$/i, '')
    .replace(/(?:\n\s*)*•\s*DF\s*$/i, '')
    .replace(/(?:\n\s*)*DF\s*$/i, '')
    .trim()
  return cleaned || undefined
}

function cleanKnownPriceArtifacts(price: string): string {
  return price.replace(/\((Standard)(?=\s*\/\s*\$)/i, '($1)')
}

function parseObtainMethods(lines: string[]): ObtainVariant[] {
  const methods: ObtainVariant[] = []
  const locationIndexes = lines
    .map((line, index) => (/^Location:/i.test(line) ? index : -1))
    .filter((index) => index >= 0)

  for (const [position, index] of locationIndexes.entries()) {
    const end = locationIndexes[position + 1] ?? lines.length
    const block = lines.slice(index, end)
    const location = cleanInlineText(firstField(block, 'Location') ?? 'N/A')
    const price = cleanKnownPriceArtifacts(cleanInlineText(firstField(block, 'Price') ?? 'N/A'))
    const requiredItems = cleanOptionalField(firstField(block, 'Required Items?'))
    const sellback = cleanOptionalField(firstField(block, 'Sellback'))
    const requirements = cleanOptionalField(firstField(block, 'Requirements?'))
    const priceType = computePriceType(price, requiredItems)
    const dmRequired = priceType === 'dm' || isDefenderMedalText(price) || isDefenderMedalText(requiredItems)
    methods.push({
      location,
      price,
      priceType,
      daRequired: false,
      ...(priceType === 'dc' ? { dcRequired: true } : {}),
      ...(dmRequired ? { dmRequired: true } : {}),
      ...(sellback ? { sellback: rephraseTimedSellback(sellback) } : {}),
      ...(requiredItems ? { requiredItems } : {}),
      ...(requirements ? { requirements } : {}),
    })
  }

  return methods
}

function parseDescription(lines: string[]): string {
  const stopIndex = lines.findIndex((line) => /^(?:Location|Requirements?|Effects?):/i.test(line))
  const descriptionLines = (stopIndex >= 0 ? lines.slice(1, stopIndex) : lines.slice(1))
    .filter((line) => !/^\((?:No DA Required|DA Required|DC Item)\)$/i.test(line))
  return descriptionLines.join(' ').trim()
}

function isFieldLine(line: string): boolean {
  return /^(?:Location|Price|Sellback|Required Items?|Requirements?|Level|Rarity|Item Type|Category|Equips Class|Effect|Effects?|Mana Cost|Cooldown|Damage Type|Element):/i.test(
    line
  )
}

function cleanDialogueLine(line: string, itemName: string): string | undefined {
  const cleaned = line
    .replace(/^\s*(?:[•\-*]\s*)+/, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return undefined
  if (/^OK$/i.test(cleaned)) return undefined
  if (normalizeName(cleaned).toLowerCase() === normalizeName(itemName).toLowerCase()) return undefined
  if (isFieldLine(cleaned)) return undefined
  return cleaned
}

function extractDialogue(lines: string[], itemName: string): string | undefined {
  const levelIndex = lines.findIndex((line) => /^Level:/i.test(line))
  const effectIndex = lines.findIndex((line, index) => index > levelIndex && /^Effects?:/i.test(line))
  if (levelIndex < 0 || effectIndex <= levelIndex + 1) return undefined

  const dialogueLines = lines
    .slice(levelIndex + 1, effectIndex)
    .map((line) => cleanDialogueLine(line, itemName))
    .filter((line): line is string => Boolean(line))
  if (dialogueLines.length === 0) return undefined

  const sections: Array<{ heading: string; quotes: string[] }> = []
  let current: { heading: string; quotes: string[] } | undefined
  const ensureCurrent = () => {
    if (!current) {
      current = { heading: '', quotes: [] }
      sections.push(current)
    }
    return current
  }

  for (const line of dialogueLines) {
    if (/:$/.test(line) || /^(?:Upon|If)\b/i.test(line)) {
      current = { heading: line, quotes: [] }
      sections.push(current)
      continue
    }
    ensureCurrent().quotes.push(line)
  }

  const rendered = sections
    .filter((section) => section.heading || section.quotes.length > 0)
    .map((section) =>
      [
        ...(section.heading ? [section.heading] : []),
        ...(section.quotes.length > 0
          ? ['  quote:', ...section.quotes.map((quote) => `  ${quote}`)]
          : []),
      ].join('\n')
    )
    .join('\n\n')
    .trim()

  return rendered || undefined
}

function extractAppearanceLinks(html: string): { urls: string[]; captions: string[] } {
  const entries: Array<{ url: string; caption: string }> = []
  for (const match of html.matchAll(/<a[^>]+href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = normalizeLinkedImageUrl(match[2] ?? '')
    if (!isLikelyLinkedImageUrl(url)) continue
    const label = stripTags(match[3] ?? '')
    if (!/^Appearance(?:\s+|$)/i.test(label)) continue
    if (entries.some((entry) => entry.url === url)) continue
    entries.push({
      url,
      caption: label.replace(/^Appearance\s*/i, '').trim() || 'Appearance',
    })
  }
  return {
    urls: entries.map((entry) => entry.url),
    captions: entries.map((entry) => entry.caption),
  }
}

function extractButtonImage(html: string): string | undefined {
  return [...html.matchAll(/<img[^>]+src=(["'])(.*?)\1[^>]*>/gi)]
    .map((match) => normalizeLinkedImageUrl(match[2] ?? ''))
    .find(
      (src) =>
        isLikelyLinkedImageUrl(src) &&
        !/\/(?:tags|icons|avatars|buttons?)\//i.test(src) &&
        !/quantcast|pm\.gif|profile|post|reply|delete|rate|topic|folder/i.test(src)
    )
}

function fixedPotionButtonImage(name: string): string | undefined {
  const url = POTION_BUTTON_IMAGES.get(normalizeName(name).toLowerCase())
  return url ? normalizeLinkedImageUrl(url) : undefined
}

function parseConsumableEffectAttack(
  html: string,
  name: string,
  effect?: string
): GuestAttack[] | undefined {
  const lines = htmlToLines(html)
  const manaCost = firstField(lines, 'Mana Cost')
  const cooldown = firstField(lines, 'Cooldown')
  const damageType = firstField(lines, 'Damage Type')
  const element = firstField(lines, 'Element')
  const buttonImageUrl = fixedPotionButtonImage(name) ?? extractButtonImage(html)
  const appearanceLinks = extractAppearanceLinks(html)

  if (!effect || (!buttonImageUrl && appearanceLinks.urls.length === 0 && !manaCost && !cooldown)) {
    return undefined
  }

  return [
    {
      name,
      effect,
      manaCost: manaCost ?? '—',
      cooldown: cooldown ?? '—',
      damageType: damageType ?? '—',
      element: element ?? '—',
      ...(buttonImageUrl ? { buttonImageUrl } : {}),
      ...(appearanceLinks.urls[0] ? { appearanceUrl: appearanceLinks.urls[0] } : {}),
      ...(appearanceLinks.urls.length > 1 ? { appearanceUrls: appearanceLinks.urls } : {}),
      ...(appearanceLinks.captions.some((caption) => caption !== 'Appearance')
        ? { appearanceCaptions: appearanceLinks.captions }
        : {}),
    },
  ]
}

function extractEquipsClass(blockHtml: string, lines: string[]): { name?: string; url?: string } {
  const labelIndex = blockHtml.search(/Equips Class:/i)
  if (labelIndex >= 0) {
    const segment = blockHtml.slice(labelIndex, labelIndex + 700)
    const lineEnd = segment.search(/<br\b|Rarity:|Item Type:|Equip Spot:|Category:/i)
    const lineHtml = lineEnd >= 0 ? segment.slice(0, lineEnd) : segment
    const anchor = lineHtml.match(/<a\b[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/i)
    if (anchor) {
      const name = normalizeName(anchor[3] ?? '')
      const url = directUrl(decodeHtml(anchor[2] ?? ''))
      return {
        ...(name ? { name } : {}),
        ...(url ? { url } : {}),
      }
    }
  }

  const fallback = cleanOptionalField(firstField(lines, 'Equips Class'))
  return fallback ? { name: normalizeName(fallback) } : {}
}

function extractOtherInfo(html: string): string | undefined {
  const match = html.match(
    /Other information(?:<\/[^>]+>|\s|:)*([\s\S]*?)(?=Also See|Thanks to|<\s*Message edited by|Post #:|All Forums >>|<\/body>|$)/i
  )
  if (!match) return undefined
  const notes = normalizeStructuredText(match[1], { preserveIndentation: true })
    .replace(/^Other information:?/i, '')
    .trim()
  return cleanOtherInfo(notes)
}

function isDialogueTitleContext(html: string, index: number): boolean {
  const beforeText = stripTags(html.slice(Math.max(0, index - 240), index))
  return /(?:^|\s)(?:Upon|If)\b[^:]{0,160}:\s*$/i.test(beforeText)
}

function isForumAuthorContext(html: string, index: number): boolean {
  const afterText = stripTags(html.slice(index, index + 180))
  return /^\s*[\w .'-]{1,40}\s*->\s*/.test(afterText)
}

function titleMatches(html: string): Array<{ title: string; index: number; end: number }> {
  const matches = [
    ...html.matchAll(
      /<(?:b|strong)>\s*(?:<font\b[^>]*>)?\s*([^<\n][^<\n]+?)\s*(?:<\/font>)?\s*<\/(?:b|strong)>/gi
    ),
    ...html.matchAll(
      /<font\b[^>]*>\s*<(?:b|strong)>\s*([^<\n][^<\n]+?)\s*<\/(?:b|strong)>\s*<\/font>/gi
    ),
  ]
  const seen = new Set<string>()
  return matches
    .map((match) => ({
      title: normalizeName(match[1]),
      index: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
    }))
    .sort((a, b) => a.index - b.index || a.end - b.end)
    .filter(
      ({ title, index }) =>
        Boolean(title) &&
        !isDialogueTitleContext(html, index) &&
        !isForumAuthorContext(html, index) &&
        !/^\[\d+\]$/.test(title) &&
        !/^(?:Upon|If)\b.*:$/i.test(title) &&
        !/^(?:OK|Location|Price|Sellback|Level|Rarity|Effect|Effects|Other information|Also See|Advanced Edition)$/i.test(
          title
        ) &&
        (() => {
          const key = `${normalizeName(title).toLowerCase()}|${Math.floor(index / 80)}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })()
    )
}

function parseDetailBlocks(html: string, sourceUrl: string, fallbackName: string): ParsedDetail[] {
  const titles = titleMatches(html)
  const usableTitles = titles.length > 0 ? titles : [{ title: fallbackName, index: 0, end: 0 }]

  return usableTitles
    .map((title, index): ParsedDetail | undefined => {
      const next = usableTitles[index + 1]
      const block = html.slice(title.end, next?.index ?? html.length)
      const blockWithLeadIn = html.slice(Math.max(0, title.index - 600), next?.index ?? html.length)
      const lines = [title.title, ...htmlToLines(block)]
      const obtainMethods = parseObtainMethods(lines)
      if (obtainMethods.length === 0 && !lines.some((line) => /^Effect:/i.test(line))) return undefined
      const effect = cleanOptionalField(firstFieldMatching(lines, /^Effects?:\s*(.*)$/i))
      const level = cleanOptionalField(firstField(lines, 'Level'))
      const rarity = cleanOptionalField(firstField(lines, 'Rarity'))
      const itemType = cleanOptionalField(firstField(lines, 'Item Type'))
      const consumableKind = consumableKindFromItemType(firstField(lines, 'Item Type'))
      const equipsClass = extractEquipsClass(block, lines)
      return {
        name: title.title,
        description: parseDescription(lines),
        forumUrl: sourceUrl,
        sourceUrl,
        location: obtainMethods[0]?.location,
        price: obtainMethods[0]?.price ?? 'N/A',
        sellback: obtainMethods[0]?.sellback,
        requiredItems: obtainMethods[0]?.requiredItems,
        requirements: obtainMethods[0]?.requirements,
        effect,
        equipsClass: equipsClass.name,
        equipsClassUrl: equipsClass.url,
        attacks: parseConsumableEffectAttack(blockWithLeadIn, title.title, effect),
        dialogue: extractDialogue(lines, title.title),
        level,
        rarity,
        itemType,
        consumableKind,
        notes: extractOtherInfo(block),
        obtainMethods,
      }
    })
    .filter((detail): detail is ParsedDetail => Boolean(detail))
}

function mergeParsedDetails(details: ParsedDetail[]): ParsedDetail[] {
  const merged: ParsedDetail[] = []

  for (const detail of details) {
    const normalizedName = normalizeName(detail.name).toLowerCase()
    const existing = merged.find(
      (candidate) =>
        normalizeName(candidate.name).toLowerCase() === normalizedName &&
        candidate.sourceUrl === detail.sourceUrl &&
        (!candidate.level || !detail.level || candidate.level === detail.level)
    )
    if (!existing) {
      merged.push({ ...detail, obtainMethods: [...detail.obtainMethods] })
      continue
    }

    existing.description ||= detail.description
    existing.location ||= detail.location
    existing.price = existing.price === 'N/A' ? detail.price : existing.price
    existing.sellback ||= detail.sellback
    existing.requiredItems ||= detail.requiredItems
    existing.requirements ||= detail.requirements
    existing.effect ||= detail.effect
    existing.effectType ||= detail.effectType
    existing.equipsClass ||= detail.equipsClass
    existing.equipsClassUrl ||= detail.equipsClassUrl
    existing.attacks ||= detail.attacks
    existing.dialogue ||= detail.dialogue
    existing.level ||= detail.level
    existing.rarity ||= detail.rarity
    existing.itemType ||= detail.itemType
    existing.consumableKind ||= detail.consumableKind
    existing.notes ||= detail.notes
    existing.obtainMethods = [...existing.obtainMethods, ...detail.obtainMethods]
  }

  return merged
}

function applyConsumableEffectTypes(
  details: ParsedDetail[],
  effectTypesByItem: Map<string, string>
): ParsedDetail[] {
  if (effectTypesByItem.size === 0) return details
  return details.map((detail) => ({
    ...detail,
    effectType: detail.effectType ?? resolveConsumableEffectType(detail.name, effectTypesByItem),
  }))
}

function entrySlug(name: string): string {
  return `class-ability-${slugify(normalizeName(name))}`
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeClassLookupName(value: string): string {
  return normalizeName(value)
    .toLowerCase()
    .replace(/[^a-z0-9|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
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
  const normalizedItem = normalizeClassLookupName(itemName)

  for (const form of forms) {
    const candidate = normalizeClassLookupName(`${familyBase} ${form}`)
    if (normalizedItem === candidate) return form
  }

  return undefined
}

function applyAccessFlags(
  methods: ObtainVariant[],
  listing: ListingEntry,
  html: string
): ObtainVariant[] {
  const tags = classTagsFromDetail(listing, html)
  const daRequired = tags.includes('da') || /\/tags\/DA\.(?:png|jpg|jpeg|gif)/i.test(html)
  return methods.map((method) => ({
    ...method,
    daRequired,
    dcRequired: method.dcRequired || tags.includes('dc') || method.priceType === 'dc',
    dmRequired:
      method.dmRequired ||
      method.priceType === 'dm' ||
      isDefenderMedalText(method.price) ||
      isDefenderMedalText(method.requiredItems),
  }))
}

function detailToItem(detail: ParsedDetail, listing: ListingEntry, html: string): ClassAbilityItem {
  const tags = classTagsFromDetail(listing, html)
  const obtainMethods = applyAccessFlags(detail.obtainMethods, listing, html)
  const resolvedTags = classAbilityTagsWithInferredFlags(tags, listing)
  const priceTypes = obtainMethods.map((method) => method.priceType)
  return {
    id: entrySlug(detail.name),
    name: detail.name,
    slug: entrySlug(detail.name),
    type: 'class-ability',
    subtype: listing.subtype,
    classSubcategory: listing.classSubcategory,
    consumableKind: detail.consumableKind ?? listing.consumableKind,
    description: detail.description,
    forumUrl: detail.forumUrl,
    sourceUrl: detail.sourceUrl,
    location: detail.location,
    price: detail.price,
    sellback: detail.sellback,
    requiredItems: detail.requiredItems,
    requirements: detail.requirements,
    effect: detail.effect,
    effectType: detail.effectType,
    equipsClass: detail.equipsClass,
    equipsClassUrl: detail.equipsClassUrl,
    attacks: detail.attacks,
    dialogue: detail.dialogue,
    obtainMethods,
    level: detail.level,
    rarity: detail.rarity,
    notes: detail.notes,
    alsoSee: [],
    tags: resolvedTags,
    daRequired: obtainMethods.some((method) => method.daRequired),
    dcRequired: priceTypes.includes('dc') || resolvedTags.includes('dc'),
    dmRequired: obtainMethods.some((method) => method.dmRequired) || resolvedTags.includes('dm'),
    hasFree: priceTypes.includes('free'),
    hasMerge: priceTypes.includes('merge'),
    isTemp: listing.subtype === 'consumable'
      ? resolvedTags.includes('temp') || isDefaultTempConsumable(detail.name)
      : resolvedTags.includes('temp'),
    isRare: listing.isRare,
    isSeasonal: resolvedTags.includes('seasonal'),
    isSpecialOffer: listing.isSpecialOffer || resolvedTags.includes('specialoffer'),
    retired: listing.retired,
  }
}

function detailsToEntry(details: ParsedDetail[], listing: ListingEntry, html: string): ClassAbilityEntry {
  const tags = classTagsFromDetail(listing, html)
  const sourceRefs = dedupeSourceRefs(
    details.map((detail) => ({
      url: detail.sourceUrl,
      title: detail.name,
    }))
  )
  if (details.length === 1) {
    const item = detailToItem(details[0], listing, html)
    return {
      ...item,
      alsoSee: extractAlsoSeeRefs(html).map((ref) => ({
        name: ref.name,
        slug: entrySlug(ref.name),
        type: 'class-ability',
        url: ref.url,
      })),
      retired: item.retired || hasRetiredTag(html),
    }
  }

  let variants: LevelVariant[] = details.map((detail, index) => {
    const obtainMethods = applyAccessFlags(detail.obtainMethods, listing, html)
    return {
      levelNumber: index + 1,
      levelDisplay: detail.level ?? String(index + 1),
      actualLevel: detail.level ? Number.parseInt(detail.level, 10) : undefined,
      variantName:
        getParentheticalFamilyVariantName(detail.name, listing.name) ??
        (normalizeName(detail.name)
          .replace(new RegExp(`^${escapeRegex(normalizeName(listing.name))}\\s*`, 'i'), '')
          .trim() || undefined),
      name: detail.name,
      damage: '—',
      stats: '—',
      obtainVariants: obtainMethods,
      sourceUrl: detail.sourceUrl,
      description: detail.description,
      rarity: detail.rarity,
      effect: detail.effect,
      effectType: detail.effectType,
      equipsClass: detail.equipsClass,
      equipsClassUrl: detail.equipsClassUrl,
      attacks: detail.attacks,
      dialogue: detail.dialogue,
      notes: detail.notes,
      classAbilitySubtype: listing.classSubcategory ?? detail.consumableKind ?? listing.consumableKind,
      retired: listing.retired || hasRetiredTag(html),
    }
  })
  const noteIndexes = variants.flatMap((variant, index) => (variant.notes ? [index] : []))
  let sharedNotes =
    details.every((detail) => detail.notes === details[0]?.notes) ? details[0]?.notes : undefined
  if (
    !sharedNotes &&
    noteIndexes.length === 1 &&
    noteIndexes[0] === variants.length - 1
  ) {
    sharedNotes = variants[noteIndexes[0]].notes
    variants = variants.map((variant, index) =>
      index === noteIndexes[0] ? { ...variant, notes: undefined } : variant
    )
  }
  const sourceUrls = new Set(variants.map((variant) => variant.sourceUrl).filter(Boolean))
  const effectIndexes = variants.flatMap((variant, index) => (variant.effect ? [index] : []))
  const uniqueEffects = [...new Set(effectIndexes.map((index) => variants[index].effect))]
  const effectTypeIndexes = variants.flatMap((variant, index) => (variant.effectType ? [index] : []))
  const uniqueEffectTypes = [
    ...new Set(effectTypeIndexes.map((index) => variants[index].effectType)),
  ]
  const attackIndexes = variants.flatMap((variant, index) => (variant.attacks?.length ? [index] : []))
  const dialogueIndexes = variants.flatMap((variant, index) => (variant.dialogue ? [index] : []))
  const uniqueDialogues = [...new Set(dialogueIndexes.map((index) => variants[index].dialogue))]
  const equipsClassIndexes = variants.flatMap((variant, index) => (variant.equipsClass ? [index] : []))
  const uniqueEquipsClasses = [
    ...new Set(equipsClassIndexes.map((index) => variants[index].equipsClass)),
  ]
  let sharedEffect = details.length === 1 ? details[0]?.effect : undefined
  let sharedEffectType = details.length === 1 ? details[0]?.effectType : undefined
  let sharedEquipsClass = details.length === 1 ? details[0]?.equipsClass : undefined
  let sharedEquipsClassUrl = details.length === 1 ? details[0]?.equipsClassUrl : undefined
  let sharedAttacks = details.length === 1 ? details[0]?.attacks : undefined
  let sharedDialogue = details.length === 1 ? details[0]?.dialogue : undefined
  if (
    !sharedEffect &&
    uniqueEffects.length === 1 &&
    effectIndexes.length > 0 &&
    (effectIndexes.length === variants.length ||
      (sourceUrls.size <= 1 &&
        effectIndexes.length === 1 &&
        effectIndexes[0] === variants.length - 1))
  ) {
    sharedEffect = uniqueEffects[0]
    sharedAttacks =
      attackIndexes.length === 1
        ? (variants[attackIndexes[0]].attacks as GuestAttack[] | undefined)
        : sharedAttacks
    variants = variants.map((variant, index) =>
      effectIndexes.includes(index) ? { ...variant, effect: undefined, attacks: undefined } : variant
    )
  }
  if (
    !sharedEffectType &&
    uniqueEffectTypes.length === 1 &&
    effectTypeIndexes.length > 0 &&
    (effectTypeIndexes.length === variants.length ||
      (sourceUrls.size <= 1 &&
        effectTypeIndexes.length === 1 &&
        effectTypeIndexes[0] === variants.length - 1))
  ) {
    sharedEffectType = uniqueEffectTypes[0]
    variants = variants.map((variant, index) =>
      effectTypeIndexes.includes(index) ? { ...variant, effectType: undefined } : variant
    )
  }
  if (
    !sharedDialogue &&
    uniqueDialogues.length === 1 &&
    dialogueIndexes.length > 0 &&
    (dialogueIndexes.length === variants.length ||
      (sourceUrls.size <= 1 &&
        dialogueIndexes.length === 1 &&
        dialogueIndexes[0] === variants.length - 1))
  ) {
    sharedDialogue = uniqueDialogues[0]
    variants = variants.map((variant, index) =>
      dialogueIndexes.includes(index) ? { ...variant, dialogue: undefined } : variant
    )
  }
  if (
    !sharedEquipsClass &&
    uniqueEquipsClasses.length === 1 &&
    equipsClassIndexes.length > 0 &&
    equipsClassIndexes.length === variants.length
  ) {
    sharedEquipsClass = uniqueEquipsClasses[0]
    const urlIndex =
      equipsClassIndexes.find((index) => variants[index].equipsClassUrl) ?? equipsClassIndexes[0]
    sharedEquipsClassUrl = urlIndex === undefined ? undefined : variants[urlIndex].equipsClassUrl
    variants = variants.map((variant, index) =>
      equipsClassIndexes.includes(index)
        ? { ...variant, equipsClass: undefined, equipsClassUrl: undefined }
        : variant
    )
  }
  const allMethods = variants.flatMap((variant) => variant.obtainVariants)
  const resolvedTags = classAbilityTagsWithInferredFlags(tags, listing)
  return {
    id: entrySlug(listing.name),
    familyName: normalizeName(listing.name),
    slug: entrySlug(listing.name),
    aliasSlugs: details
      .map((detail) => entrySlug(detail.name))
      .filter((slug) => slug !== entrySlug(listing.name)),
    type: 'class-ability',
    subtype: listing.subtype,
    classSubcategory: listing.classSubcategory,
    consumableKind: details[0]?.consumableKind ?? listing.consumableKind,
    forumUrl: directUrl(listing.forumUrl),
    familyOrigin: 'single-thread',
    familySources: sourceRefs,
    shared: {
      description: details[0]?.description ?? '',
      rarity: details[0]?.rarity,
      effect: sharedEffect,
      effectType: sharedEffectType,
      equipsClass: sharedEquipsClass,
      equipsClassUrl: sharedEquipsClassUrl,
      ...(sharedAttacks?.length ? { attacks: sharedAttacks } : {}),
      dialogue: sharedDialogue,
      notes: sharedNotes,
      alsoSee: extractAlsoSeeRefs(html).map((ref) => ({
        name: ref.name,
        slug: entrySlug(ref.name),
        type: 'class-ability',
        url: ref.url,
      })),
    },
    levelVariants: variants,
    tags: resolvedTags,
    hasDA: allMethods.some((method) => method.daRequired),
    hasDC: allMethods.some((method) => method.priceType === 'dc'),
    hasDM: allMethods.some((method) => method.dmRequired || method.priceType === 'dm'),
    hasFree: allMethods.some((method) => method.priceType === 'free'),
    hasMerge: allMethods.some((method) => method.priceType === 'merge'),
    levelRange:
      variants.length > 1
        ? `${variants[0].levelDisplay}-${variants[variants.length - 1].levelDisplay}`
        : variants[0]?.levelDisplay,
    elements: [],
    isTemp: listing.subtype === 'consumable'
      ? resolvedTags.includes('temp') || isDefaultTempConsumable(listing.name)
      : resolvedTags.includes('temp'),
    isRare: listing.isRare,
    isSeasonal: resolvedTags.includes('seasonal'),
    isSpecialOffer: listing.isSpecialOffer || resolvedTags.includes('specialoffer'),
    retired: listing.retired || hasRetiredTag(html),
  }
}

function dataFileForSubtype(subtype: ClassAbilitySubtype): string {
  return subtype === 'class' ? 'classes.json' : 'class-consumables.json'
}

async function readExisting(subtype: ClassAbilitySubtype): Promise<ClassAbilityEntry[]> {
  try {
    return JSON.parse(
      await readFile(resolve(DATA_DIR, dataFileForSubtype(subtype)), 'utf8')
    ) as ClassAbilityEntry[]
  } catch {
    return []
  }
}

function dedupeSourceRefs(refs: Array<{ url: string; title: string }>) {
  const seen = new Set<string>()
  return refs.filter((ref) => {
    const key = `${ref.url}|${ref.title}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function itemToArmorVariant(item: ClassAbilityItem, variantName: string, index: number): LevelVariant {
  return {
    levelNumber: index + 1,
    levelDisplay: item.level ?? String(index + 1),
    actualLevel: item.level ? Number.parseInt(item.level, 10) : undefined,
    variantName,
    name: item.name,
    damage: '—',
    stats: '—',
    obtainVariants: item.obtainMethods ?? [
      {
        location: item.location ?? 'N/A',
        price: item.price ?? 'N/A',
        priceType: computePriceType(item.price ?? 'N/A', item.requiredItems),
        daRequired: Boolean(item.daRequired),
        dcRequired: Boolean(item.dcRequired),
        dmRequired: Boolean(item.dmRequired),
        sellback: item.sellback,
        requiredItems: item.requiredItems,
        requirements: item.requirements,
      },
    ],
    sourceUrl: item.sourceUrl,
    description: item.description,
    rarity: item.rarity,
    effect: item.effect,
    effectType: item.effectType,
    equipsClass: item.equipsClass,
    equipsClassUrl: item.equipsClassUrl,
    attacks: item.attacks,
    dialogue: item.dialogue,
    notes: item.notes,
    classAbilitySubtype: item.classSubcategory ?? item.consumableKind,
    retired: item.retired,
  }
}

function itemToArmorMethodVariant(
  item: ClassAbilityItem,
  method: ObtainVariant,
  variantName: string,
  index: number,
  access: { daRequired: boolean; dcRequired?: boolean }
): LevelVariant {
  const obtainVariant: ObtainVariant = {
    ...method,
    daRequired: access.daRequired,
    dcRequired: access.dcRequired,
  }
  if (!access.dcRequired && obtainVariant.priceType !== 'dc') {
    delete obtainVariant.dcRequired
  }

  return {
    levelNumber: index + 1,
    levelDisplay: item.level ?? String(index + 1),
    actualLevel: item.level ? Number.parseInt(item.level, 10) : undefined,
    variantName,
    name: item.name,
    damage: '—',
    stats: '—',
    obtainVariants: [obtainVariant],
    sourceUrl: item.sourceUrl,
    description: item.description,
    rarity: item.rarity,
    effect: item.effect,
    effectType: item.effectType,
    equipsClass: item.equipsClass,
    equipsClassUrl: item.equipsClassUrl,
    attacks: item.attacks,
    dialogue: item.dialogue,
    classAbilitySubtype: item.classSubcategory ?? item.consumableKind,
    retired: item.retired,
  }
}

function isClassArmorItem(entry: ClassAbilityEntry): entry is ClassAbilityItem {
  return !('levelVariants' in entry) && entry.subtype === 'class' && entry.classSubcategory === 'armor'
}

function mergeClassArmorPairFamily(
  entries: ClassAbilityEntry[],
  options: {
    familyName: string
    baseName: string
    ancientName: string
    variants: [string, string]
  }
): ClassAbilityEntry[] {
  const base = entries.find(
    (entry): entry is ClassAbilityItem =>
      isClassArmorItem(entry) && normalizeName(entry.name).toLowerCase() === options.baseName.toLowerCase()
  )
  const ancient = entries.find(
    (entry): entry is ClassAbilityItem =>
      isClassArmorItem(entry) &&
      normalizeName(entry.name).toLowerCase() === options.ancientName.toLowerCase()
  )
  if (!base || !ancient) return entries

  const familySlug = entrySlug(options.familyName)
  const variants = [
    itemToArmorVariant(base, options.variants[0], 0),
    itemToArmorVariant(ancient, options.variants[1], 1),
  ]
  const allMethods = variants.flatMap((variant) => variant.obtainVariants)
  const tags = [...new Set([...base.tags, ...ancient.tags])].sort()
  const familyNames = new Set([options.baseName.toLowerCase(), options.ancientName.toLowerCase()])
  const family: ClassAbilityEntry = {
    id: familySlug,
    familyName: options.familyName,
    slug: familySlug,
    aliasSlugs: [...new Set([base.slug, ancient.slug])],
    type: 'class-ability',
    subtype: 'class',
    classSubcategory: 'armor',
    forumUrl: base.forumUrl,
    familyOrigin: 'cross-post',
    familySources: dedupeSourceRefs([
      { url: base.sourceUrl, title: base.name },
      { url: ancient.sourceUrl, title: ancient.name },
    ]),
    shared: {
      description: base.description || ancient.description,
      rarity: base.rarity ?? ancient.rarity,
      alsoSee: [
        ...(base.alsoSee ?? []),
        ...(ancient.alsoSee ?? []),
      ].filter((ref) => !familyNames.has(normalizeName(ref.name).toLowerCase())),
    },
    levelVariants: variants,
    tags,
    hasDA: allMethods.some((method) => method.daRequired),
    hasDC: allMethods.some((method) => method.priceType === 'dc' || method.dcRequired),
    hasDM: allMethods.some((method) => method.priceType === 'dm' || method.dmRequired),
    hasFree: allMethods.some((method) => method.priceType === 'free'),
    hasMerge: allMethods.some((method) => method.priceType === 'merge'),
    levelRange: '1',
    elements: [],
    isTemp: tags.includes('temp'),
    isRare: Boolean(base.isRare || ancient.isRare),
    isSeasonal: Boolean(base.isSeasonal || ancient.isSeasonal),
    isSpecialOffer: Boolean(base.isSpecialOffer || ancient.isSpecialOffer),
    retired: Boolean(base.retired || ancient.retired),
  }

  return entries
    .filter(
      (entry) =>
        !(
          isClassArmorItem(entry) &&
          familyNames.has(normalizeName(entry.name).toLowerCase())
        )
    )
    .concat(family)
}

function mergeShadowArmorFamilies(entries: ClassAbilityEntry[]): ClassAbilityEntry[] {
  return ['Mage', 'Rogue', 'Warrior'].reduce(
    (currentEntries, className) =>
      mergeClassArmorPairFamily(currentEntries, {
        familyName: `Shadow ${className} Armor`,
        baseName: `Shadow ${className} Armor`,
        ancientName: `Ancient Shadow ${className} Armor`,
        variants: ['(Base)', 'Ancient'],
      }),
    entries
  )
}

function mergeReforgedTimeArmorFamilies(entries: ClassAbilityEntry[]): ClassAbilityEntry[] {
  const pairs = [
    'Archivist',
    'Avatar of Time',
    'ChronoZ',
    'Chronocorruptor',
    'ShadowWalker of Time',
    'TimeKiller',
  ]
  const withSimplePairs = pairs.reduce(
    (currentEntries, familyName) =>
      mergeClassArmorPairFamily(currentEntries, {
        familyName,
        baseName: familyName,
        ancientName: `Reforged ${familyName}`,
        variants: ['(Base)', 'Reforged'],
      }),
    entries
  )

  return mergeClassArmorPairFamily(withSimplePairs, {
    familyName: 'Chronomancer Armor',
    baseName: 'Chronomancer Armor',
    ancientName: 'Reforged Chronomancer',
    variants: ['(Base)', 'Reforged'],
  })
}

function buildSinglePostArmorFamily(
  item: ClassAbilityItem,
  variants: LevelVariant[]
): ClassAbilityEntry {
  const allMethods = variants.flatMap((variant) => variant.obtainVariants)
  const familySlug = entrySlug(item.name)
  return {
    id: familySlug,
    familyName: item.name,
    slug: familySlug,
    type: 'class-ability',
    subtype: 'class',
    classSubcategory: 'armor',
    forumUrl: item.forumUrl,
    familyOrigin: 'single-thread',
    familySources: [{ url: item.sourceUrl, title: item.name }],
    shared: {
      description: item.description,
      rarity: item.rarity,
      notes: item.notes,
      alsoSee: item.alsoSee,
    },
    levelVariants: variants,
    tags: item.tags,
    hasDA: allMethods.some((method) => method.daRequired),
    hasDC: allMethods.some((method) => method.priceType === 'dc' || method.dcRequired),
    hasDM: allMethods.some((method) => method.priceType === 'dm' || method.dmRequired),
    hasFree: allMethods.some((method) => method.priceType === 'free'),
    hasMerge: allMethods.some((method) => method.priceType === 'merge'),
    levelRange: item.level ?? variants[0]?.levelDisplay ?? '1',
    elements: [],
    isTemp: item.isTemp,
    isRare: item.isRare,
    isSeasonal: item.isSeasonal,
    isSpecialOffer: item.isSpecialOffer,
    retired: item.retired,
  }
}

function normalizeChickenCowArmorFamilies(entries: ClassAbilityEntry[]): ClassAbilityEntry[] {
  return entries.map((entry) => {
    if (!isClassArmorItem(entry)) return entry
    const methods = entry.obtainMethods ?? []
    const normalizedName = normalizeName(entry.name).toLowerCase()
    if (normalizedName === 'chickencow armor' && methods.length >= 2) {
      return buildSinglePostArmorFamily(entry, [
        itemToArmorMethodVariant(entry, methods[0], '1', 0, {
          daRequired: false,
          dcRequired: false,
        }),
        itemToArmorMethodVariant(entry, methods[1], '1 (DC)', 1, {
          daRequired: false,
          dcRequired: true,
        }),
      ])
    }
    if (normalizedName === 'evolved chickencow armor' && methods.length >= 3) {
      return buildSinglePostArmorFamily(entry, [
        itemToArmorMethodVariant(entry, methods[0], '1 (DA)', 0, {
          daRequired: true,
          dcRequired: false,
        }),
        itemToArmorMethodVariant(entry, methods[1], '1 (DA, DC)', 1, {
          daRequired: true,
          dcRequired: true,
        }),
        itemToArmorMethodVariant(entry, methods[2], '1 (DC)', 2, {
          daRequired: false,
          dcRequired: true,
        }),
      ])
    }
    if (normalizedName === 'ascended chickencow armor' && methods.length >= 2) {
      return buildSinglePostArmorFamily(entry, [
        itemToArmorMethodVariant(entry, methods[0], '(DA)', 0, {
          daRequired: true,
          dcRequired: false,
        }),
        itemToArmorMethodVariant(entry, methods[1], '(DC)', 1, {
          daRequired: false,
          dcRequired: true,
        }),
      ])
    }
    return entry
  })
}

function mergeDoomKnightArmorFamily(entries: ClassAbilityEntry[]): ClassAbilityEntry[] {
  const base = entries.find(
    (entry): entry is ClassAbilityItem =>
      isClassArmorItem(entry) &&
      normalizeName(entry.name).toLowerCase() === 'doomknight armor'
  )
  const variantOne = entries.find(
    (entry): entry is ClassAbilityItem =>
      isClassArmorItem(entry) &&
      normalizeName(entry.name).toLowerCase() === 'doomknight variant one'
  )
  if (!base || !variantOne) return entries

  const familyName = 'DoomKnight (Armor, Variant One)'
  const familySlug = entrySlug(familyName)
  const variants = [
    itemToArmorVariant(base, 'Armor', 0),
    itemToArmorVariant(variantOne, 'Variant One', 1),
  ]
  const allMethods = variants.flatMap((variant) => variant.obtainVariants)
  const tags = [...new Set([...base.tags, ...variantOne.tags])].sort()
  const family: ClassAbilityEntry = {
    id: familySlug,
    familyName,
    slug: familySlug,
    aliasSlugs: [...new Set([base.slug, variantOne.slug])],
    type: 'class-ability',
    subtype: 'class',
    classSubcategory: 'armor',
    forumUrl: base.forumUrl,
    familyOrigin: 'cross-post',
    familySources: dedupeSourceRefs([
      { url: base.sourceUrl, title: base.name },
      { url: variantOne.sourceUrl, title: variantOne.name },
    ]),
    shared: {
      description: base.description,
      rarity: base.rarity,
      alsoSee: [
        ...(base.alsoSee ?? []),
        ...(variantOne.alsoSee ?? []),
      ].filter(
        (ref) =>
          !/^(?:doomknight armor|doomknight variant one)$/i.test(
            normalizeName(ref.name).toLowerCase()
          )
      ),
    },
    levelVariants: variants,
    tags,
    hasDA: allMethods.some((method) => method.daRequired),
    hasDC: allMethods.some((method) => method.priceType === 'dc' || method.dcRequired),
    hasDM: allMethods.some((method) => method.priceType === 'dm' || method.dmRequired),
    hasFree: allMethods.some((method) => method.priceType === 'free'),
    hasMerge: allMethods.some((method) => method.priceType === 'merge'),
    levelRange: '1',
    elements: [],
    isTemp: tags.includes('temp'),
    isRare: Boolean(base.isRare || variantOne.isRare),
    isSeasonal: Boolean(base.isSeasonal || variantOne.isSeasonal),
    isSpecialOffer: Boolean(base.isSpecialOffer || variantOne.isSpecialOffer),
    retired: Boolean(base.retired || variantOne.retired),
  }

  return entries
    .filter(
      (entry) =>
        !(
          entry.type === 'class-ability' &&
          entry.subtype === 'class' &&
          !('levelVariants' in entry) &&
          /^(?:DoomKnight Armor|DoomKnight Variant One)$/i.test(normalizeName(entry.name))
        )
    )
    .concat(family)
}

function normalizeGnomishPersonalSteamtankFamily(entries: ClassAbilityEntry[]): ClassAbilityEntry[] {
  const oldSlug = entrySlug('Gnomish Personal Steamtank Vr 1.0')
  const familyName = 'Gnomish Personal Steamtank (Vr 1.0, Mk II)'
  const familySlug = entrySlug(familyName)
  return entries.map((entry) => {
    if (
      !('levelVariants' in entry) ||
      entry.subtype !== 'class' ||
      entry.classSubcategory !== 'armor' ||
      !/^(?:gnomish personal steamtank vr 1\.0|gnomish personal steamtank mk ii|gnomish personal steamtank \(vr 1\.0, mk ii\))$/i.test(
        normalizeName(entry.familyName)
      )
    ) {
      return entry
    }
    return {
      ...entry,
      id: familySlug,
      familyName,
      slug: familySlug,
      aliasSlugs: [
        ...new Set([
          oldSlug,
          ...(entry.aliasSlugs ?? []),
          ...entry.levelVariants.map((variant) => entrySlug(variant.name ?? '')),
        ].filter(Boolean)),
      ],
      levelVariants: entry.levelVariants.map((variant) => ({
        ...variant,
        variantName:
          getParentheticalFamilyVariantName(variant.name ?? '', familyName) ?? variant.variantName,
      })),
    }
  })
}

function normalizeKnownClassAbilityTextArtifacts(entries: ClassAbilityEntry[]): ClassAbilityEntry[] {
  return entries.map((entry) => {
    if ('levelVariants' in entry) {
      return {
        ...entry,
        levelVariants: entry.levelVariants.map((variant) => ({
          ...variant,
          obtainVariants: variant.obtainVariants.map((method) => ({
            ...method,
            price: cleanKnownPriceArtifacts(method.price),
          })),
        })),
      }
    }
    const obtainMethods = entry.obtainMethods?.map((method) => ({
      ...method,
      price: cleanKnownPriceArtifacts(method.price),
    }))
    return {
      ...entry,
      price: entry.price ? cleanKnownPriceArtifacts(entry.price) : entry.price,
      ...(obtainMethods ? { obtainMethods } : {}),
    }
  })
}

function normalizeClassAbilityEntries(entries: ClassAbilityEntry[]): ClassAbilityEntry[] {
  const normalized = normalizeGnomishPersonalSteamtankFamily(
    normalizeChickenCowArmorFamilies(
      mergeReforgedTimeArmorFamilies(mergeShadowArmorFamilies(mergeDoomKnightArmorFamily(entries)))
    )
  )
  return removeAliasPrimaryDuplicates(
    dedupeEntriesBySlug(normalizeKnownClassAbilityTextArtifacts(normalized))
  )
}

function mergeEntries(existing: ClassAbilityEntry[], incoming: ClassAbilityEntry[], fresh: boolean) {
  if (fresh) return normalizeClassAbilityEntries(dedupeEntriesBySlug(incoming))
  const bySlug = new Map(existing.map((entry) => [entry.slug, entry]))
  for (const entry of incoming) bySlug.set(entry.slug, entry)
  return normalizeClassAbilityEntries(dedupeEntriesBySlug([...bySlug.values()]))
}

function entryDisplayName(entry: ClassAbilityEntry): string {
  return 'familyName' in entry ? entry.familyName : entry.name
}

function compareDuplicateQuality(first: ClassAbilityEntry, second: ClassAbilityEntry): number {
  const firstName = entryDisplayName(first)
  const secondName = entryDisplayName(second)
  const firstPlus = /\+$/.test(firstName.trim())
  const secondPlus = /\+$/.test(secondName.trim())
  if (firstPlus !== secondPlus) return firstPlus ? 1 : -1
  return firstName.length - secondName.length
}

function dedupeEntriesBySlug(entries: ClassAbilityEntry[]): ClassAbilityEntry[] {
  const bySlug = new Map<string, ClassAbilityEntry>()
  for (const entry of entries) {
    const existing = bySlug.get(entry.slug)
    if (!existing || compareDuplicateQuality(entry, existing) < 0) {
      bySlug.set(entry.slug, entry)
    }
  }
  return [...bySlug.values()]
}

function removeAliasPrimaryDuplicates(entries: ClassAbilityEntry[]): ClassAbilityEntry[] {
  return entries.filter(
    (entry) =>
      !entries.some(
        (owner) =>
          owner.slug !== entry.slug &&
          'aliasSlugs' in owner &&
          owner.aliasSlugs?.includes(entry.slug)
      )
  )
}

async function main() {
  const options = parseArgs()
  if (options.subtype === 'class' && options.classSubcategory !== 'armor') {
    throw new Error('Only --class-subcategory=armor is implemented for the Classes subtype.')
  }

  const cookie = loadForumCookie('classes/abilities scraper')
  const effectTypesByItem =
    options.subtype === 'consumable'
      ? await fetchConsumableEffectTypes(cookie)
      : new Map<string, string>()
  const listingHtml = await fetchForumPage(
    options.subtype === 'class' ? ARMORS_URL : CONSUMABLES_URL,
    cookie
  )
  let listings =
    options.subtype === 'class' ? parseArmorListing(listingHtml) : parseConsumableListing(listingHtml)
  if (options.subtype === 'consumable') {
    const seenListingNames = new Set(listings.map((entry) => normalizeName(entry.name).toLowerCase()))
    for (const supplemental of SUPPLEMENTAL_CONSUMABLES) {
      if (!seenListingNames.has(normalizeName(supplemental.name).toLowerCase())) {
        listings.push(supplemental)
      }
    }
  }
  if (options.names && options.names.length > 0) {
    const names = new Set(options.names.map((name) => normalizeName(name).toLowerCase()))
    listings = listings.filter((entry) => names.has(normalizeName(entry.name).toLowerCase()))
  }
  if (options.urls && options.urls.length > 0) {
    const urls = new Set(options.urls)
    listings = listings.filter((entry) => urls.has(directUrl(entry.forumUrl)))
  }
  if (options.letters && options.letters.length > 0) {
    const letters = new Set(options.letters)
    listings = listings.filter((entry) => letters.has(normalizeName(entry.name).charAt(0).toUpperCase()))
  }
  if (options.urls && options.urls.length > 0 && listings.length === 0) {
    for (const url of options.urls) {
      const html = await fetchForumPage(url, cookie)
      const details = mergeParsedDetails(parseDetailBlocks(html, url, 'Targeted Class Armor')).filter(
        (detail) => /^Armor$/i.test(detail.itemType ?? '')
      )
      const name = extractForumPageTitle(html) ?? details[0]?.name
      if (!name) continue
      const tags = classTagsFromListing(name, html, 'class')
      listings.push({
        name,
        forumUrl: url,
        tags,
        subtype: 'class',
        classSubcategory: 'armor',
        isRare: isListingRare(stripTags(html), tags),
        isSeasonal: hasSeasonalForumTag(html),
        isSpecialOffer: hasSpecialOfferTag(html) || /\bS-Offer\b/i.test(stripTags(html)),
        retired: hasRetiredTag(html),
      })
    }
  }
  if (options.limit) listings = listings.slice(0, options.limit)

  const scraped: ClassAbilityEntry[] = []
  for (const [index, listing] of listings.entries()) {
    console.log(`[${index + 1}/${listings.length}] ${listing.name}`)
    const html = await fetchForumPage(listing.forumUrl, cookie)
    const scopedListing =
      options.urls && options.urls.length > 0
        ? { ...listing, name: extractForumPageTitle(html) ?? listing.name }
        : listing
    const parsedDetails = mergeParsedDetails(
      parseDetailBlocks(html, directUrl(listing.forumUrl), listing.name)
    )
    const scopedDetails =
      listing.subtype === 'class' && listing.classSubcategory === 'armor'
        ? parsedDetails.filter((detail) => /^Armor$/i.test(detail.itemType ?? ''))
        : parsedDetails
    const details =
      options.subtype === 'consumable'
        ? applyConsumableEffectTypes(scopedDetails, effectTypesByItem)
        : scopedDetails
    if (details.length === 0) {
      if (parsedDetails.length > 0 && listing.subtype === 'class') {
        console.log(`Skipped non-armor detail page for ${listing.name}`)
      } else {
        console.warn(`No detail blocks parsed for ${listing.name}`)
      }
      continue
    }
    scraped.push(detailsToEntry(details, scopedListing, html))
    await sleep(250)
  }

  const existing = await readExisting(options.subtype)
  const output = mergeEntries(existing, scraped, options.fresh)
  output.sort((a, b) =>
    normalizeName('familyName' in a ? a.familyName : a.name).localeCompare(
      normalizeName('familyName' in b ? b.familyName : b.name)
    )
  )
  if (options.limit && !options.fresh) {
    console.log(`Parsed ${scraped.length} ${options.subtype} entries (dry run; pass --fresh to write)`)
    return
  }

  await writeFile(
    resolve(DATA_DIR, dataFileForSubtype(options.subtype)),
    `${JSON.stringify(output, null, 2)}\n`
  )
  writeClassAbilitiesManifest(DATA_DIR)
  console.log(`Wrote ${output.length} ${options.subtype} entries`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
