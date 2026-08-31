import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type {
  ClassAbilityEntry,
  ClassAbilityItem,
  ClassAbilitySubtype,
  ClassSubcategory,
  ConsumableKind,
} from '../src/types/classAbility'
import type { AlsoSeeRef, LevelVariant, MechanicsBlock, ObtainVariant } from '../src/types/item'
import type { GuestAttack, GuestAttackSet, GuestStats } from '../src/types/pet'
import {
  computePriceType,
  formatVariantNameWithAccess,
  isDefenderMedalText,
} from '../src/utils/variantHelpers.ts'
import { writeClassArtifactRelations } from './lib/class-artifact-relations.ts'
import { writeClassArmorRelations } from './lib/class-armor-relations.ts'
import { writeClassDefaultWeaponRelations } from './lib/class-default-weapon-relations.ts'
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
  isSpecialCharacter?: boolean
  retired?: boolean
  releaseDate?: string
}

interface ParsedDetail {
  name: string
  description: string
  forumUrl: string
  sourceUrl: string
  releaseDate?: string
  location?: string
  price: string
  sellback?: string
  requiredItems?: string
  requirements?: string
  effect?: string
  effectType?: string
  equipsClass?: string
  equipsClassUrl?: string
  defaultWeapon?: string
  defaultWeaponUrl?: string
  guestStats?: GuestStats
  imageUrl?: string
  alternativeImages?: Array<{ url: string; caption: string }>
  attacks?: GuestAttack[]
  attackSets?: GuestAttackSet[]
  mechanics?: MechanicsBlock[]
  dialogue?: string
  level?: string
  rarity?: string
  itemType?: string
  consumableKind?: ConsumableKind
  notes?: string
  alsoSee?: AlsoSeeRef[]
  obtainMethods: ObtainVariant[]
}

interface DetailPostParts {
  primary: string
  supplemental?: string
  followups: Array<{ messageId: string; html: string }>
}

const CONSUMABLES_URL = 'https://forums2.battleon.com/f/fb.asp?m=22304639'
const CONSUMABLE_EFFECT_TYPES_URL = 'https://forums2.battleon.com/f/fb.asp?m=22304644'
const CLASSES_AZ_URL =
  'https://forums2.battleon.com/f/tm.asp?m=22303573&mpage=1&key=&#22303582'
