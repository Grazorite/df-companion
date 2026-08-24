import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type {
  ClassAbilityEntry,
  ClassAbilityItem,
  ClassAbilitySubtype,
  ConsumableKind,
} from '../src/types/classAbility'
import type { LevelVariant, ObtainVariant } from '../src/types/item'
import type { GuestAttack } from '../src/types/pet'
import { computePriceType, isDefenderMedalText } from '../src/utils/variantHelpers.ts'
import { writeClassAbilitiesManifest } from './lib/data-manifests.ts'
import { directForumPostUrl, fetchForumPage, loadForumCookie, sleep } from './lib/forum.ts'
import { extractAlsoSeeRefs } from './lib/also-see.ts'
import { normalizeStructuredText, slugify } from './lib/text.ts'
import { hasRetiredTag } from './lib/tags.ts'
import { rephraseTimedSellback } from './lib/obtain-formatting.ts'

interface ScrapeOptions {
  subtype: ClassAbilitySubtype
  fresh: boolean
  limit?: number
  names?: string[]
}

interface ListingEntry {
  name: string
  forumUrl: string
  tags: string[]
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
  attacks?: GuestAttack[]
  dialogue?: string
  level?: string
  rarity?: string
  consumableKind?: ConsumableKind
  notes?: string
  obtainMethods: ObtainVariant[]
}

