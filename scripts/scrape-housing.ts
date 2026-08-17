import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  HOUSING_SUBTYPES,
  type HousingEntry,
  type HousingFamily,
  type HousingItem,
  type HousingSubtype,
} from '../src/types/housing'
import type {
  AlsoSeeRef,
  AlternativeImage,
  LevelVariant,
  ObtainVariant,
  PriceType,
} from '../src/types/item'

interface ScrapeOptions {
  subtype: HousingSubtype
  limit?: number
  fresh: boolean
}

interface ParsedHousingDetail {
  name: string
  description: string
  forumUrl: string
  location?: string
  locationUrl?: string
  price: string
  sellback?: string
  capacity?: string
  furnishingSlots?: string
  effect?: string
  rarity?: string
  itemType?: string
  imageUrl?: string
  alternativeImages?: AlternativeImage[]
  notes?: string
  alsoSee?: AlsoSeeRef[]
  obtainVariants?: ObtainVariant[]
}

const ROOT_URL = 'https://forums2.battleon.com/f/fb.asp?m=21302540'
const FORUM_TEXT_DECODER = new TextDecoder('windows-1252')

const SUBTYPE_END_MARKERS: Record<HousingSubtype, string | undefined> = {
  house: 'Backgrounds modify',
  background: 'Floors modify',
  floor: 'Rugs can be added',
  rug: 'Shrubs can be added',
  shrub: 'Stuff can be added',
  stuff: 'Wall Items can be added',
  'wall-item': 'House Items Sorted by Effects',
}

const SUBTYPE_START_MARKERS: Record<HousingSubtype, string> = {
  house: 'Houses modify',
  background: 'Backgrounds modify',
  floor: 'Floors modify',
  rug: 'Rugs can be added',
  shrub: 'Shrubs can be added',
  stuff: 'Stuff can be added',
  'wall-item': 'Wall Items can be added',
}

const HOUSING_SUBTYPE_OVERRIDES: Record<
  string,
  { name: string; subtype: HousingSubtype; forumUrl: string; itemType?: string }
> = {
  'light bowl': {
    name: 'Light Bowl',
    subtype: 'wall-item',
    forumUrl: 'https://forums2.battleon.com/f/tm.asp?m=21231651',
    itemType: 'Wall',
  },
  'mysterious candle': {
    name: 'Mysterious Candle',
    subtype: 'wall-item',
    forumUrl: 'https://forums2.battleon.com/f/tm.asp?m=18527356',
    itemType: 'Wall',
  },
}

function parseArgs(): ScrapeOptions {
  const subtypeArg = process.argv.find((arg) => arg.startsWith('--subtype='))?.split('=')[1]
  const subtype = HOUSING_SUBTYPES.some((meta) => meta.subtype === subtypeArg)
    ? (subtypeArg as HousingSubtype)
    : 'house'
  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1]
  const limit = limitArg ? Number.parseInt(limitArg, 10) : undefined
  return {
    subtype,
    limit: Number.isFinite(limit) ? limit : undefined,
    fresh: process.argv.includes('--fresh'),
  }
}

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\u0096/g, '–')
    .replace(/\u0097/g, '—')
    .replace(/\u0099/g, '™')
}

async function fetchForumHtml(url: string): Promise<Response & { html?: string }> {
  const response = await fetch(url)
  if (!response.ok) return response
  const html = FORUM_TEXT_DECODER.decode(await response.arrayBuffer())
  return Object.assign(response, { html })
}