const CLASS_RELEASE_DATES_URL = 'https://forums2.battleon.com/f/tm.asp?m=22391532'
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
  return (
    /\.(?:png|jpg|jpeg|gif|bmp)(?:[?#].*)?$/i.test(url) ||
    /(?:i\.)?imgur\.com\/(?!a\/|gallery\/)/i.test(url) ||
    /\/f\/upfiles\//i.test(url)
  )
}

function stripTags(html: string): string {
  return decodeHtml(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function directUrl(url: string): string {
  const messageId = url.match(/[?&]m=(\d+)/i)?.[1]
  return messageId ? directForumPostUrl(messageId) : url
}

function getMessageIdFromForumUrl(url: string): string | undefined {
  return url.match(/[?&]m=(\d+)/i)?.[1]
}

function extractReplyPostContent(html: string, messageId: string): string {
  const anchorRegex = new RegExp(`<a\\s+name=["']?${messageId}["']?\\b[^>]*>\\s*<\\/a>`, 'i')
  const anchorMatch = anchorRegex.exec(html)
  const slice = anchorMatch?.index === undefined ? html : html.slice(anchorMatch.index)
  const cellMatch =
    slice.match(/<td\b[^>]*class=["']?msg["']?[^>]*>([\s\S]*?)<\/td>/i) ??
    slice.match(/<span\b[^>]*class=["']?msg["']?[^>]*>([\s\S]*?)<\/span>/i)
  if (cellMatch) return cellMatch[1]

  if (/Logged in as:\s*Guest|Printable Version|All Forums\s*>>|Forum Login/i.test(html)) {
    throw new Error(`Could not isolate forum reply content for message ${messageId}`)
  }

  return html
}

async function fetchDetailPostContent(url: string, cookie: string): Promise<string> {
  const html = await fetchForumPage(url, cookie)
  const messageId = getMessageIdFromForumUrl(url)
  return messageId ? extractReplyPostContent(html, messageId) : html
}

async function fetchDetailPostParts(
  url: string,
  cookie: string
): Promise<DetailPostParts> {
  const messageId = getMessageIdFromForumUrl(url)
  if (!messageId) {
    return { primary: await fetchForumPage(url, cookie), followups: [] }
  }

  const threadUrl = url.replace(/\/fb\.asp\?/i, '/tm.asp?')
  const threadHtml = await fetchForumPage(threadUrl, cookie)
  const anchors = [...threadHtml.matchAll(/<a\s+name=["']?(\d+)["']?\b[^>]*>\s*<\/a>/gi)].map(
    (match) => match[1]
  )
  const anchorIndex = anchors.indexOf(messageId)
  if (anchorIndex < 0) {
    return {
      primary: extractReplyPostContent(await fetchForumPage(url, cookie), messageId),
      followups: [],
    }
  }

  const primary = extractReplyPostContent(threadHtml, messageId)
  const nextMessageId = anchors[anchorIndex + 1]
  const followups = anchors.slice(anchorIndex + 1).map((id) => ({
    messageId: id,
    html: extractReplyPostContent(threadHtml, id),
  }))
  if (!nextMessageId) return { primary, followups }

  return { primary, supplemental: followups[0]?.html, followups }
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
  if (tags.has('alexandersaga') || tags.has('archknight') || tags.has('specialcharacter')) {
    tags.add('special-character')
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
  if (tags.has('alexandersaga') || tags.has('archknight') || tags.has('specialcharacter')) {
    tags.add('special-character')
  }
  return [...tags].sort()
}

function parseClassReleaseDates(html: string): Map<string, string> {
  const datesByName = new Map<string, string>()
  const lines = normalizeStructuredText(html, { preserveIndentation: false })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const datePattern =
    /((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,\s+\d{4})/i
  let currentDate: string | undefined
  for (const line of lines) {
    const date = line.match(datePattern)?.[1]
    if (date && line.replace(date, '').trim().length === 0) {
      currentDate = date
      continue
    }
    if (date) currentDate = date
    if (!currentDate) continue

    const candidateText = date ? line.replace(date, '') : line
    for (const rawName of candidateText.split(/\s*(?:•|\|)\s*/)) {
      const name = normalizeName(rawName)
        .replace(/^\[[^\]]+\]\s*/, '')
        .replace(/\s*\([^)]*\)\s*$/g, '')
        .trim()
      if (
        !name ||
        /^(?:Classes?|Release Dates?|\d{4}|Contents?|Chronology)$/i.test(name)
      ) {
        continue
      }
      datesByName.set(normalizeClassLookupName(name), currentDate)
    }
  }
  return datesByName
}

async function fetchClassReleaseDates(cookie: string): Promise<Map<string, string>> {
  try {
    return parseClassReleaseDates(await fetchForumPage(CLASS_RELEASE_DATES_URL, cookie))
  } catch (error) {
    console.warn(
      `Could not fetch class release dates: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
    return new Map()
  }
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

function classSectionBounds(
  html: string,
  subcategory: Exclude<ClassSubcategory, 'armor'>
): { start: number; end?: number } {
  if (subcategory === 'regular') {
    const start = html.search(/Regular classes that are able to be purchased/i)
    const end = html.search(/Miscellaneous classes that are offered/i)
    return { start: start >= 0 ? start : 0, ...(end > start ? { end } : {}) }
  }

  const start = html.search(/Miscellaneous classes that are offered/i)
  return { start: start >= 0 ? start : 0 }
}

function parseClassListing(
  html: string,
  subcategory: Exclude<ClassSubcategory, 'armor'>
): ListingEntry[] {
  const bounds = classSectionBounds(html, subcategory)
  const section = html.slice(bounds.start, bounds.end)
  const entries: ListingEntry[] = []
  const seen = new Set<string>()
  const anchorRegex = /<a\b[^>]*href=(["'])([^"']*?(?:tm|fb)\.asp\?m=\d+[^"']*)\1[^>]*>([\s\S]*?)<\/a>/gi

  for (const match of section.matchAll(anchorRegex)) {
    const rawName = stripTags(match[3])
    const name = normalizeName(rawName)
    if (
      !name ||
      /^(?:Classes?|Abilities?|Armors?|Regular|Miscellaneous|Regular Classes \(A-Z\)|Miscellaneous Classes \(A-Z\)|Alphabetical Classes Listing)$/i.test(
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
      classSubcategory: subcategory,
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

function cleanRequirementText(value: string | undefined): string | undefined {
  const cleaned = cleanOptionalField(value)
  if (!cleaned) return undefined
  const withoutDa = cleaned
    .split(/\s*(?:;|,|\band\b)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !/^Dragon Amulet$/i.test(part) && !/^A Dragon Amulet$/i.test(part))
    .join('; ')
    .trim()
  return cleanOptionalField(withoutDa)
}

function cleanInlineText(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([([{])\s+/g, '$1')
    .replace(/\s+([)\]}])/g, '$1')
    .trim()
}

function allSameValues<T>(values: T[]): boolean {
  if (values.length <= 1) return true
  const [first] = values.map((value) => JSON.stringify(value))
  return values.every((value) => JSON.stringify(value) === first)
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

function isDisplayOnlyAppearanceLine(line: string): boolean {
  const trimmed = line.replace(/^\s*(?:[•*-]\s*)+/, '').trim()
  if (!trimmed) return true
  if (/^Appearance(?:\s+\S.*)?$/i.test(trimmed)) return true
  if (/^(?:Modern|Retro|Original|Reforged)(?:\s+Version)?:$/i.test(trimmed)) return true
  return /^[A-Za-z][A-Za-z /'-]{1,80}:\s*Appearance(?:\s+\d+(?:\.\d+)?)?(?:\s*\/\s*\d+(?:\.\d+)?)*$/i.test(
    trimmed
  )
}

function cleanOtherInfo(notes: string | undefined): string | undefined {
  if (!notes) return undefined
  const cleaned = notes
    .split('\n')
    .filter((line) => !isDisplayOnlyAppearanceLine(line))
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
    .map((line, index) => (/^(?:Location|Access Point):/i.test(line) ? index : -1))
    .filter((index) => index >= 0)

  for (const [position, index] of locationIndexes.entries()) {
    const end = locationIndexes[position + 1] ?? lines.length
    const block = lines.slice(index, end)
    const location = cleanInlineText(
      firstField(block, 'Location') ?? firstField(block, 'Access Point') ?? 'N/A'
    )
    const price = cleanKnownPriceArtifacts(cleanInlineText(firstField(block, 'Price') ?? 'N/A'))
    const requiredItems = cleanOptionalField(firstField(block, 'Required Items?'))
    const sellback = cleanOptionalField(firstField(block, 'Sellback'))
    const requirements = cleanRequirementText(firstField(block, 'Requirements?'))
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
  const stopIndex = lines.findIndex((line) =>
    /^(?:Location|Access Point|Requirements?|Level|Damage|HP|MP|Effects?):/i.test(line)
  )
  const itemName = normalizeName(lines[0] ?? '').toLowerCase()
  const descriptionLines = (stopIndex >= 0 ? lines.slice(1, stopIndex) : lines.slice(1))
    .filter((line) => !/^\((?:No DA Required|DA Required|DC Item)\)$/i.test(line))
    .filter((line) => normalizeName(line).toLowerCase() !== itemName)
  return descriptionLines.join(' ').trim()
}

function isFieldLine(line: string): boolean {
  return /^(?:Location|Access Point|Price|Sellback|Required Items?|Requirements?|Level|Rarity|Item Type|Category|Equips Class|Default Weapon|Effect|Effects?|Mana Cost|Cooldown|Damage Type|Element):/i.test(
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

function normalizeAppearanceCaption(rawCaption: string): string {
  const caption = stripTags(rawCaption)
    .replace(/\s+/g, ' ')
    .replace(/\s*:\s*$/, '')
    .trim()
  return caption.replace(/^Appearance\s*/i, '').trim() || 'Appearance'
}

function isTableValueAppearanceCaption(caption: string): boolean {
  return /^[+-]?[xy](?:\s*-\s*[xy])?$/i.test(caption.trim())
}

function cleanImageCaption(rawCaption: string | undefined, fallback: string): string {
  const caption = stripTags(rawCaption ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\s*:\s*$/, '')
    .trim()
  return caption || fallback
}

function inferCaptionPrefix(rawCaption: string | undefined): string | undefined {
  const text = stripTags(rawCaption ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  const prefix = text.match(/([A-Za-z][A-Za-z /-]{1,60}):\s*Appearance/i)?.[1]
  return prefix?.trim()
}

function inferAppearancePrefixFromContext(html: string, index: number): string | undefined {
  const lookbackHtml = html.slice(Math.max(0, index - 240), index)
  const lineStart = Math.max(
    lookbackHtml.lastIndexOf('<br'),
    lookbackHtml.lastIndexOf('<hr')
  )
  const currentLineHtml = lineStart >= 0 ? lookbackHtml.slice(lineStart) : lookbackHtml
  const lookback = stripTags(currentLineHtml)
    .replace(/\s+/g, ' ')
    .trim()
  return lookback
    .match(/([A-Za-z][A-Za-z /-]{1,60}):\s*(?:Appearance(?:\s+\d+(?:\.\d+)?)?\s*(?:\/\s*)?)?$/i)?.[1]
    ?.trim()
}

function inferImageCaptionBeforeIndex(html: string, index: number): string | undefined {
  const lookback = html.slice(Math.max(0, index - 220), index)
  const matches = [
    ...lookback.matchAll(/<(?:b|strong)>\s*([^<]+?)\s*<\/(?:b|strong)>/gi),
    ...lookback.matchAll(/<font\b[^>]*>\s*([^<]+?)\s*<\/font>/gi),
  ].sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
  const match = matches.at(-1)
  const caption = cleanImageCaption(match?.[1], '')
  if (!caption || /^(?:Appearance|Thanks to)$/i.test(caption)) return undefined
  return caption.replace(/\s+Version$/i, '').trim()
}

function inferClassImageAnchorCaption(
  sourceHtml: string,
  index: number,
  rawCaption: string | undefined
): string {
  const caption = cleanImageCaption(rawCaption, 'Alternative Image')
    .replace(/\s+Armor Set Appearance$/i, '')
    .replace(/\s+Appearance$/i, '')
    .trim()
  const lineStart = Math.max(sourceHtml.lastIndexOf('<br', index), sourceHtml.lastIndexOf('<hr', index))
  const lineHtml = sourceHtml.slice(Math.max(0, lineStart), index)
  const lineText = stripTags(lineHtml)
    .replace(/\s+/g, ' ')
    .trim()
  const prefix = [...lineText.matchAll(/([A-Za-z][A-Za-z /-]{1,60})\s+Appearance\s*:/gi)]
    .at(-1)?.[1]
    ?.trim()
  if (prefix && /^(?:Male|Female)$/i.test(caption)) {
    return `${prefix} (${caption})`
  }
  return caption
}

function disambiguatePairedClassCaptions(
  entries: Array<{ url: string; caption: string; isInlineImage: boolean }>
): Array<{ url: string; caption: string; isInlineImage: boolean }> {
  const grouped = new Map<string, number[]>()
  entries.forEach((entry, index) => {
    const key = entry.caption.toLowerCase()
    grouped.set(key, [...(grouped.get(key) ?? []), index])
  })

  return entries.map((entry, index) => {
    const indexes = grouped.get(entry.caption.toLowerCase()) ?? []
    if (indexes.length !== 2) return entry
    const pairIndex = indexes.indexOf(index)
    if (pairIndex < 0) return entry
    if (/^(?:Main|Alternative Image)$/i.test(entry.caption)) {
      return {
        ...entry,
        caption: pairIndex === 0 ? 'Male' : 'Female',
      }
    }
    return {
      ...entry,
      caption: `${entry.caption} (${pairIndex === 0 ? 'Male' : 'Female'})`,
    }
  })
}

function isClassUiImage(url: string): boolean {
  return /\/tags\/|\/icons?\/|quantcast|pm\.gif|profile|\/post(?:[./_-]|$)|\/reply(?:[./_-]|$)|\/delete(?:[./_-]|$)|\/rate(?:[./_-]|$)|\/topic(?:[./_-]|$)|\/folder/i.test(
    url
  )
}

function isAttackOrSkillButtonImage(url: string): boolean {
  return /(?:Button|button|Attack\.png|Skill-[^/]+\.png)/i.test(url)
}

function classImageNameKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function classImageUrlNameKey(url: string): string {
  const file = decodeURIComponent(url.split('/').pop() ?? url)
  return classImageNameKey(file.replace(/\.[a-z0-9]+$/i, ''))
}

function inferClassImageCaptionFromUrl(url: string): string | undefined {
  const stem = decodeURIComponent(url.split('/').pop() ?? '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_-]+/g, ' ')
  const suffix = stem.match(/\b(Modern|Original|Retro|Reforged|DeltaStar|Delta|Arcanist)\b(?:\s+\d+)?$/i)?.[1]
  return suffix
    ? suffix.replace(/^Deltastar$/i, 'DeltaStar').replace(/^([a-z])/, (value) => value.toUpperCase())
    : undefined
}

function otherInformationHeadingMatches(html: string): RegExpMatchArray[] {
  return [
    ...html.matchAll(
      /(?:(?:<b>\s*<u>)|(?:<u>\s*<b>)|<u>|<b>)\s*Other information\s*(?:(?:<\/u>\s*<\/b>)|(?:<\/b>\s*<\/u>)|<\/u>|<\/b>)/gi
    ),
  ]
}

function classAttackSectionBounds(html: string): { start: number; end: number } | undefined {
  const sectionStartMatch = html.match(
    /(?:Default Weapon:|(?:<b>)?<u>Resistances<\/u>(?:<\/b>)?|Resistances:\s*[^<\n]+)(?:[\s\S]*?)<hr\b/i
  )
  if (!sectionStartMatch?.index && !/(?:Effect:|Mana Cost:|Cooldown:)/i.test(html)) return undefined

  const start =
    sectionStartMatch?.index !== undefined
      ? sectionStartMatch.index + sectionStartMatch[0].length
      : 0
  const fallbackEnd = html
    .slice(start)
    .search(/Thanks to|<\s*Message edited by|Also See|Post #:|All Forums >>/i)
  const end = fallbackEnd >= 0 ? start + fallbackEnd : html.length

  return end > start ? { start, end } : undefined
}

function extractClassImages(html: string, className?: string): {
  imageUrl?: string
  alternativeImages?: Array<{ url: string; caption: string }>
} {
  const attackBounds = classAttackSectionBounds(html)
  const attackSkipEnd =
    attackBounds &&
    (() => {
      const section = html.slice(attackBounds.start, attackBounds.end)
      const globalNotesStart = otherInformationHeadingMatches(section).at(-1)?.index
      return globalNotesStart === undefined ? attackBounds.end : attackBounds.start + globalNotesStart
    })()
  const isInAttackSkillRange = (index: number) =>
    attackBounds && attackSkipEnd !== undefined && index >= attackBounds.start && index < attackSkipEnd
  const entries: Array<{
    url: string
    caption: string
    isInlineImage: boolean
    isArmorSetAppearance?: boolean
  }> = []
  const collectEntries = (sourceHtml: string, skipAttackRange = true) => {
    const candidates: Array<{
      index: number
      url: string
      caption: string
      isInlineImage: boolean
      isArmorSetAppearance?: boolean
    }> = []
    for (const match of sourceHtml.matchAll(/<a\b[^>]+href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)) {
      if (skipAttackRange && isInAttackSkillRange(match.index ?? 0)) continue
      const url = normalizeLinkedImageUrl(match[2] ?? '')
      if (!isLikelyLinkedImageUrl(url) || isClassUiImage(url) || isAttackOrSkillButtonImage(url)) {
        continue
      }
      const rawCaption = cleanImageCaption(match[3], '')
      const caption = inferClassImageAnchorCaption(sourceHtml, match.index ?? 0, match[3])
      if (/^(?:Appearance(?:\s+\d+(?:\.\d+)?)?|\d+(?:\.\d+)?)$/i.test(caption)) continue
      if (/^(?:Foe banished!?|this spot|these spots)$/i.test(caption)) continue
      candidates.push({
        index: match.index ?? 0,
        url,
        caption,
        isInlineImage: false,
        isArmorSetAppearance: /Armor Set Appearance/i.test(rawCaption),
      })
    }
    for (const match of sourceHtml.matchAll(/<img\b[^>]+src=(["'])(.*?)\1[^>]*>/gi)) {
      if (isInAttackSkillRange(match.index ?? 0)) continue
      const url = normalizeLinkedImageUrl(match[2] ?? '')
      if (!isLikelyLinkedImageUrl(url) || isClassUiImage(url) || isAttackOrSkillButtonImage(url)) {
        continue
      }
      candidates.push({
        index: match.index ?? 0,
        url,
        caption:
          inferImageCaptionBeforeIndex(sourceHtml, match.index ?? 0) ??
          inferClassImageCaptionFromUrl(url) ??
          cleanImageCaption(match[0], 'Main'),
        isInlineImage: true,
      })
    }

    for (const candidate of candidates.sort((a, b) => a.index - b.index)) {
      if (entries.some((entry) => entry.url === candidate.url)) continue
      entries.push({
        url: candidate.url,
        caption: candidate.caption,
        isInlineImage: candidate.isInlineImage,
        ...(candidate.isArmorSetAppearance
          ? { isArmorSetAppearance: candidate.isArmorSetAppearance }
          : {}),
      })
    }
  }

  const finalOtherInfo = otherInformationHeadingMatches(html).at(-1)
  if (finalOtherInfo?.index !== undefined) {
    collectEntries(html.slice(finalOtherInfo.index), false)
  }
  collectEntries(html)

  const classKey = className ? classImageNameKey(className) : ''
  const nameMatchedEntries =
    classKey.length >= 6
      ? entries.filter((entry) => classImageUrlNameKey(entry.url).includes(classKey))
      : []
  const sourceEntries = nameMatchedEntries.length > 0 ? nameMatchedEntries : entries
  const galleryEntries = sourceEntries.some((entry) => entry.isArmorSetAppearance)
    ? sourceEntries.filter((entry) => entry.isArmorSetAppearance)
    : sourceEntries
  const displayEntries = disambiguatePairedClassCaptions(
    galleryEntries
  )
  const main =
    displayEntries.find(
      (entry) =>
        /^(?:Modern|Original|Main)$/i.test(entry.caption) &&
        !/Exact spots?|Appearance/i.test(entry.caption)
    ) ?? displayEntries[0]
  const rest = main ? displayEntries.filter((entry) => entry.url !== main.url) : []
  return {
    ...(main ? { imageUrl: main.url } : {}),
    ...(main || rest.length
      ? {
          alternativeImages: [
            ...(main ? [{ url: main.url, caption: main.caption }] : []),
            ...rest.map((entry) => ({ url: entry.url, caption: entry.caption })),
          ],
        }
      : {}),
  }
}

function extractAttackAppearanceEntries(block: string): Array<{ url: string; caption: string }> {
  const entries: Array<{ url: string; caption: string }> = []
  for (const match of block.matchAll(/<a[^>]+href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = normalizeLinkedImageUrl(match[2] ?? '')
    if (!isLikelyLinkedImageUrl(url)) continue
    const rawCaption = match[3] ?? ''
    const caption = normalizeAppearanceCaption(rawCaption)
    if (isTableValueAppearanceCaption(caption)) continue
    if (!/^Appearance|\d+(?:\.\d+)?$/i.test(caption)) continue
    const prefix = inferCaptionPrefix(rawCaption) ?? inferAppearancePrefixFromContext(block, match.index ?? 0)
    const displayCaption =
      prefix && caption !== 'Appearance' ? `${prefix} ${caption}` : prefix ?? caption
    if (entries.some((entry) => entry.url === url)) continue
    entries.push({ url, caption: displayCaption })
  }
  return entries
}

function artifactHeadingMatches(html: string): RegExpMatchArray[] {
  return [
    ...html.matchAll(
      /(?:<(?:b|strong)>\s*)?Artifact:\s*(?:<a\b[^>]*>[\s\S]*?<\/a>|[\s\S]{1,220}?)(?=<br\b|<hr\b|<\/div>|$)/gi
    ),
  ]
}

function cleanArtifactLabel(rawHeading: string): string {
  return normalizeName(stripTags(rawHeading).replace(/^Artifact:\s*/i, ''))
}

function stripClassArtifactSections(html: string): string {
  const firstArtifact = artifactHeadingMatches(html)[0]
  if (!firstArtifact || firstArtifact.index === undefined) return html
  return html.slice(0, firstArtifact.index)
}

function hasPlayableSupportContent(html: string | undefined): html is string {
  if (!html) return false
  return (
    otherInformationHeadingMatches(html).length > 0 ||
    [...html.matchAll(/<img\b[^>]+src=(["'])(.*?)\1[^>]*>/gi)].some((match) => {
      const url = normalizeLinkedImageUrl(match[2] ?? '')
      return isLikelyLinkedImageUrl(url) && !isClassUiImage(url) && !isAttackOrSkillButtonImage(url)
    }) ||
    [...html.matchAll(/<a\b[^>]+href=(["'])(.*?)\1[^>]*>/gi)].some((match) => {
      const url = normalizeLinkedImageUrl(match[2] ?? '')
      return isLikelyLinkedImageUrl(url) && !isClassUiImage(url) && !isAttackOrSkillButtonImage(url)
    })
  )
}

function hasPlayableSkillContent(html: string | undefined): html is string {
  return Boolean(html && /(?:Effect:|Mana Cost:|Cooldown:)/i.test(html) && parseClassAttacks(html)?.length)
}

function selectPlayableSupportHtml(parts: DetailPostParts, className?: string): string | undefined {
  const candidates = parts.followups
    .map((post) => stripClassArtifactSections(post.html))
    .filter(
      (html) =>
        !artifactHeadingMatches(html).length &&
        !hasPlayableSkillContent(html) &&
        hasPlayableSupportContent(html)
    )
  if (className) {
    return (
      candidates.find((html) => Boolean(extractClassImages(html, className).imageUrl)) ??
      candidates[0]
    )
  }
  return candidates[0]
}

function playableDetailPostInputs(
  primaryHtml: string,
  primaryUrl: string,
  fallbackName: string,
  parts: DetailPostParts
): Array<{ html: string; sourceUrl: string; fallbackName: string }> {
  const playablePostTitle = (html: string) => {
    const fallbackKey = normalizeName(fallbackName).toLowerCase()
    return titleMatches(html)
      .map((title) => {
        const trailingParenthetical = stripTags(html.slice(title.end, title.end + 180))
          .trim()
          .match(/^\((?!No DA Required\b)([^)]+)\)/i)?.[1]
        const displayTitle = trailingParenthetical
          ? `${title.title} (${normalizeName(trailingParenthetical)})`
          : title.title
        return displayTitle.replace(/\s+\(No DA Required\)\s*$/i, '').trim()
      })
      .find((title) => normalizeName(title).toLowerCase().startsWith(fallbackKey))
  }
  const inputs = [
    {
      html: primaryHtml,
      sourceUrl: primaryUrl,
      fallbackName: playablePostTitle(primaryHtml) ?? fallbackName,
    },
  ]
  for (const followup of parts.followups) {
    if (artifactHeadingMatches(followup.html).length > 0) continue
    if (!hasPlayableSkillContent(followup.html)) continue
    inputs.push({
      html: followup.html,
      sourceUrl: directForumPostUrl(followup.messageId),
      fallbackName: playablePostTitle(followup.html) ?? extractForumPageTitle(followup.html) ?? fallbackName,
    })
  }
  return inputs
}

function collectMechanicsImages(html: string): Array<{ url: string; caption: string }> {
  const entries: Array<{ index: number; url: string; caption: string }> = []
  for (const match of html.matchAll(/<a\b[^>]+href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = normalizeLinkedImageUrl(match[2] ?? '')
    if (!isLikelyLinkedImageUrl(url) || isClassUiImage(url) || isAttackOrSkillButtonImage(url)) continue
    const rawCaption = cleanImageCaption(match[3], '')
    if (!/widget displaying/i.test(rawCaption)) continue
    entries.push({
      index: match.index ?? 0,
      url,
      caption: rawCaption,
    })
  }
  for (const match of html.matchAll(/<img\b[^>]+src=(["'])(.*?)\1[^>]*>/gi)) {
    const url = normalizeLinkedImageUrl(match[2] ?? '')
    if (!isLikelyLinkedImageUrl(url) || isClassUiImage(url) || isAttackOrSkillButtonImage(url)) continue
    if (entries.some((entry) => entry.url === url)) continue
    const caption =
      html
        .slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 500)
        .match(/<i>\s*([\s\S]*?)\s*<\/i>/i)?.[1] ??
      inferImageCaptionBeforeIndex(html, match.index ?? 0) ??
      'Mechanic'
    const cleanedCaption = cleanImageCaption(caption, 'Mechanic')
    if (!/widget displaying/i.test(cleanedCaption)) continue
    entries.push({ index: match.index ?? 0, url, caption: cleanedCaption })
  }
  if (entries.length === 0) {
    const widgetCaption = normalizeStructuredText(html)
      .split('\n')
      .map((line) => line.trim())
      .find((line) => /^[A-Za-z][A-Za-z' -]+['’]s widget displaying\b/i.test(line))
    const className = widgetCaption?.match(/^([A-Za-z][A-Za-z' -]+)['’]s widget displaying\b/i)?.[1]
    if (widgetCaption && className) {
      const fileName = `${className.replace(/[^A-Za-z0-9]+/g, '')}-Widget.png`
      entries.push({
        index: 0,
        url: `https://raw.githubusercontent.com/DF-Pedia/DF-Pedia/master/classes_abilities/${fileName}`,
        caption: widgetCaption,
      })
    }
  }
  return entries
    .sort((a, b) => a.index - b.index)
    .filter((entry, index, all) => all.findIndex((candidate) => candidate.url === entry.url) === index)
    .map(({ url, caption }) => ({ url, caption }))
}

function cleanupMechanicsNotes(html: string, title?: string): string | undefined {
  const imageCaptions = new Set(
    collectMechanicsImages(html).map((image) => image.caption.toLowerCase())
  )
  const normalizedTitle = title?.toLowerCase()
  const notes = normalizeStructuredText(html, { preserveIndentation: true })
    .split('\n')
    .filter((line) => {
      const cleaned = line.replace(/^\s*(?:[•*-]\s*)+/, '').trim()
      if (!cleaned) return false
      if (/^>+$/.test(cleaned)) return false
      if (normalizedTitle && cleaned.toLowerCase() === normalizedTitle) return false
      if (/^Artifact:\s*/i.test(cleaned)) return false
      if (imageCaptions.has(cleaned.toLowerCase())) return false
      if (isDisplayOnlyAppearanceLine(cleaned)) return false
      return true
    })
    .join('\n')
    .trim()
  return cleanOtherInfo(notes)
}

function extractMechanicsBlocks(html: string, title?: string): MechanicsBlock[] | undefined {
  const bounds = classAttackSectionBounds(html)
  const section = bounds ? html.slice(bounds.start, bounds.end) : html
  const pieces = section.split(/<hr\b[^>]*>/i)
  const blocks: MechanicsBlock[] = []
  for (const piece of pieces) {
    if (/(?:Effect:|Mana Cost:|Cooldown:)/i.test(piece)) break
    const images = collectMechanicsImages(piece)
    const notes = cleanupMechanicsNotes(piece, title)
    if (!notes && images.length === 0) continue
    if (!notes && images.length > 0 && images.every((image) => image.caption === 'Mechanic')) continue
    blocks.push({
      ...(title ? { title } : {}),
      ...(notes ? { notes } : {}),
      ...(images.length > 0 ? { images } : {}),
    })
  }
  return blocks.length > 0 ? blocks : undefined
}

function extractTrailingClassOtherInfo(html: string): string | undefined {
  const heading = otherInformationHeadingMatches(html).at(-1)
  if (!heading || heading.index === undefined) return undefined
  const before = html.slice(0, heading.index)
  const previousHr = before.toLowerCase().lastIndexOf('<hr')
  const sincePreviousHr = previousHr >= 0 ? before.slice(previousHr) : before
  if (/(?:Effect:|Mana Cost:|Cooldown:)/i.test(sincePreviousHr)) return undefined
  return extractOtherInfo(html, { useLast: true })
}

function parseArtifactAttackSets(htmlParts: string[]): GuestAttackSet[] | undefined {
  const sets: GuestAttackSet[] = []
  for (const html of htmlParts) {
    const headings = artifactHeadingMatches(html)
    for (const [index, heading] of headings.entries()) {
      if (heading.index === undefined) continue
      const next = headings[index + 1]
      const section = html.slice(heading.index, next?.index ?? html.length)
      const label = cleanArtifactLabel(heading[0])
      if (!label) continue
      const attacks = parseClassAttacks(section)
      if (!attacks?.length) continue
      const mechanics = extractMechanicsBlocks(section, label)
      const notes = extractTrailingClassOtherInfo(section)
      const id = slugify(label)
      const uniqueId = sets.some((set) => set.id === id) ? `${id}-${sets.length + 1}` : id
      sets.push({
        id: uniqueId,
        label,
        attacks,
        ...(notes ? { notes } : {}),
        ...(mechanics?.length ? { mechanics } : {}),
      })
    }
  }
  return sets.length > 0 ? sets : undefined
}

function extractFieldFromHtml(html: string, label: string): string | undefined {
  const escaped = escapeRegex(label)
  const match = html.match(new RegExp(`${escaped}:\\s*([\\s\\S]*?)(?=<br\\b|<hr\\b|$)`, 'i'))
  return match ? cleanInlineText(stripTags(match[1] ?? '')) : undefined
}

function parseClassStats(html: string): GuestStats | undefined {
  const stats: GuestStats = {}
  const level = extractFieldFromHtml(html, 'Level')
  const damage = extractFieldFromHtml(html, 'Damage')
  const damageType = extractFieldFromHtml(html, 'Damage Type')
  const element = extractFieldFromHtml(html, 'Element')
  const hp = extractFieldFromHtml(html, 'HP')
  const mp = extractFieldFromHtml(html, 'MP')
  if (level) stats.level = level
  if (damage) stats.damage = damage
  if (/^(?:Melee|Magic|Pierce)$/i.test(damageType ?? '')) {
    stats.damageType = damageType as 'Melee' | 'Magic' | 'Pierce'
  }
  if (element) stats.element = element
  if (hp) stats.hp = hp
  if (mp) stats.mp = mp

  const sectionText = (title: string) => {
    const match = html.match(
      new RegExp(`(?:<b>)?<u>${escapeRegex(title)}<\\/u>(?:<\\/b>)?([\\s\\S]*?)(?=(?:<b>)?<u>|<hr\\b|$)`, 'i')
    )
    return match ? normalizeStructuredText(match[1] ?? '', { preserveIndentation: true }) : ''
  }
  const parsePairs = (text: string, labels: string[]) => {
    const output: Record<string, string> = {}
    for (const label of labels) {
      const match = text.match(new RegExp(`\\b${escapeRegex(label)}:?\\s*([^\\n,]+)`, 'i'))
      if (match?.[1]) output[label.toLowerCase().replace(/[^a-z]+/g, '')] = match[1].trim()
    }
    return output
  }
  const characterStats = parsePairs(sectionText('Stats'), ['STR', 'DEX', 'INT', 'CHA', 'LUK', 'END', 'WIS'])
  if (Object.keys(characterStats).length > 0) stats.characterStats = characterStats
  const offense = parsePairs(sectionText('Offense'), ['Boost', 'Bonus', 'Crit'])
  if (Object.keys(offense).length > 0) stats.offense = offense
  const multipliers = parsePairs(sectionText('Damage Multipliers'), ['Non-Crit', 'Dex', 'DoT', 'Crit'])
  if (Object.keys(multipliers).length > 0) {
    stats.damageMultipliers = {
      nonCrit: multipliers.noncrit,
      dex: multipliers.dex,
      dot: multipliers.dot,
      crit: multipliers.crit,
    }
  }
  const defense = parsePairs(sectionText('Defense') || sectionText('Avoidance and Defense'), [
    'Melee',
    'Pierce',
    'Magic',
    'Block',
    'Parry',
    'Dodge',
  ])
  if (Object.keys(defense).length > 0) stats.defense = defense
  const reduction = parsePairs(sectionText('Damage Reduction'), ['Non-Crit', 'DoT', 'Crit'])
  if (Object.keys(reduction).length > 0) {
    stats.damageReduction = {
      nonCrit: reduction.noncrit,
      dot: reduction.dot,
      crit: reduction.crit,
    }
  }
  const resistanceText = sectionText('Resistances')
  if (resistanceText && !/^none$/i.test(resistanceText.trim())) {
    const resistances: Record<string, string> = {}
    for (const line of resistanceText.split('\n')) {
      const match = line.match(/([A-Za-z][A-Za-z ]+):?\s*([+-]?\d+%?)/)
      if (match?.[1] && match[2]) resistances[match[1].trim()] = match[2].trim()
    }
    if (Object.keys(resistances).length > 0) stats.resistances = resistances
  }

  return Object.keys(stats).length > 0 ? stats : undefined
}

function extractDefaultWeapon(blockHtml: string): { name?: string; url?: string } {
  const labelIndex = blockHtml.search(/Default Weapon:/i)
  if (labelIndex < 0) return {}
  const segment = blockHtml.slice(labelIndex, labelIndex + 700)
  const lineEnd = segment.search(/<br\b|<hr\b|(?:<b>)?<u>|Attack Type:|Element:|$/i)
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
  const fallback = lineHtml.replace(/Default Weapon:/i, '')
  const name = cleanOptionalField(stripTags(fallback))
  return name ? { name } : {}
}

function parseClassAttacks(html: string): GuestAttack[] | undefined {
  const attacks: GuestAttack[] = []
  const bounds = classAttackSectionBounds(html)
  if (!bounds) return undefined
  const section = html.slice(bounds.start, bounds.end)

  for (const block of splitClassAttackBlocks(section)) {
    if (!/Effect:|Mana Cost:|Cooldown:/i.test(block)) continue
    const nameMatch =
      block.match(/<font\s+size=['"]2['"]>\s*<b>([^<]+)<\/b>\s*<\/font>/i) ??
      block.match(/<b>\s*<font\s+size=['"]2['"]>([^<]+)<\/font>\s*<\/b>/i) ??
      block.match(/<b>\s*<u>\s*([^<]+)\s*<\/u>\s*<\/b>/i) ??
      block.match(/<u>\s*<b>\s*([^<]+)\s*<\/b>\s*<\/u>/i) ??
      block.match(/<(?:b|strong)>\s*([^<\n:]{2,80})\s*<\/(?:b|strong)>/i)
    const name = normalizeName(nameMatch?.[1] ?? 'Attack')
    if (!name || /^skip$/i.test(name)) continue
    const description = block.match(/<i>([\s\S]*?)<\/i>/i)?.[1]
    const requirements = cleanRequirementText(extractFieldFromHtml(block, 'Requirements'))
    const effect = block.match(/Effect:\s*([\s\S]*?)(?=\s*Mana Cost:|$)/i)?.[1]
    const effectText = effect ? normalizeStructuredText(effect, { preserveIndentation: true }).trim() : ''
    if (!effectText) continue
    const notesMatch = block.match(
      /Other information(?:<\/[^>]+>|\s|:)*([\s\S]*?)(?=<hr\b|$)/i
    )
    const notes = notesMatch
      ? cleanOtherInfo(
          normalizeStructuredText(notesMatch[1] ?? '', { preserveIndentation: true }).trim()
        )
      : undefined
    const appearanceEntries = extractAttackAppearanceEntries(block)
    const buttonImageUrl = [...block.matchAll(/<img\b[^>]+src=(["'])(.*?)\1[^>]*>/gi)]
      .map((match) => normalizeLinkedImageUrl(match[2] ?? ''))
      .find((url) => isLikelyLinkedImageUrl(url) && !isClassUiImage(url))
    attacks.push({
      name,
      ...(description
        ? { description: normalizeStructuredText(description, { preserveIndentation: true }).trim() }
        : {}),
      ...(requirements ? { requirements } : {}),
      effect: effectText,
      manaCost: extractFieldFromHtml(block, 'Mana Cost') ?? '—',
      cooldown: extractFieldFromHtml(block, 'Cooldown') ?? '—',
      damageType:
        extractFieldFromHtml(block, 'Damage Type') ??
        extractFieldFromHtml(block, 'Attack Type') ??
        '—',
      element: extractFieldFromHtml(block, 'Element') ?? '—',
      ...(buttonImageUrl ? { buttonImageUrl } : {}),
      ...(appearanceEntries[0] ? { appearanceUrl: appearanceEntries[0].url } : {}),
      ...(appearanceEntries.length > 1
        ? { appearanceUrls: appearanceEntries.map((entry) => entry.url) }
        : {}),
      ...(appearanceEntries.some((entry) => entry.caption !== 'Appearance')
        ? { appearanceCaptions: appearanceEntries.map((entry) => entry.caption) }
        : {}),
      ...(notes ? { notes } : {}),
    })
  }

  return attacks.length > 0 ? attacks : undefined
}

function classSkillHeadingMatches(html: string): RegExpMatchArray[] {
  return [
    ...html.matchAll(
      /(?:<font\s+size=['"]2['"]>\s*<b>\s*([^<]+?)\s*<\/b>\s*<\/font>|<b>\s*<font\s+size=['"]2['"]>\s*([^<]+?)\s*<\/font>\s*<\/b>|<b>\s*<u>\s*([^<]+?)\s*<\/u>\s*<\/b>|<u>\s*<b>\s*([^<]+?)\s*<\/b>\s*<\/u>)/gi
    ),
  ]
}

function splitClassAttackBlocks(section: string): string[] {
  const blocks: string[] = []
  for (const hrBlock of section.split(/(?:<hr\b[^>]*>|\*\s*\*\s*\*)/i)) {
    const boundaries = [0]
    for (const match of classSkillHeadingMatches(hrBlock)) {
      if (!match.index) continue
      const title = normalizeName(match.slice(1).find(Boolean) ?? '')
      if (!title || /^(?:Other information|Also See|Thanks to)$/i.test(title)) continue
      const before = hrBlock.slice(0, match.index)
      const after = hrBlock.slice(match.index, Math.min(hrBlock.length, match.index + 2500))
      if (/(?:Effect:|Mana Cost:|Cooldown:)/i.test(before) && /(?:Effect:|Mana Cost:|Cooldown:)/i.test(after)) {
        boundaries.push(match.index)
      }
    }
    boundaries.push(hrBlock.length)
    boundaries.sort((a, b) => a - b)
    for (let index = 0; index < boundaries.length - 1; index += 1) {
      const block = hrBlock.slice(boundaries[index], boundaries[index + 1]).trim()
      if (block) blocks.push(block)
    }
  }
  return blocks
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

function extractOtherInfo(html: string, options?: { useLast?: boolean }): string | undefined {
  const headings = otherInformationHeadingMatches(html)
  const heading = options?.useLast ? headings.at(-1) : headings[0]
  if (!heading) return undefined
  const start = (heading.index ?? 0) + heading[0].length
  const tail = html.slice(start)
  const endMatch = tail.search(/Also See|Thanks to|<\s*Message edited by|Post #:|All Forums >>|<\/body>|$/i)
  const body = endMatch >= 0 ? tail.slice(0, endMatch) : tail
  const imageCaptions = new Set(
    [...body.matchAll(/<a\b[^>]+href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)]
      .filter((match) => isLikelyLinkedImageUrl(normalizeLinkedImageUrl(match[2] ?? '')))
      .map((match) => cleanImageCaption(match[3], ''))
      .filter(Boolean)
      .map((caption) => caption.toLowerCase())
  )
  const notes = normalizeStructuredText(body, { preserveIndentation: true })
    .replace(/^Other information:?/i, '')
    .split('\n')
    .filter((line) => {
      const cleaned = line.replace(/^\s*(?:[•*-]\s*)+/, '').trim().toLowerCase()
      if (imageCaptions.has(cleaned)) return false
      return !(
        /appearance/i.test(cleaned) &&
        [...imageCaptions].some((caption) => caption && cleaned.includes(caption))
      )
    })
    .join('\n')
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
      raw: match[0],
    }))
    .sort((a, b) => a.index - b.index || a.end - b.end)
    .filter(
      ({ title, index, raw }) =>
        Boolean(title) &&
        !/<font\b[^>]*\bsize=(["'])2\1/i.test(raw) &&
        !isDialogueTitleContext(html, index) &&
        !isForumAuthorContext(html, index) &&
        !/^\[\d+\]$/.test(title) &&
        !/^(?:Upon|If)\b.*:$/i.test(title) &&
        !/^(?:OK|Location|Access Point|Default Weapon|Appearance|Price|Sellback|Level|Rarity|Effect|Effects|Other information|Also See|Advanced Edition)$/i.test(
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

function parseDetailBlocks(
  html: string,
  sourceUrl: string,
  fallbackName: string,
  classSubcategory?: ClassSubcategory,
  supplementalHtml?: string,
  followupHtmls: string[] = []
): ParsedDetail[] {
  const titles = titleMatches(html)
  const isPlayableClass =
    classSubcategory === 'regular' || classSubcategory === 'miscellaneous'
  const usableTitles = isPlayableClass
    ? [{ title: fallbackName, index: 0, end: 0 }]
    : titles.length > 0
      ? titles
      : [{ title: fallbackName, index: 0, end: 0 }]

  return usableTitles
    .map((title, index): ParsedDetail | undefined => {
      const next = usableTitles[index + 1]
      const block = html.slice(title.end, next?.index ?? html.length)
      const blockWithLeadIn = html.slice(Math.max(0, title.index - 600), next?.index ?? html.length)
      const cleanSupplementalHtml = supplementalHtml
        ? stripClassArtifactSections(supplementalHtml)
        : undefined
      const usesSupplementalSupport = hasPlayableSupportContent(cleanSupplementalHtml)
      const playableSupportBlock =
        isPlayableClass && usesSupplementalSupport
          ? cleanSupplementalHtml
          : blockWithLeadIn
      const lines = [title.title, ...htmlToLines(block)]
      const obtainMethods = parseObtainMethods(lines)
      const effect = cleanOptionalField(firstFieldMatching(lines, /^Effects?:\s*(.*)$/i))
      const level = cleanOptionalField(firstField(lines, 'Level'))
      const rarity = cleanOptionalField(firstField(lines, 'Rarity'))
      const itemType = cleanOptionalField(firstField(lines, 'Item Type'))
      const consumableKind = consumableKindFromItemType(firstField(lines, 'Item Type'))
      const equipsClass = extractEquipsClass(block, lines)
      const defaultWeapon = isPlayableClass ? extractDefaultWeapon(block) : {}
      const classImages = isPlayableClass ? extractClassImages(playableSupportBlock, title.title) : {}
      const guestStats = isPlayableClass ? parseClassStats(blockWithLeadIn) : undefined
      const classAttacks = isPlayableClass ? parseClassAttacks(blockWithLeadIn) : undefined
      const mechanics = isPlayableClass ? extractMechanicsBlocks(blockWithLeadIn) : undefined
      if (
        obtainMethods.length === 0 &&
        !effect &&
        !(isPlayableClass && classAttacks?.length)
      ) {
        return undefined
      }
      const attackSets = isPlayableClass
        ? parseArtifactAttackSets([blockWithLeadIn, ...followupHtmls].filter(
            (part): part is string => Boolean(part)
          ))
        : undefined
      const notes =
        isPlayableClass && usesSupplementalSupport
          ? extractTrailingClassOtherInfo(blockWithLeadIn)
          : extractOtherInfo(isPlayableClass ? playableSupportBlock : block, {
              useLast: isPlayableClass && !usesSupplementalSupport,
            })
      const scopedNotes =
        isPlayableClass &&
        !supplementalHtml &&
        /^\s*(?:[•*-]\s*)?(?:Requirements|Mana Cost|Cooldown|Damage Type|Element):/im.test(
          notes ?? ''
        )
          ? undefined
          : notes
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
        defaultWeapon: defaultWeapon.name,
        defaultWeaponUrl: defaultWeapon.url,
        guestStats,
        imageUrl: classImages.imageUrl,
        alternativeImages: classImages.alternativeImages,
        attacks: classAttacks ?? parseConsumableEffectAttack(blockWithLeadIn, title.title, effect),
        attackSets,
        mechanics,
        dialogue: extractDialogue(lines, title.title),
        level,
        rarity,
        itemType,
        consumableKind,
        notes: scopedNotes,
        alsoSee: extractAlsoSeeRefs(blockWithLeadIn).map((ref) => ({
          name: ref.name,
          slug: entrySlugForClass(ref.name, classSubcategory),
          type: 'class-ability',
          url: ref.url,
        })),
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
    existing.defaultWeapon ||= detail.defaultWeapon
    existing.defaultWeaponUrl ||= detail.defaultWeaponUrl
    existing.guestStats ||= detail.guestStats
    existing.imageUrl ||= detail.imageUrl
    existing.alternativeImages ||= detail.alternativeImages
    existing.attacks ||= detail.attacks
    existing.attackSets ||= detail.attackSets
    existing.mechanics ||= detail.mechanics
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

function entrySlugForClass(name: string, subcategory?: ClassSubcategory): string {
  const baseSlug = entrySlug(name)
  if (!subcategory || subcategory === 'armor') return baseSlug
  return `${baseSlug}-${subcategory}`
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
    id: entrySlugForClass(detail.name, listing.classSubcategory),
    name: detail.name,
    slug: entrySlugForClass(detail.name, listing.classSubcategory),
    type: 'class-ability',
    subtype: listing.subtype,
    classSubcategory: listing.classSubcategory,
    consumableKind: detail.consumableKind ?? listing.consumableKind,
    description: detail.description,
    releaseDate: detail.releaseDate ?? listing.releaseDate,
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
    defaultWeapon: detail.defaultWeapon,
    defaultWeaponUrl: detail.defaultWeaponUrl,
    guestStats: detail.guestStats,
    imageUrl: detail.imageUrl,
    alternativeImages: detail.alternativeImages,
    attacks: detail.attacks,
    attackSets: detail.attackSets,
    mechanics: detail.mechanics,
    dialogue: detail.dialogue,
    obtainMethods,
    level: detail.level,
    rarity: detail.rarity,
    notes: detail.notes,
    alsoSee: detail.alsoSee ?? [],
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
    isSpecialCharacter:
      listing.isSpecialCharacter || resolvedTags.includes('special-character') || undefined,
    retired: listing.retired,
  }
}

function detailsToEntry(details: ParsedDetail[], listing: ListingEntry, html: string): ClassAbilityEntry {
  const tags = classTagsFromDetail(listing, html)
  const normalizedDetails =
    listing.subtype === 'class' && listing.classSubcategory !== 'armor' && details.length > 1
      ? details.map((detail, index) => {
          if (index === 0) return detail
          const base = details[0]
          return {
            ...detail,
            description: detail.description || base.description,
            location: detail.location || base.location,
            price: detail.price && detail.price !== 'N/A' ? detail.price : base.price,
            sellback: detail.sellback || base.sellback,
            requiredItems: detail.requiredItems || base.requiredItems,
            requirements: detail.requirements || base.requirements,
            obtainMethods: detail.obtainMethods.length > 0 ? detail.obtainMethods : base.obtainMethods,
            defaultWeapon: detail.defaultWeapon || base.defaultWeapon,
            defaultWeaponUrl: detail.defaultWeaponUrl || base.defaultWeaponUrl,
            guestStats: detail.guestStats || base.guestStats,
            level: detail.level || base.level,
            rarity: detail.rarity || base.rarity,
            itemType: detail.itemType || base.itemType,
          }
        })
      : details
  const sourceRefs = dedupeSourceRefs(
    normalizedDetails.map((detail) => ({
      url: detail.sourceUrl,
      title: detail.name,
    }))
  )
  if (normalizedDetails.length === 1) {
    const item = detailToItem(normalizedDetails[0], listing, html)
    return {
      ...item,
      alsoSee: extractAlsoSeeRefs(html).map((ref) => ({
        name: ref.name,
        slug: entrySlugForClass(ref.name, listing.classSubcategory),
        type: 'class-ability',
        url: ref.url,
      })),
      retired: item.retired || hasRetiredTag(html),
    }
  }

  let variants: LevelVariant[] = normalizedDetails.map((detail, index) => {
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
      ...(listing.subtype === 'class' && listing.classSubcategory !== 'armor'
        ? {}
        : {
            effect: detail.effect,
            effectType: detail.effectType,
          }),
      equipsClass: detail.equipsClass,
      equipsClassUrl: detail.equipsClassUrl,
      defaultWeapon: detail.defaultWeapon,
      defaultWeaponUrl: detail.defaultWeaponUrl,
      guestStats: detail.guestStats,
      imageUrl: detail.imageUrl,
      alternativeImages: detail.alternativeImages,
      attacks: detail.attacks,
      attackSets: detail.attackSets,
      mechanics: detail.mechanics,
      dialogue: detail.dialogue,
      notes: detail.notes,
      classAbilitySubtype: listing.classSubcategory ?? detail.consumableKind ?? listing.consumableKind,
      retired: listing.retired || hasRetiredTag(html),
    }
  })
  const noteIndexes = variants.flatMap((variant, index) => (variant.notes ? [index] : []))
  const supportSharedNotes =
    listing.subtype === 'class' && listing.classSubcategory !== 'armor'
      ? extractOtherInfo(html, { useLast: true })
      : undefined
  let sharedNotes =
    supportSharedNotes ??
    (normalizedDetails.every((detail) => detail.notes === normalizedDetails[0]?.notes)
      ? normalizedDetails[0]?.notes
      : undefined)
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
  const attackSetIndexes = variants.flatMap((variant, index) =>
    variant.attackSets?.length ? [index] : []
  )
  const mechanicsIndexes = variants.flatMap((variant, index) =>
    variant.mechanics?.length ? [index] : []
  )
  const dialogueIndexes = variants.flatMap((variant, index) => (variant.dialogue ? [index] : []))
  const uniqueDialogues = [...new Set(dialogueIndexes.map((index) => variants[index].dialogue))]
  const equipsClassIndexes = variants.flatMap((variant, index) => (variant.equipsClass ? [index] : []))
  const uniqueEquipsClasses = [
    ...new Set(equipsClassIndexes.map((index) => variants[index].equipsClass)),
  ]
  const defaultWeaponIndexes = variants.flatMap((variant, index) =>
    variant.defaultWeapon ? [index] : []
  )
  const uniqueDefaultWeapons = [
    ...new Set(defaultWeaponIndexes.map((index) => variants[index].defaultWeapon)),
  ]
  const imageIndexes = variants.flatMap((variant, index) => (variant.imageUrl ? [index] : []))
  const guestStatsIndexes = variants.flatMap((variant, index) =>
    variant.guestStats ? [index] : []
  )
  let sharedEffect = normalizedDetails.length === 1 ? normalizedDetails[0]?.effect : undefined
  let sharedEffectType =
    normalizedDetails.length === 1 ? normalizedDetails[0]?.effectType : undefined
  let sharedEquipsClass =
    normalizedDetails.length === 1 ? normalizedDetails[0]?.equipsClass : undefined
  let sharedEquipsClassUrl =
    normalizedDetails.length === 1 ? normalizedDetails[0]?.equipsClassUrl : undefined
  let sharedDefaultWeapon =
    normalizedDetails.length === 1 ? normalizedDetails[0]?.defaultWeapon : undefined
  let sharedDefaultWeaponUrl =
    normalizedDetails.length === 1 ? normalizedDetails[0]?.defaultWeaponUrl : undefined
  let sharedImageUrl = normalizedDetails.length === 1 ? normalizedDetails[0]?.imageUrl : undefined
  let sharedAlternativeImages =
    normalizedDetails.length === 1 ? normalizedDetails[0]?.alternativeImages : undefined
  let sharedGuestStats =
    normalizedDetails.length === 1 ? normalizedDetails[0]?.guestStats : undefined
  let sharedAttacks = normalizedDetails.length === 1 ? normalizedDetails[0]?.attacks : undefined
  let sharedAttackSets =
    normalizedDetails.length === 1 ? normalizedDetails[0]?.attackSets : undefined
  let sharedMechanics =
    normalizedDetails.length === 1 ? normalizedDetails[0]?.mechanics : undefined
  let sharedDialogue =
    normalizedDetails.length === 1 ? normalizedDetails[0]?.dialogue : undefined
  if (
    !sharedEffect &&
    uniqueEffects.length === 1 &&
    effectIndexes.length > 0 &&
    !(listing.subtype === 'class' && listing.classSubcategory !== 'armor') &&
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
  if (
    !sharedDefaultWeapon &&
    uniqueDefaultWeapons.length === 1 &&
    defaultWeaponIndexes.length > 0 &&
    defaultWeaponIndexes.length === variants.length
  ) {
    sharedDefaultWeapon = uniqueDefaultWeapons[0]
    const urlIndex =
      defaultWeaponIndexes.find((index) => variants[index].defaultWeaponUrl) ??
      defaultWeaponIndexes[0]
    sharedDefaultWeaponUrl =
      urlIndex === undefined ? undefined : variants[urlIndex].defaultWeaponUrl
    variants = variants.map((variant, index) =>
      defaultWeaponIndexes.includes(index)
        ? { ...variant, defaultWeapon: undefined, defaultWeaponUrl: undefined }
        : variant
    )
  }
  if (
    !sharedImageUrl &&
    imageIndexes.length > 0 &&
    imageIndexes.length === variants.length &&
    allSameValues(imageIndexes.map((index) => variants[index].imageUrl))
  ) {
    sharedImageUrl = variants[imageIndexes[0]].imageUrl
    if (
      allSameValues(imageIndexes.map((index) => variants[index].alternativeImages ?? []))
    ) {
      sharedAlternativeImages = variants[imageIndexes[0]].alternativeImages
    }
    variants = variants.map((variant, index) =>
      imageIndexes.includes(index)
        ? { ...variant, imageUrl: undefined, alternativeImages: undefined }
        : variant
    )
  }
  if (
    !sharedGuestStats &&
    guestStatsIndexes.length > 0 &&
    guestStatsIndexes.length === variants.length &&
    allSameValues(guestStatsIndexes.map((index) => variants[index].guestStats))
  ) {
    sharedGuestStats = variants[guestStatsIndexes[0]].guestStats
    variants = variants.map((variant, index) =>
      guestStatsIndexes.includes(index) ? { ...variant, guestStats: undefined } : variant
    )
  }
  if (
    !sharedAttackSets &&
    attackSetIndexes.length > 0 &&
    attackSetIndexes.length === variants.length &&
    allSameValues(attackSetIndexes.map((index) => variants[index].attackSets))
  ) {
    sharedAttackSets = variants[attackSetIndexes[0]].attackSets
    variants = variants.map((variant, index) =>
      attackSetIndexes.includes(index) ? { ...variant, attackSets: undefined } : variant
    )
  }
  if (
    !sharedMechanics &&
    mechanicsIndexes.length > 0 &&
    mechanicsIndexes.length === variants.length &&
    allSameValues(mechanicsIndexes.map((index) => variants[index].mechanics))
  ) {
    sharedMechanics = variants[mechanicsIndexes[0]].mechanics
    variants = variants.map((variant, index) =>
      mechanicsIndexes.includes(index) ? { ...variant, mechanics: undefined } : variant
    )
  }
  const allMethods = variants.flatMap((variant) => variant.obtainVariants)
  const resolvedTags = classAbilityTagsWithInferredFlags(tags, listing)
  return {
    id: entrySlugForClass(listing.name, listing.classSubcategory),
    familyName: normalizeName(listing.name),
    slug: entrySlugForClass(listing.name, listing.classSubcategory),
    aliasSlugs: details
      .map((detail) => entrySlugForClass(detail.name, listing.classSubcategory))
      .filter((slug) => slug !== entrySlugForClass(listing.name, listing.classSubcategory)),
    type: 'class-ability',
    subtype: listing.subtype,
    classSubcategory: listing.classSubcategory,
    consumableKind: normalizedDetails[0]?.consumableKind ?? listing.consumableKind,
    forumUrl: directUrl(listing.forumUrl),
    releaseDate: listing.releaseDate,
    familyOrigin: 'single-thread',
    familySources: sourceRefs,
    shared: {
      description: normalizedDetails[0]?.description ?? '',
      rarity: normalizedDetails[0]?.rarity,
      ...(sharedImageUrl ? { imageUrl: sharedImageUrl } : {}),
      ...(sharedAlternativeImages ? { alternativeImages: sharedAlternativeImages } : {}),
      effect: sharedEffect,
      effectType: sharedEffectType,
      equipsClass: sharedEquipsClass,
      equipsClassUrl: sharedEquipsClassUrl,
      defaultWeapon: sharedDefaultWeapon,
      defaultWeaponUrl: sharedDefaultWeaponUrl,
      guestStats: sharedGuestStats,
      ...(sharedAttacks?.length ? { attacks: sharedAttacks } : {}),
      ...(sharedAttackSets?.length ? { attackSets: sharedAttackSets } : {}),
      ...(sharedMechanics?.length ? { mechanics: sharedMechanics } : {}),
      dialogue: sharedDialogue,
      notes: sharedNotes,
      alsoSee: Array.from(
        new Map(
          [
            ...normalizedDetails.flatMap((detail) => detail.alsoSee ?? []),
            ...extractAlsoSeeRefs(html).map((ref) => ({
              name: ref.name,
              slug: entrySlugForClass(ref.name, listing.classSubcategory),
              type: 'class-ability' as const,
              url: ref.url,
            })),
          ].map((ref) => [ref.slug, ref])
        ).values()
      ),
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
    isSpecialCharacter:
      listing.isSpecialCharacter || resolvedTags.includes('special-character') || undefined,
    retired: listing.retired || hasRetiredTag(html),
  }
}

function dataFileForOptions(options: Pick<ScrapeOptions, 'subtype' | 'classSubcategory'>): string {
  if (options.subtype === 'consumable') return 'class-consumables.json'
  switch (options.classSubcategory ?? 'regular') {
    case 'armor':
      return 'class-armors.json'
    case 'miscellaneous':
      return 'class-miscellaneous.json'
    case 'regular':
      return 'class-regular.json'
  }
}

async function readExisting(options: Pick<ScrapeOptions, 'subtype' | 'classSubcategory'>): Promise<ClassAbilityEntry[]> {
  try {
    return JSON.parse(
      await readFile(resolve(DATA_DIR, dataFileForOptions(options)), 'utf8')
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
      const levelLabel = entry.level ?? '1'
      return buildSinglePostArmorFamily(entry, [
        itemToArmorMethodVariant(
          entry,
          methods[0],
          formatVariantNameWithAccess(levelLabel, {}),
          0,
          {
            daRequired: false,
            dcRequired: false,
          }
        ),
        itemToArmorMethodVariant(
          entry,
          methods[1],
          formatVariantNameWithAccess(levelLabel, { dcRequired: true }),
          1,
          {
            daRequired: false,
            dcRequired: true,
          }
        ),
      ])
    }
    if (normalizedName === 'evolved chickencow armor' && methods.length >= 3) {
      return buildSinglePostArmorFamily(entry, [
        itemToArmorMethodVariant(
          entry,
          methods[0],
          formatVariantNameWithAccess(undefined, { daRequired: true }),
          0,
          {
            daRequired: true,
            dcRequired: false,
          }
        ),
        itemToArmorMethodVariant(
          entry,
          methods[1],
          formatVariantNameWithAccess(undefined, { daRequired: true, dcRequired: true }),
          1,
          {
            daRequired: true,
            dcRequired: true,
          }
        ),
        itemToArmorMethodVariant(
          entry,
          methods[2],
          formatVariantNameWithAccess(undefined, { dcRequired: true }),
          2,
          {
            daRequired: false,
            dcRequired: true,
          }
        ),
      ])
    }
    if (normalizedName === 'ascended chickencow armor' && methods.length >= 2) {
      return buildSinglePostArmorFamily(entry, [
        itemToArmorMethodVariant(
          entry,
          methods[0],
          formatVariantNameWithAccess(undefined, { daRequired: true }),
          0,
          {
            daRequired: true,
            dcRequired: false,
          }
        ),
        itemToArmorMethodVariant(
          entry,
          methods[1],
          formatVariantNameWithAccess(undefined, { dcRequired: true }),
          1,
          {
            daRequired: false,
            dcRequired: true,
          }
        ),
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

function isForumBoilerplateClassEntry(entry: ClassAbilityEntry): boolean {
  const name = entryDisplayName(entry)
  const description = 'levelVariants' in entry ? entry.shared.description : entry.description
  const text = `${name}\n${description}`
  return (
    /^(?:Logged in as:\s*Guest|Printable Version|Forum Login)$/i.test(name.trim()) ||
    /(?:Logged in as:\s*Guest|Printable Version|All Forums\s*>>|Forum Login|Javascript is currently disabled|google_ad_client|keepalive\()/i.test(
      text
    )
  )
}

function resolveClassAbilityAlsoSeeSlugs(entries: ClassAbilityEntry[]): ClassAbilityEntry[] {
  const byUrl = new Map<string, ClassAbilityEntry>()
  for (const entry of entries) {
    const urls = new Set<string>([
      entry.forumUrl,
      ...('sourceUrl' in entry ? [entry.sourceUrl] : []),
      ...('familySources' in entry ? (entry.familySources ?? []).map((source) => source.url) : []),
      ...('levelVariants' in entry
        ? entry.levelVariants
            .map((variant) => variant.sourceUrl)
            .filter((url): url is string => Boolean(url))
        : []),
    ])
    for (const url of urls) byUrl.set(directUrl(url), entry)
  }

  const resolveRef = (ref: AlsoSeeRef): AlsoSeeRef => {
    const target = ref.url ? byUrl.get(directUrl(ref.url)) : undefined
    if (!target) return ref
    return {
      ...ref,
      name: entryDisplayName(target),
      slug: target.slug,
      type: 'class-ability',
    }
  }

  return entries.map((entry) => {
    if ('levelVariants' in entry) {
      return {
        ...entry,
        shared: {
          ...entry.shared,
          alsoSee: entry.shared.alsoSee?.map(resolveRef),
        },
      }
    }
    return {
      ...entry,
      alsoSee: entry.alsoSee?.map(resolveRef),
    }
  })
}

function normalizeClassAbilityEntries(entries: ClassAbilityEntry[]): ClassAbilityEntry[] {
  const contentEntries = entries.filter((entry) => !isForumBoilerplateClassEntry(entry))
  const normalized = normalizeGnomishPersonalSteamtankFamily(
    normalizeChickenCowArmorFamilies(
      mergeReforgedTimeArmorFamilies(
        mergeShadowArmorFamilies(mergeDoomKnightArmorFamily(contentEntries))
      )
    )
  )
  return removeAliasPrimaryDuplicates(
    resolveClassAbilityAlsoSeeSlugs(
      dedupeEntriesBySlug(normalizeKnownClassAbilityTextArtifacts(normalized))
    )
  )
}

function mergeEntries(
  existing: ClassAbilityEntry[],
  incoming: ClassAbilityEntry[],
  fresh: boolean
) {
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

  const cookie = loadForumCookie('classes/abilities scraper')
  const effectTypesByItem =
    options.subtype === 'consumable'
      ? await fetchConsumableEffectTypes(cookie)
      : new Map<string, string>()
  const classReleaseDates =
    options.subtype === 'class' ? await fetchClassReleaseDates(cookie) : new Map<string, string>()
  const listingHtml = await fetchForumPage(
    options.subtype === 'class' ? CLASSES_AZ_URL : CONSUMABLES_URL,
    cookie
  )
  let listings =
    options.subtype === 'class'
      ? options.classSubcategory === 'armor'
        ? parseArmorListing(listingHtml)
        : parseClassListing(listingHtml, options.classSubcategory ?? 'regular')
      : parseConsumableListing(listingHtml)
  if (options.subtype === 'class' && classReleaseDates.size > 0) {
    listings = listings.map((listing) => {
      const releaseDate = classReleaseDates.get(normalizeClassLookupName(listing.name))
      return releaseDate ? { ...listing, releaseDate } : listing
    })
  }
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
      const isPlayableTarget =
        options.subtype === 'class' &&
        options.classSubcategory !== undefined &&
        options.classSubcategory !== 'armor'
      const postParts = isPlayableTarget
        ? await fetchDetailPostParts(url, cookie)
        : { primary: await fetchDetailPostContent(url, cookie), followups: [] }
      const html = postParts.primary
      const supportHtml = isPlayableTarget
        ? selectPlayableSupportHtml(postParts, 'Targeted Class')
        : postParts.supplemental
      const detailInputs = isPlayableTarget
        ? playableDetailPostInputs(html, directUrl(url), 'Targeted Class', postParts)
        : [{ html, sourceUrl: url, fallbackName: 'Targeted Class' }]
      const details = mergeParsedDetails(
        detailInputs.flatMap((input) =>
          parseDetailBlocks(
            input.html,
            input.sourceUrl,
            input.fallbackName,
            options.classSubcategory ?? 'armor',
            supportHtml,
            postParts.followups.map((post) => post.html)
          )
        )
      ).filter((detail) =>
        options.classSubcategory === 'armor' ? /^Armor$/i.test(detail.itemType ?? '') : true
      )
      const name = extractForumPageTitle(html) ?? details[0]?.name
      if (!name) continue
      const tags = classTagsFromListing(name, html, 'class')
      const releaseDate = classReleaseDates.get(normalizeClassLookupName(name))
      listings.push({
        name,
        forumUrl: url,
        tags,
        subtype: 'class',
        classSubcategory: options.classSubcategory ?? 'armor',
        ...(releaseDate ? { releaseDate } : {}),
        isRare: isListingRare(stripTags(html), tags),
        isSeasonal: hasSeasonalForumTag(html),
        isSpecialOffer: hasSpecialOfferTag(html) || /\bS-Offer\b/i.test(stripTags(html)),
        isSpecialCharacter: tags.includes('special-character'),
        retired: hasRetiredTag(html),
      })
    }
  }
  if (options.limit) listings = listings.slice(0, options.limit)

  const scraped: ClassAbilityEntry[] = []
  for (const [index, listing] of listings.entries()) {
    console.log(`[${index + 1}/${listings.length}] ${listing.name}`)
    const isPlayableClass =
      listing.subtype === 'class' &&
      (listing.classSubcategory === 'regular' || listing.classSubcategory === 'miscellaneous')
    const postParts = isPlayableClass
      ? await fetchDetailPostParts(listing.forumUrl, cookie)
      : { primary: await fetchDetailPostContent(listing.forumUrl, cookie), followups: [] }
    const html = postParts.primary
    const supportHtml = isPlayableClass
      ? selectPlayableSupportHtml(postParts, listing.name)
      : postParts.supplemental
    const detailInputs = isPlayableClass
      ? playableDetailPostInputs(html, directUrl(listing.forumUrl), listing.name, postParts)
      : [{ html, sourceUrl: directUrl(listing.forumUrl), fallbackName: listing.name }]
    const scopedListing =
      options.urls && options.urls.length > 0
        ? { ...listing, name: extractForumPageTitle(html) ?? listing.name }
        : listing
    const parsedDetails = mergeParsedDetails(
      detailInputs.flatMap((input) =>
        parseDetailBlocks(
          input.html,
          input.sourceUrl,
          input.fallbackName,
          listing.classSubcategory,
          supportHtml,
          postParts.followups.map((post) => post.html)
        )
      )
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
    scraped.push(detailsToEntry(details, scopedListing, supportHtml ?? postParts.supplemental ?? html))
    await sleep(250)
  }

  const existing = await readExisting(options)
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
    resolve(DATA_DIR, dataFileForOptions(options)),
    `${JSON.stringify(output, null, 2)}\n`
  )
  writeClassAbilitiesManifest(DATA_DIR)
  writeClassArtifactRelations(DATA_DIR)
  writeClassArmorRelations(DATA_DIR)
  writeClassDefaultWeaponRelations(DATA_DIR)
  console.log(`Wrote ${output.length} ${options.subtype} entries`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