const CONSUMABLES_URL = 'https://forums2.battleon.com/f/fb.asp?m=22304639'
const CONSUMABLE_EFFECT_TYPES_URL = 'https://forums2.battleon.com/f/fb.asp?m=22304644'
const DATA_DIR = resolve(import.meta.dirname, '../src/data')
const SUPPLEMENTAL_CONSUMABLES: ListingEntry[] = [
  {
    name: 'Health Potion',
    forumUrl: 'https://forums2.battleon.com/f/tm.asp?m=4159197',
    tags: [],
    isRare: false,
    isSeasonal: false,
    isSpecialOffer: false,
    retired: false,
  },
  {
    name: 'Mana Potion',
    forumUrl: 'https://forums2.battleon.com/f/tm.asp?m=4159198',
    tags: [],
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
  const subtypeArg = args.find((arg) => arg.startsWith('--subtype='))?.split('=')[1]
  const subtype: ClassAbilitySubtype = subtypeArg === 'class' ? 'class' : 'consumable'
  const limitArg = args.find((arg) => arg.startsWith('--limit='))?.split('=')[1]
  const namesArg = args.find((arg) => arg.startsWith('--names='))?.split('=')[1]
  return {
    subtype,
    fresh: args.includes('--fresh'),
    ...(limitArg ? { limit: Number.parseInt(limitArg, 10) } : {}),
    ...(namesArg ? { names: namesArg.split('|').map((name) => name.trim()).filter(Boolean) } : {}),
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

function hasSeasonalTag(tags: Iterable<string>): boolean {
  return [...tags].some((tag) =>
    /seasonal|holiday|frostval|mogloween|heroheart|friday13/.test(tag)
  )
}

function hasSeasonalTagImage(html: string): boolean {
  return /\/tags\/Seasonal\.(?:png|jpg|jpeg|gif)/i.test(html)
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

function classTagsFromListing(name: string, rowHtml: string): ListingEntry['tags'] {
  const tags = new Set<string>()
  for (const tag of tagNamesFromHtml(rowHtml)) tags.add(tag)
  if (hasSeasonalTag(tags) || /\bSeasonal\b/i.test(stripTags(rowHtml)) || hasSeasonalTagImage(rowHtml)) {
    tags.add('seasonal')
  }
  const normalized = normalizeName(name)
  if (isDefaultTempConsumable(normalized)) {
    tags.add('temp')
  } else {
    tags.delete('temp')
  }
  return [...tags].sort()
}

function classTagsFromDetail(listing: ListingEntry, html: string): string[] {
  const tags = new Set(listing.tags)
  for (const tag of tagNamesFromHtml(html)) tags.add(tag)
  if (hasSeasonalTag(tags) || hasSeasonalTagImage(html)) tags.add('seasonal')
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
    const tags = classTagsFromListing(name, rowHtml)
    const prefixKind = consumableKindFromPrefix(stripTags(rowHtml).match(/\[([DFR])\]/i)?.[1])
    const key = `${name.toLowerCase()}|${forumUrl}`
    if (seen.has(key)) continue
    seen.add(key)
    entries.push({
      name,
      forumUrl,
      tags,
      consumableKind: prefixKind ?? consumableKindFromTags(tags),
      isRare: tags.includes('rare'),
      isSeasonal: tags.includes('seasonal'),
      isSpecialOffer: tags.includes('specialoffer') || tags.includes('special-offer'),
      retired: tags.includes('retired'),
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
  const cleaned = value.trim()
  return /^(?:none|n\/?a)$/i.test(cleaned) ? undefined : cleaned
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

function parseObtainMethods(lines: string[]): ObtainVariant[] {
  const methods: ObtainVariant[] = []
  const locationIndexes = lines
    .map((line, index) => (/^Location:/i.test(line) ? index : -1))
    .filter((index) => index >= 0)

  for (const [position, index] of locationIndexes.entries()) {
    const end = locationIndexes[position + 1] ?? lines.length
    const block = lines.slice(index, end)
    const location = firstField(block, 'Location') ?? 'N/A'
    const price = firstField(block, 'Price') ?? 'N/A'
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
  return /^(?:Location|Price|Sellback|Required Items?|Requirements?|Level|Rarity|Item Type|Category|Effect|Effects?|Mana Cost|Cooldown|Damage Type|Element):/i.test(
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

function titleMatches(html: string): Array<{ title: string; index: number; end: number }> {
  const matches = [
    ...html.matchAll(
      /<(?:b|strong)>\s*(?:<font\b[^>]*>)?\s*([^<\n][^<\n]+?)\s*(?:<\/font>)?\s*<\/(?:b|strong)>/gi
    ),
  ]
  return matches
    .map((match) => ({
      title: normalizeName(match[1]),
      index: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
    }))
    .filter(
      ({ title, index }) =>
        Boolean(title) &&
        !isDialogueTitleContext(html, index) &&
        !/^(?:Upon|If)\b.*:$/i.test(title) &&
        !/^(?:OK|Location|Price|Sellback|Level|Rarity|Effect|Effects|Other information|Also See)$/i.test(
          title
        )
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
      const consumableKind = consumableKindFromItemType(firstField(lines, 'Item Type'))
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
        attacks: parseConsumableEffectAttack(blockWithLeadIn, title.title, effect),
        dialogue: extractDialogue(lines, title.title),
        level,
        rarity,
        consumableKind,
        notes: extractOtherInfo(block),
        obtainMethods,
      }
    })
    .filter((detail): detail is ParsedDetail => Boolean(detail))
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
  const priceTypes = obtainMethods.map((method) => method.priceType)
  return {
    id: entrySlug(detail.name),
    name: detail.name,
    slug: entrySlug(detail.name),
    type: 'class-ability',
    subtype: 'consumable',
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
    attacks: detail.attacks,
    dialogue: detail.dialogue,
    obtainMethods,
    level: detail.level,
    rarity: detail.rarity,
    notes: detail.notes,
    alsoSee: [],
    tags,
    daRequired: obtainMethods.some((method) => method.daRequired),
    dcRequired: priceTypes.includes('dc') || tags.includes('dc'),
    dmRequired: obtainMethods.some((method) => method.dmRequired) || tags.includes('dm'),
    hasFree: priceTypes.includes('free'),
    hasMerge: priceTypes.includes('merge'),
    isTemp: tags.includes('temp') || isDefaultTempConsumable(detail.name),
    isRare: listing.isRare,
    isSeasonal: tags.includes('seasonal'),
    isSpecialOffer: listing.isSpecialOffer,
    retired: listing.retired,
  }
}

function detailsToEntry(details: ParsedDetail[], listing: ListingEntry, html: string): ClassAbilityEntry {
  const tags = classTagsFromDetail(listing, html)
  const sourceRefs = details.map((detail) => ({
    url: detail.sourceUrl,
    title: detail.name,
  }))
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
        normalizeName(detail.name)
          .replace(new RegExp(`^${escapeRegex(normalizeName(listing.name))}\\s*`, 'i'), '')
          .trim() || undefined,
      name: detail.name,
      damage: '—',
      stats: '—',
      obtainVariants: obtainMethods,
      sourceUrl: detail.sourceUrl,
      description: detail.description,
      rarity: detail.rarity,
      effect: detail.effect,
      effectType: detail.effectType,
      attacks: detail.attacks,
      dialogue: detail.dialogue,
      notes: detail.notes,
      classAbilitySubtype: detail.consumableKind ?? listing.consumableKind,
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
  let sharedEffect = details.length === 1 ? details[0]?.effect : undefined
  let sharedEffectType = details.length === 1 ? details[0]?.effectType : undefined
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
  const allMethods = variants.flatMap((variant) => variant.obtainVariants)
  return {
    id: entrySlug(listing.name),
    familyName: normalizeName(listing.name),
    slug: entrySlug(listing.name),
    aliasSlugs: details
      .map((detail) => entrySlug(detail.name))
      .filter((slug) => slug !== entrySlug(listing.name)),
    type: 'class-ability',
    subtype: 'consumable',
    consumableKind: details[0]?.consumableKind ?? listing.consumableKind,
    forumUrl: directUrl(listing.forumUrl),
    familyOrigin: 'single-thread',
    familySources: sourceRefs,
    shared: {
      description: details[0]?.description ?? '',
      rarity: details[0]?.rarity,
      effect: sharedEffect,
      effectType: sharedEffectType,
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
    tags,
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
    isTemp: tags.includes('temp') || isDefaultTempConsumable(listing.name),
    isRare: listing.isRare,
    isSeasonal: tags.includes('seasonal'),
    isSpecialOffer: listing.isSpecialOffer,
    retired: listing.retired || hasRetiredTag(html),
  }
}

async function readExisting(): Promise<ClassAbilityEntry[]> {
  try {
    return JSON.parse(await readFile(resolve(DATA_DIR, 'class-consumables.json'), 'utf8')) as ClassAbilityEntry[]
  } catch {
    return []
  }
}

function mergeEntries(existing: ClassAbilityEntry[], incoming: ClassAbilityEntry[], fresh: boolean) {
  if (fresh) return dedupeEntriesBySlug(incoming)
  const bySlug = new Map(existing.map((entry) => [entry.slug, entry]))
  for (const entry of incoming) bySlug.set(entry.slug, entry)
  return dedupeEntriesBySlug([...bySlug.values()])
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

async function main() {
  const options = parseArgs()
  if (options.subtype !== 'consumable') {
    throw new Error('Only --subtype=consumable is implemented for the starter scraper.')
  }

  const cookie = loadForumCookie('classes/abilities scraper')
  const effectTypesByItem = await fetchConsumableEffectTypes(cookie)
  const listingHtml = await fetchForumPage(CONSUMABLES_URL, cookie)
  let listings = parseConsumableListing(listingHtml)
  const seenListingNames = new Set(listings.map((entry) => normalizeName(entry.name).toLowerCase()))
  for (const supplemental of SUPPLEMENTAL_CONSUMABLES) {
    if (!seenListingNames.has(normalizeName(supplemental.name).toLowerCase())) {
      listings.push(supplemental)
    }
  }
  if (options.names && options.names.length > 0) {
    const names = new Set(options.names.map((name) => normalizeName(name).toLowerCase()))
    listings = listings.filter((entry) => names.has(normalizeName(entry.name).toLowerCase()))
  }
  if (options.limit) listings = listings.slice(0, options.limit)

  const scraped: ClassAbilityEntry[] = []
  for (const [index, listing] of listings.entries()) {
    console.log(`[${index + 1}/${listings.length}] ${listing.name}`)
    const html = await fetchForumPage(listing.forumUrl, cookie)
    const details = applyConsumableEffectTypes(
      parseDetailBlocks(html, directUrl(listing.forumUrl), listing.name),
      effectTypesByItem
    )
    if (details.length === 0) {
      console.warn(`No detail blocks parsed for ${listing.name}`)
      continue
    }
    scraped.push(detailsToEntry(details, listing, html))
    await sleep(250)
  }

  const existing = await readExisting()
  const output = mergeEntries(existing, scraped, options.fresh)
  output.sort((a, b) =>
    normalizeName('familyName' in a ? a.familyName : a.name).localeCompare(
      normalizeName('familyName' in b ? b.familyName : b.name)
    )
  )
  if (options.limit && !options.fresh) {
    console.log(`Parsed ${scraped.length} consumable entries (dry run; pass --fresh to write)`)
    return
  }

  await writeFile(resolve(DATA_DIR, 'class-consumables.json'), `${JSON.stringify(output, null, 2)}\n`)
  writeClassAbilitiesManifest(DATA_DIR)
  console.log(`Wrote ${output.length} consumable entries`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