function stripTags(text: string): string {
  return decodeHtml(text.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function cleanHousingName(name: string): string {
  return name.replace(/^[.\s]+/, '').trim()
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function inferFlags(tagText: string) {
  const normalized = tagText.toLowerCase()
  return {
    dcRequired: normalized.includes('d-coins') || normalized.includes('dragon coins'),
    isRare: normalized.includes('rare'),
    isSeasonal: normalized.includes('seasonal'),
    isSpecialOffer: normalized.includes('special offer'),
    retired: normalized.includes('retired'),
  }
}

function normalizeForumUrl(url: string): string {
  return new URL(decodeHtml(url), 'https://forums2.battleon.com').toString()
}

function directForumPostUrl(url: string): string {
  const messageId = url.match(/[?&]m=(\d+)/i)?.[1]
  return messageId ? `https://forums2.battleon.com/f/fb.asp?m=${messageId}` : url
}

function printableForumUrl(url: string): string {
  const messageId = url.match(/[?&]m=(\d+)/i)?.[1]
  return messageId ? `https://forums2.battleon.com/f/printable.asp?m=${messageId}` : url
}

function htmlToLines(html: string): string[] {
  return decodeHtml(
    html
      .replace(/\[image\][\s\S]*?\[\/image\]/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, '\n• ')
      .replace(/<\/?(?:font|span|div|b|u|i|a|center|td|tr|table)[^>]*>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function htmlToIndentedLines(html: string): string[] {
  const lines: string[] = []
  let depth = 0
  let quoteDepth = 0
  let current = ''

  const flush = () => {
    const text = stripTags(current).replace(/^\s*•\s*/, '').trim()
    if (text) {
      if (/^quote:$/i.test(text)) {
        const quoteLine = `${'  '.repeat(depth)}quote:`
        if (lines.at(-1) !== quoteLine) lines.push(quoteLine)
      } else if (quoteDepth > 0) {
        lines.push(`${'  '.repeat(depth + quoteDepth)}${text}`)
      } else {
        lines.push(`${'  '.repeat(depth)}• ${text}`)
      }
    }
    current = ''
  }

  const source = html.replace(/\[image\][\s\S]*?\[\/image\]/gi, ' ')
  const tokens = source.split(
    /(<\/?ul[^>]*>|<li\b[^>]*>|<br\s*\/?>|<blockquote\b[^>]*class=["']?quote["']?[^>]*>|<\/blockquote>)/gi
  )
  for (const token of tokens) {
    if (!token) continue
    if (/^<ul\b/i.test(token)) {
      flush()
      depth += 1
    } else if (/^<\/ul/i.test(token)) {
      flush()
      depth = Math.max(0, depth - 1)
    } else if (/^<blockquote\b/i.test(token)) {
      flush()
      lines.push(`${'  '.repeat(depth)}quote:`)
      quoteDepth = 1
    } else if (/^<\/blockquote/i.test(token)) {
      flush()
      quoteDepth = 0
    } else if (/^<li\b/i.test(token)) {
      flush()
    } else if (/^<br/i.test(token)) {
      flush()
    } else {
      current += token
    }
  }
  flush()

  return lines
}

function readField(lines: string[], label: string): string | undefined {
  const prefix = `${label.toLowerCase()}:`
  return lines.find((line) => line.toLowerCase().startsWith(prefix))?.slice(prefix.length).trim()
}

function readFieldBlock(html: string, label: string): string | undefined {
  const stopLabels = [
    'Location',
    'Price',
    'Sellback',
    'Effect',
    'Level',
    'Rarity',
    'Item Type',
    'Capacity',
    'Backgrounds',
    'Floors',
    'Rugs',
    'Shrubs',
    'Stuff',
    'Wall Items',
  ].filter((stopLabel) => stopLabel !== label)
  const stopPattern = stopLabels.map((stopLabel) => `${stopLabel}:`).join('|')
  const match = html.match(
    new RegExp(
      `${label}:\\s*([\\s\\S]*?)(?=(?:<br\\s*\\/?>\\s*)+(?:${stopPattern})|<\\/ul>\\s*(?:${stopPattern})|\\[image\\]|<img\\b|<b>\\s*<u>Other information|Also See:|<i>Thanks to|<font color|$)`,
      'i'
    )
  )
  if (!match) return undefined
  const lines = htmlToLines(match[1])
  if (lines.length === 0) return undefined
  return lines.join('\n')
}

function cleanEffectText(value: string | undefined): string | undefined {
  if (!value) return undefined
  const lines = value
    .split('\n')
    .map((line) =>
      line
        .trim()
        .replace(/^•\s*/, '')
        .replace(/\(\s*Link to image\s*\)/gi, '')
        .replace(/\s+([.,;:!?])/g, '$1')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter((line) => line && !/^(?:Level|Rarity|Item Type):/i.test(line))
  if (lines.length === 0) return undefined
  if (/^Click to travel to any of the following destinations\b/i.test(lines[0]) && lines.length > 1) {
    return `${lines[0]}\n${lines.slice(1).join(', ')}`
  }
  if (lines.length <= 6) {
    return lines
      .map((line) => {
        const semicolonIndex = line.indexOf('; ')
        if (semicolonIndex === -1) return line
        const tail = line.slice(semicolonIndex + 2)
        const listLikeTail = tail.split(',').filter(Boolean).length >= 3
        return listLikeTail ? `${line.slice(0, semicolonIndex + 1)}\n${tail}` : line
      })
      .join('\n')
  }
  const [intro, ...items] = lines
  const separator = intro.endsWith(';') ? '\n' : ' '
  return `${intro}${separator}${items.join(', ')}`
}

function hasMeaningfulEffect(effect: string | undefined): boolean {
  return Boolean(effect && !/^(?:none|n\/?a)$/i.test(effect.trim()))
}

function classifyPrice(price: string): PriceType {
  const normalized = price.toLowerCase()
  if (normalized.includes('dragon coin') || normalized.includes(' dc')) return 'dc'
  if (normalized.includes('defender')) return 'dm'
  if (normalized.includes('gold')) return 'gold'
  return 'free'
}

function buildObtain(detail: ParsedHousingDetail): ObtainVariant {
  return {
    location: detail.location ?? 'Unknown',
    ...(detail.locationUrl ? { locationUrl: detail.locationUrl } : {}),
    price: detail.price || 'N/A',
    priceType: classifyPrice(detail.price || 'N/A'),
    daRequired: true,
    ...(classifyPrice(detail.price || 'N/A') === 'dc' ? { dcRequired: true } : {}),
    ...(detail.sellback ? { sellback: detail.sellback } : {}),
  }
}

function extractMessageBlocks(html: string): string[] {
  const spanBlocks = [...html.matchAll(/<span class=msg>([\s\S]*?)<\/span>/gi)].map(
    (match) => match[1]
  )
  if (spanBlocks.length > 0) return spanBlocks

  return [...html.matchAll(/<td\b[^>]*class=["']?msg["']?[^>]*>([\s\S]*?)<\/td>/gi)].map(
    (match) => match[1]
  )
}

function extractImageTags(block: string): string[] {
  const bbcodeImages = [...block.matchAll(/\[image\]([\s\S]*?)\[\/image\]/gi)]
    .map((match) => decodeHtml(match[1]).trim())
    .filter((url) => url && !/\/tags\//i.test(url))
  const inlineImages = [...block.matchAll(/<img\b[^>]*src="([^"]+)"/gi)]
    .map((match) => normalizeForumUrl(match[1]))
    .filter((url) => url && !/\/tags\//i.test(url) && !/\/image\/|blank\.gif/i.test(url))
  return Array.from(new Set([...bbcodeImages, ...inlineImages]))
}

function extractLinkedImages(block: string): AlternativeImage[] {
  return [...block.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({
      url: normalizeForumUrl(match[1]),
      caption: stripTags(match[2]),
    }))
    .filter((image) => /\.(?:png|jpe?g|gif|bmp)(?:\?|$)/i.test(image.url))
    .filter((image) => image.caption && !/^image$/i.test(image.caption))
}

function extractPrimaryImageLink(block: string): string | undefined {
  return [...block.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({
      url: normalizeForumUrl(match[1]),
      caption: stripTags(match[2]),
    }))
    .find(
      (image) => /^image$/i.test(image.caption) && /\.(?:png|jpe?g|gif|bmp)(?:\?|$)/i.test(image.url)
    )?.url
}

function extractLocation(block: string): { location?: string; locationUrl?: string } {
  const lineMatch = block.match(/Location:\s*([\s\S]*?)(?:<br\s*\/?>|<\/li>|$)/i)
  if (!lineMatch) return {}
  const locationHtml = lineMatch[1] ?? ''
  const linkMatch = locationHtml.match(/<a\b[^>]*href="([^"]+)"[^>]*>/i)
  return {
    ...(linkMatch ? { locationUrl: normalizeForumUrl(linkMatch[1]) } : {}),
    location: stripTags(locationHtml),
  }
}

function extractOtherInfo(block: string): string | undefined {
  const match = block.match(
    /Other information\s*(?:<\/b>\s*<\/u>|<\/u>\s*<\/b>)\s*<br>([\s\S]*?)(?:\[image\]|<i>Thanks to|<font color|<\/span>|<\/td>|$)/i
  )
  if (!match) return undefined
  const lines = htmlToIndentedLines(match[1])
  return lines.length > 0 ? lines.join('\n') : undefined
}

function mergeNotes(...notes: Array<string | undefined>): string | undefined {
  const lines = notes
    .filter((note): note is string => Boolean(note))
    .flatMap((note) => note.split('\n'))
    .map((line) => line.trimEnd())
    .filter(Boolean)
  if (lines.length === 0) return undefined
  return Array.from(new Set(lines)).join('\n')
}

function normalizeHousingNotes(name: string, notes: string | undefined): string | undefined {
  if (!notes) return undefined
  if (name === 'Pile of Dragon Coins' || name === 'Pile of Gold') {
    const lines = notes
      .split('\n')
      .filter(
        (line) =>
          !/^\s*•?\s*\d[\d,]*\s*[–-]\s*(?:\d[\d,]*|\+)\s+(?:Dragon Coins|Gold)\s*$/i.test(
            line
          )
      )
    return lines.length > 0 ? lines.join('\n') : undefined
  }
  return notes
}

function extractAlsoSee(block: string): AlsoSeeRef[] {
  const match = block.match(/Also See:\s*([\s\S]*?)(?:<br>\s*<br>|<i>Thanks to|<font color)/i)
  if (!match) return []

  return [...match[1].matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((linkMatch) => {
      const name = stripTags(linkMatch[2])
      return {
        name,
        slug: `housing-${slugify(name)}`,
        type: 'housing' as const,
        url: directForumPostUrl(normalizeForumUrl(linkMatch[1])),
      }
    })
    .filter((ref) => ref.name)
}

function extractTitle(block: string): string | undefined {
  const match = block.match(
    /(?:<font[^>]*size=['"]?3['"]?[^>]*>\s*<b>([\s\S]*?)(?:<\/b>\s*<\/font>|<\/font>\s*<\/b>)|<b>\s*<font[^>]*size=['"]?3['"]?[^>]*>([\s\S]*?)(?:<\/font>\s*<\/b>|<\/b>\s*<\/font>))/i
  )
  const title = match?.[1] ?? match?.[2]
  return title ? cleanHousingName(stripTags(title)) : undefined
}

function titleMatches(block: string): RegExpMatchArray[] {
  return [
    ...block.matchAll(
      /(?:<font[^>]*size=['"]?3['"]?[^>]*>\s*<b>([\s\S]*?)(?:<\/b>\s*<\/font>|<\/font>\s*<\/b>)|<b>\s*<font[^>]*size=['"]?3['"]?[^>]*>([\s\S]*?)(?:<\/font>\s*<\/b>|<\/b>\s*<\/font>))/gi
    ),
  ]
}

function splitDetailSections(block: string): string[] {
  const matches = titleMatches(block)
  if (matches.length <= 1) return [block]
  return matches.map((match, index) => {
    const start = match.index ?? 0
    const end = matches[index + 1]?.index ?? block.length
    return block.slice(start, end)
  })
}

function extractDescription(block: string): string {
  return stripTags(
    block.match(/(?:<\/font>\s*<\/b>|<\/b>\s*<\/font>)\s*<br>\s*<i>([\s\S]*?)<\/i>/i)?.[1] ??
      ''
  )
}

function normalizeAlternativeImages(
  name: string,
  images: AlternativeImage[],
  imageUrl?: string
): AlternativeImage[] {
  if (name === 'Hole in the ground') {
    const urls = Array.from(
      new Set(
        [imageUrl, ...images.map((image) => image.url)].filter(
          (url): url is string => Boolean(url)
        )
      )
    )
    return urls.map((url, index) => ({
      url,
      caption: index === 0 ? 'Hole' : index === 1 ? 'Bill Furray' : `Alternative ${index}`,
    }))
  }
  if (name === 'Magepriest Recruitment Poster') {
    return images.map((image) =>
      /^link to image$/i.test(image.caption) ? { ...image, caption: 'Clicked Appearance' } : image
    )
  }
  if (name === 'Pile of Dragon Coins' || name === 'Pile of Gold') {
    const captions =
      name === 'Pile of Dragon Coins'
        ? [
            '0–4,999 Dragon Coins',
            '5,000–9,999 Dragon Coins',
            '10,000–24,999 Dragon Coins',
            '25,000–49,999 Dragon Coins',
            '50,000+ Dragon Coins',
          ]
        : [
            '0–49,999 Gold',
            '50,000–99,999 Gold',
            '100,000–249,999 Gold',
            '250,000–999,999 Gold',
            '1,000,000+ Gold',
          ]
    const urls = Array.from(
      new Set(
        [imageUrl, ...images.map((image) => image.url)].filter(
          (url): url is string => Boolean(url)
        )
      )
    )
    return urls.map((url, index) => ({ url, caption: captions[index] ?? `Alternative ${index}` }))
  }
  return images
}

function chooseDetailValue<T>(current: T | undefined, next: T | undefined): T | undefined {
  return current ?? next
}

function mergeRepeatedDetails(details: ParsedHousingDetail[]): ParsedHousingDetail[] {
  const byName = new Map<string, ParsedHousingDetail>()

  for (const detail of details) {
    const existing = byName.get(detail.name)
    if (!existing) {
      byName.set(detail.name, {
        ...detail,
        obtainVariants: [buildObtain(detail)],
      })
      continue
    }

    const obtainVariants = [...(existing.obtainVariants ?? [buildObtain(existing)]), buildObtain(detail)]
    byName.set(detail.name, {
      ...existing,
      description: existing.description || detail.description,
      forumUrl: existing.forumUrl || detail.forumUrl,
      location: existing.location || detail.location,
      locationUrl: existing.locationUrl || detail.locationUrl,
      price: existing.price || detail.price,
      sellback: existing.sellback || detail.sellback,
      capacity: chooseDetailValue(existing.capacity, detail.capacity),
      furnishingSlots: chooseDetailValue(existing.furnishingSlots, detail.furnishingSlots),
      effect: chooseDetailValue(existing.effect, detail.effect),
      rarity: chooseDetailValue(existing.rarity, detail.rarity),
      itemType: chooseDetailValue(existing.itemType, detail.itemType),
      imageUrl: chooseDetailValue(existing.imageUrl, detail.imageUrl),
      alternativeImages: [
        ...(existing.alternativeImages ?? []),
        ...(detail.alternativeImages ?? []),
      ].filter(
        (image, index, images) => images.findIndex((candidate) => candidate.url === image.url) === index
      ),
      notes: mergeNotes(existing.notes, detail.notes),
      alsoSee: Array.from(
        new Map([...(existing.alsoSee ?? []), ...(detail.alsoSee ?? [])].map((ref) => [ref.slug, ref]))
          .values()
      ),
      obtainVariants: Array.from(
        new Map(
          obtainVariants.map((obtain) => [
            `${obtain.location}|${obtain.price}|${obtain.sellback ?? ''}`,
            obtain,
          ])
        ).values()
      ),
    })
  }

  return [...byName.values()]
}

function parseDetailBlocks(html: string, sourceUrl: string): ParsedHousingDetail[] {
  const threadNotes = mergeNotes(...extractMessageBlocks(html).map(extractOtherInfo))
  const parsed = extractMessageBlocks(html)
    .flatMap(splitDetailSections)
    .map((block): ParsedHousingDetail | undefined => {
      const name = extractTitle(block)
      if (!name) return undefined
      const description = extractDescription(block)
      const lines = htmlToLines(block)
      const location = extractLocation(block)
      const price = readField(lines, 'Price') ?? 'N/A'
      const imageTags = extractImageTags(block)
      const linkedImages = extractLinkedImages(block)
      const imageLink = extractPrimaryImageLink(block)
      const imageUrl = imageTags[0] ?? imageLink
      const alternativeImages = normalizeAlternativeImages(
        name,
        [
          ...imageTags.slice(1).map((url, index) => ({
            url,
            caption: `Alternative ${index + 1}`,
          })),
          ...linkedImages.filter((image) => image.url !== imageUrl),
        ],
        imageUrl
      )
      const effect = cleanEffectText(readFieldBlock(block, 'Effect') ?? readField(lines, 'Effect'))
      const notes = normalizeHousingNotes(name, mergeNotes(extractOtherInfo(block), threadNotes))
      const alsoSee = extractAlsoSee(block)

      return {
        name,
        description,
        forumUrl: directForumPostUrl(sourceUrl),
        ...location,
        price,
        sellback: readField(lines, 'Sellback'),
        capacity: readField(lines, 'Capacity'),
        furnishingSlots: lines.find((line) => /^Backgrounds:/i.test(line)),
        effect,
        rarity: readField(lines, 'Rarity'),
        itemType: readField(lines, 'Item Type'),
        ...(imageUrl ? { imageUrl } : {}),
        ...(alternativeImages.length > 0 ? { alternativeImages } : {}),
        ...(notes ? { notes } : {}),
        ...(alsoSee.length > 0 ? { alsoSee } : {}),
      }
    })
    .filter((detail): detail is ParsedHousingDetail => Boolean(detail))
  return mergeRepeatedDetails(parsed)
}

function subtypeForItemType(itemType?: string): HousingSubtype | undefined {
  const normalized = itemType?.toLowerCase().trim()
  if (!normalized) return undefined
  if (normalized === 'house') return 'house'
  if (normalized === 'background') return 'background'
  if (normalized === 'floor') return 'floor'
  if (normalized === 'rug') return 'rug'
  if (normalized === 'shrub') return 'shrub'
  if (normalized === 'stuff') return 'stuff'
  if (normalized === 'wall') return 'wall-item'
  return undefined
}

function housingSubtypeForDetail(detail: ParsedHousingDetail): HousingSubtype | undefined {
  return HOUSING_SUBTYPE_OVERRIDES[detail.name.toLowerCase()]?.subtype ?? subtypeForItemType(detail.itemType)
}

function housingItemTypeForDetail(detail: ParsedHousingDetail): string | undefined {
  return HOUSING_SUBTYPE_OVERRIDES[detail.name.toLowerCase()]?.itemType ?? detail.itemType
}

function crossSubtypeRefForDetail(detail: ParsedHousingDetail): AlsoSeeRef {
  return {
    name: detail.name,
    slug: `housing-${slugify(detail.name)}`,
    type: 'housing',
    ...(detail.forumUrl ? { url: detail.forumUrl } : {}),
  }
}

function detailsForSubtype(details: ParsedHousingDetail[], subtype: HousingSubtype) {
  const matching = details.filter((detail) => {
    const detailSubtype = housingSubtypeForDetail(detail)
    return !detailSubtype || detailSubtype === subtype
  })
  const crossSubtypeRefs = details
    .filter((detail) => {
      const detailSubtype = housingSubtypeForDetail(detail)
      return detailSubtype && detailSubtype !== subtype
    })
    .map(crossSubtypeRefForDetail)

  if (matching.length === 0) return []
  if (crossSubtypeRefs.length === 0) return matching

  return matching.map((detail) => ({
    ...detail,
    alsoSee: Array.from(
      new Map([...(detail.alsoSee ?? []), ...crossSubtypeRefs].map((ref) => [ref.slug, ref])).values()
    ),
  }))
}

function extractSection(html: string, subtype: HousingSubtype): string {
  const meta = HOUSING_SUBTYPES.find((entry) => entry.subtype === subtype) ?? HOUSING_SUBTYPES[0]
  const start = html.indexOf(SUBTYPE_START_MARKERS[subtype])
  if (start < 0) {
    throw new Error(`Could not find housing section for ${meta.label}`)
  }
  const endMarker = SUBTYPE_END_MARKERS[subtype]
  const end = endMarker ? html.indexOf(endMarker, start + meta.shortDescription.length) : -1
  return end > start ? html.slice(start, end) : html.slice(start)
}

function parseListingEntries(html: string, subtype: HousingSubtype): HousingItem[] {
  const meta = HOUSING_SUBTYPES.find((entry) => entry.subtype === subtype) ?? HOUSING_SUBTYPES[0]
  const section = extractSection(html, subtype)
  const entries: HousingItem[] = []
  const linkPattern =
    /<a\b[^>]*href="([^"]*(?:tm|fb)\.asp\?m=(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>\s*(\([^<]*?\))?/gi

  for (const match of section.matchAll(linkPattern)) {
    const name = cleanHousingName(stripTags(match[3]))
    if (!name || name === 'Home Owner' || /^special effect$/i.test(name) || /^[A-Z]$/.test(name)) {
      continue
    }
    const override = HOUSING_SUBTYPE_OVERRIDES[name.toLowerCase()]
    if (override && override.subtype !== subtype) continue
    const rawTags = stripTags(match[4] ?? '')
    const flags = inferFlags(rawTags)
    const url = new URL(decodeHtml(match[1]), 'https://forums2.battleon.com').toString()
    const tags = [
      subtype,
      meta.label.toLowerCase(),
      ...rawTags
        .replace(/[()]/g, '')
        .split('/')
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    ]
    const slug = `housing-${slugify(name)}`

    entries.push({
      id: slug,
      name,
      slug,
      type: 'housing',
      subtype,
      description: meta.shortDescription,
      forumUrl: url,
      sourceUrl: meta.sourceUrl,
      tags: Array.from(new Set(tags)),
      daRequired: true,
      hasFree: false,
      ...flags,
    })
  }

  for (const override of Object.values(HOUSING_SUBTYPE_OVERRIDES)) {
    if (override.subtype !== subtype) continue
    const slug = `housing-${slugify(override.name)}`
    if (entries.some((entry) => entry.slug === slug)) continue
    entries.push({
      id: slug,
      name: override.name,
      slug,
      type: 'housing',
      subtype,
      description: meta.shortDescription,
      forumUrl: override.forumUrl,
      sourceUrl: meta.sourceUrl,
      tags: [subtype, meta.label.toLowerCase()],
      daRequired: true,
      hasFree: false,
    })
  }

  return entries
}

function familyNameForDetails(details: ParsedHousingDetail[]): string {
  const names = details.map((detail) => detail.name)
  const stripped = names.map((name) => name.replace(/\s+(?:I|II|III|IV|V|VI|VII|VIII|IX|X)$/i, ''))
  const first = stripped[0]
  if (stripped.every((name) => name === first)) return first
  const parentheticalBaseMatch = first.match(/^(.+?)\s+\([^)]+\)$/)
  if (
    parentheticalBaseMatch &&
    stripped.every((name) => name.startsWith(`${parentheticalBaseMatch[1]} (`))
  ) {
    return parentheticalBaseMatch[1]
  }
  return names[0]
}

function buildSingleEntry(
  listing: HousingItem,
  detail: ParsedHousingDetail,
  subtype: HousingSubtype
): HousingItem {
  const obtainVariants = detail.obtainVariants ?? [buildObtain(detail)]
  const itemType = housingItemTypeForDetail(detail)
  return {
    ...listing,
    name: detail.name,
    description: detail.description || listing.description,
    forumUrl: detail.forumUrl,
    imageUrl: detail.imageUrl,
    alternativeImages: detail.alternativeImages,
    location: detail.location,
    price: detail.price,
    sellback: detail.sellback,
    capacity: detail.capacity,
    furnishingSlots: detail.furnishingSlots,
    effect: detail.effect,
    obtainMethods: obtainVariants,
    rarity: detail.rarity,
    itemType,
    notes: detail.notes,
    alsoSee: detail.alsoSee,
    dcRequired: obtainVariants.some((obtain) => obtain.priceType === 'dc') || listing.dcRequired,
    hasFree: obtainVariants.some((obtain) => obtain.priceType === 'free'),
    hasSpecialEffect: hasMeaningfulEffect(detail.effect),
    tags: Array.from(
      new Set(
        [
          ...listing.tags,
          subtype,
          itemType?.toLowerCase() ?? '',
          hasMeaningfulEffect(detail.effect) ? 'special-effect' : '',
        ].filter(Boolean)
      )
    ),
  }
}

function buildFamilyEntry(
  listing: HousingItem,
  details: ParsedHousingDetail[],
  subtype: HousingSubtype
): HousingFamily {
  const familyName = familyNameForDetails(details)
  const slug = `housing-${slugify(familyName)}`
  const variants: LevelVariant[] = details.map((detail, index) => {
    const obtainVariants = detail.obtainVariants ?? [buildObtain(detail)]
    return {
      levelNumber: index + 1,
      levelDisplay: String(index + 1),
      name: detail.name,
      damage: '',
      stats: detail.capacity ?? '',
      obtainVariants,
      sourceUrl: detail.forumUrl,
      description: detail.description,
      imageUrl: detail.imageUrl,
      alternativeImages: detail.alternativeImages,
      rarity: detail.rarity,
      itemType: housingItemTypeForDetail(detail),
      capacity: detail.capacity,
      furnishingSlots: detail.furnishingSlots,
      effect: detail.effect,
      notes: detail.notes,
    }
  })
  const hasDC = variants.some((variant) => variant.obtainVariants.some((obtain) => obtain.priceType === 'dc'))

  const aliasSlugs = Array.from(
    new Set([listing.slug, ...details.map((detail) => `housing-${slugify(detail.name)}`)])
  ).filter((alias) => alias !== slug)
  const familySources = details.map((detail) => ({
    title: detail.name,
    url: detail.forumUrl,
    variantLabel: detail.name,
    isPrimary: detail.name === details[0]?.name,
  }))

  return {
    id: slug,
    familyName,
    slug,
    aliasSlugs,
    type: 'housing',
    subtype,
    forumUrl: details[0]?.forumUrl ?? listing.forumUrl,
    familyOrigin: 'same-thread-multi-post',
    familySources,
    shared: {
      description: details[0]?.description || listing.description,
      rarity: details[0]?.rarity,
      alsoSee: details.flatMap((detail) => detail.alsoSee ?? []),
    },
    levelVariants: variants,
    itemType: details[0] ? (housingItemTypeForDetail(details[0]) ?? 'House') : 'House',
    tags: Array.from(
      new Set([
        ...listing.tags,
        subtype,
        'multiple-versions',
        details.some((detail) => hasMeaningfulEffect(detail.effect)) ? 'special-effect' : '',
      ].filter(Boolean))
    ),
    hasDA: true,
    hasDC,
    hasDM: false,
    hasFree: variants.some((variant) =>
      variant.obtainVariants.some((obtain) => obtain.priceType === 'free')
    ),
    hasMerge: false,
    levelRange: '',
    elements: [],
    isRare: listing.isRare,
    isSeasonal: listing.isSeasonal,
    isSpecialOffer: listing.isSpecialOffer,
    retired: listing.retired,
  }
}

async function enrichEntries(entries: HousingItem[], subtype: HousingSubtype): Promise<HousingEntry[]> {
  const bySlug = new Map<string, HousingEntry>()
  const detailCache = new Map<string, ParsedHousingDetail[]>()

  for (const listing of entries) {
    const printableUrl = printableForumUrl(listing.forumUrl)
    if (!detailCache.has(printableUrl)) {
      const response = await fetchForumHtml(printableUrl)
      if (!response.ok) {
        const directResponse = await fetchForumHtml(directForumPostUrl(listing.forumUrl))
        if (!directResponse.ok) {
          console.warn(`Skipping detail enrichment for ${listing.name}: ${response.status}`)
          detailCache.set(printableUrl, [])
        } else {
          detailCache.set(
            printableUrl,
            parseDetailBlocks(directResponse.html ?? '', listing.forumUrl)
          )
        }
      } else {
        detailCache.set(printableUrl, parseDetailBlocks(response.html ?? '', listing.forumUrl))
      }
    }

    const details = detailsForSubtype(detailCache.get(printableUrl) ?? [], subtype)
    if (details.length === 0) {
      const alreadyCovered = [...bySlug.values()].some(
        (entry) => 'aliasSlugs' in entry && entry.aliasSlugs?.includes(listing.slug)
      )
      if (alreadyCovered) continue
      bySlug.set(listing.slug, listing)
      continue
    }

    const entry =
      details.length > 1
        ? buildFamilyEntry(listing, details, subtype)
        : buildSingleEntry(listing, details[0], subtype)
    bySlug.set(entry.slug, entry)
  }

  return [...bySlug.values()]
}

async function readExistingEntriesForSubtype(subtype: HousingSubtype): Promise<HousingEntry[]> {
  try {
    return JSON.parse(await readFile(outputPathForSubtype(subtype), 'utf8')) as HousingEntry[]
  } catch {
    return []
  }
}

function entryName(entry: HousingEntry): string {
  return 'familyName' in entry ? entry.familyName : entry.name
}

async function mergeSubtypeEntries(
  subtype: HousingSubtype,
  incoming: HousingEntry[],
  fresh: boolean
): Promise<HousingEntry[]> {
  if (fresh) return incoming

  const bySlug = new Map<string, HousingEntry>()
  for (const entry of await readExistingEntriesForSubtype(subtype)) {
    bySlug.set(entry.slug, entry)
  }
  for (const entry of incoming) {
    bySlug.set(entry.slug, entry)
  }

  return [...bySlug.values()].sort((first, second) =>
    entryName(first).localeCompare(entryName(second), undefined, { sensitivity: 'base' })
  )
}

function outputPathForSubtype(subtype: HousingSubtype): string {
  const meta = HOUSING_SUBTYPES.find((entry) => entry.subtype === subtype) ?? HOUSING_SUBTYPES[0]
  return resolve('src/data', meta.dataFiles[0])
}

async function main() {
  const options = parseArgs()
  const response = await fetchForumHtml(ROOT_URL)
  if (!response.ok) throw new Error(`Failed to fetch housing listing: ${response.status}`)
  const html = response.html ?? ''
  const parsed = parseListingEntries(html, options.subtype)
  const listingEntries = options.limit ? parsed.slice(0, options.limit) : parsed
  const entries = await enrichEntries(listingEntries, options.subtype)

  console.log(
    `Parsed ${entries.length}${options.limit ? `/${parsed.length}` : ''} ${options.subtype} entries`
  )
  for (const entry of entries.slice(0, 8)) {
    const entryName = 'familyName' in entry ? entry.familyName : entry.name
    const hasDC = 'familyName' in entry ? entry.hasDC : entry.dcRequired
    console.log(`- ${entryName}${hasDC ? ' [DC]' : ''}`)
  }

  if (options.limit && !options.fresh) {
    console.log('Dry run only. Omit --limit for an additive subtype write, or add --fresh to replace.')
    return
  }

  const outputEntries = await mergeSubtypeEntries(options.subtype, entries, options.fresh)
  await writeFile(outputPathForSubtype(options.subtype), `${JSON.stringify(outputEntries, null, 2)}\n`)
  await updateManifest()
  console.log(`Wrote ${outputPathForSubtype(options.subtype)}`)
}

async function updateManifest() {
  const bySubtype: Record<HousingSubtype, number> = {
    house: 0,
    background: 0,
    floor: 0,
    rug: 0,
    shrub: 0,
    stuff: 0,
    'wall-item': 0,
  }

  for (const meta of HOUSING_SUBTYPES) {
    const filePath = resolve('src/data', meta.dataFiles[0])
    const data = JSON.parse(await readFile(filePath, 'utf8')) as HousingEntry[]
    bySubtype[meta.subtype] = data.length
  }

  await writeFile(
    resolve('src/data/housing-manifest.json'),
    `${JSON.stringify(
      {
        total: Object.values(bySubtype).reduce((sum, count) => sum + count, 0),
        bySubtype,
      },
      null,
      2
    )}\n`
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
