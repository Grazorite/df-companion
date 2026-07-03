/**
 * Pets Scraper — Chronology-First Strategy (Five-Pass, Resumable)
 *
 * This scraper fetches Chronology first to get authoritative pet types,
 * then parses the A-Z page to build stubs with correct type prefixes.
 * GUESTS are now handled by scrape-guests.ts.
 *
 * Entry format: [ICE][SHR] Pet Name (D-Amulet/Seasonal)
 *
 * USAGE:
 *   npm run scrape:pets                 # Scrape all pets (guests excluded)
 *   npm run scrape:pets -- --start=C    # Resume from letter C onwards
 *   npm run scrape:pets -- --letter=B   # Scrape only letter B
 *   npm run scrape:pets -- --letters=A,B # Scrape multiple letters A and B
 *
 * Progress is saved to pets-progress.json after each entry,
 * so a timeout or crash won't lose work. Final output is pets.json.
 *
 * Cookie: Add FORUM_COOKIE="..." to .env
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { Pet, ObtainMethod, Attack, Evolution, AlsoSeeRef, EntryType } from '../src/types/pet.ts'
import type { ItemFamily, ObtainVariant, LevelVariant, SharedData } from '../src/types/item.ts'
import { computePriceType, computeFamilyFlags, normalizeLevel } from '../src/utils/variantHelpers.ts'
import { fetchPrintable, getPostContent } from './lib/printable-parser.ts'

const FORUM_BASE = 'https://forums2.battleon.com/f'
const AZ_PETS_URL = `${FORUM_BASE}/tm.asp?m=22349620&mpage=1`  // A-Z Pets & Guests combined (filtered by type)
const CHRONOLOGY_URL = `${FORUM_BASE}/tm.asp?m=10738071`
const DELAY_MS = 1000
const OUTPUT_PATH = path.resolve(import.meta.dirname, '../src/data/pets.json')
const PROGRESS_PATH = path.resolve(import.meta.dirname, '../src/data/pets-progress.json')

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const startArg = args.find(a => a.startsWith('--start='))?.split('=')[1]?.toUpperCase()
const letterArg = args.find(a => a.startsWith('--letter='))?.split('=')[1]?.toUpperCase()
const lettersArg = args.find(a => a.startsWith('--letters='))?.split('=')[1]?.toUpperCase().split(',') // Support multiple: --letters=A,B

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

async function fetchPage(url: string, cookie: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 45000)  // 45s timeout
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Cookie: cookie,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`)
    return res.text()
  } finally {
    clearTimeout(timer)
  }
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120)
}

function prefixedSlug(name: string, type: EntryType): string {
  return `${type}-${slugify(name)}`
}

function decodeHTML(str: string): string {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&apos;/g, "'")  // Also handle &apos; entity
}

function stripHtml(html: string): string {
  // Handle forum's malformed HTML:
  // - Top-level <li> without <ul>
  // - Nested <ul><li>...<li></ul> for sub-items
  // - Text content with < or > characters (like "<1%")
  
  let depth = 0
  let processed = ''
  let i = 0
  const maxIterations = Math.max(html.length * 3, 100000)
  let iterations = 0
  let inTag = false
  let tagStart = -1
  
  while (i < html.length && iterations < maxIterations) {
    iterations++
    
    const char = html[i]
    
    // Check if this might be the start of a tag
    if (char === '<' && !inTag) {
      // Look ahead to see if this is actually a tag or just a < character in text
      const nextChars = html.slice(i, i + 10)
      // Valid HTML tags start with < followed by letter or / or !
      if (/^<[a-zA-Z!\/]/.test(nextChars)) {
        inTag = true
        tagStart = i
      } else {
        // It's just a < character in text content, keep it
        processed += char
      }
      i++
      continue
    }
    
    // Check if we're closing a tag
    if (char === '>' && inTag) {
      inTag = false
      
      // Check what type of tag we just closed
      const tagContent = html.slice(tagStart, i + 1)
      
      if (tagContent.match(/<ul|<ol/i)) {
        depth++
        processed += '\n'
      } else if (tagContent.match(/<\/ul|<\/ol/i)) {
        depth = Math.max(0, depth - 1)
        processed += '\n'
      } else if (tagContent.match(/<li/i)) {
        const indent = '  '.repeat(Math.max(0, depth))
        processed += `\n${indent}• `
      } else if (tagContent.match(/<\/li/i)) {
        processed += '\n'
      } else if (tagContent.match(/<br/i)) {
        processed += '\n'
      } else if (tagContent.match(/<\/p/i)) {
        processed += '\n'
      }
      // For other tags, just skip them
      
      i++
      continue
    }
    
    // If we're inside a tag, skip the character
    if (inTag) {
      i++
      continue
    }
    
    // Regular character outside tags - add to output
    processed += char
    i++
  }
  
  if (iterations >= maxIterations) {
    console.warn('⚠️  stripHtml reached iteration limit on a very large page')
  }
  
  // Clean up whitespace
  return processed
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function loadCookie(): string {
  const envPath = path.resolve(import.meta.dirname, '../.env')
  if (!fs.existsSync(envPath)) { console.error('❌ Missing .env'); process.exit(1) }
  const content = fs.readFileSync(envPath, 'utf-8')
  const match = content.match(/FORUM_COOKIE=["'](.+?)["']\s*$/)
  if (!match) { console.error('❌ FORUM_COOKIE not found in .env'); process.exit(1) }
  return match[1]
}

// ─── Bracket code parser ─────────────────────────────────────────────────────
// Handles: [ICE], [FIR], [N/A], [W/S], [???], [ICE][SHR], mixed combos

const KNOWN_MARKERS = new Set(['A/C', 'ALA', 'N/A', 'SHR', 'W/S'])

function parseBracketCodes(raw: string): { elements: string[]; markers: string[] } {
  const elements: string[] = []
  const markers: string[] = []
  const bracketRegex = /\[([A-Z?/]+)\]/g
  let m: RegExpExecArray | null
  while ((m = bracketRegex.exec(raw)) !== null) {
    const code = m[1]
    if (KNOWN_MARKERS.has(code)) markers.push(code)
    else elements.push(code)
  }
  return { elements, markers }
}

// ─── A-Z page parsing ─────────────────────────────────────────────────────────

interface PetStub {
  name: string
  slug: string
  type: EntryType
  forumUrl: string
  messageId: string
  elements: string[]
  markers: string[]
  letter: string  // '#', 'A', 'B', etc.
}

function parseAZPage(html: string, chronoTypes: Map<string, EntryType>): PetStub[] {
  const stubs: PetStub[] = []
  const seen = new Set<string>()
  const chunks = html.split(/<br\s*\/?>/)
  let currentLetter = '#'
  let skippedCount = 0

  for (const chunk of chunks) {
    const text = stripHtml(decodeHTML(chunk)).trim()

    // Detect letter headings — single letter on its own line
    if (/^[A-Z#]$/.test(text)) {
      currentLetter = text
      continue
    }

    // Match links — both relative and absolute URLs, single or double quotes
    const linkMatch = /href=["']?(?:https?:\/\/forums2\.battleon\.com\/f\/)?tm\.asp\?m=(\d+)["'\s>]/i.exec(chunk)
    if (!linkMatch) continue
    const msgId = linkMatch[1]
    if (seen.has(msgId)) {
      skippedCount++
      continue
    }
    seen.add(msgId)

    // Elements/markers appear BEFORE the <a> tag in the line
    // e.g: [BAC][DAR][WIN] <a href="...">Pet Name</a>
    const { elements, markers } = parseBracketCodes(chunk)

    // Extract anchor text (pet name — may also contain brackets if inside the <a>)
    const anchorText = decodeHTML((chunk.match(/<a[^>]+>([^<]+)<\/a>/i)?.[1] ?? '').trim())
    if (!anchorText || anchorText.length < 2) {
      if (anchorText) skippedCount++
      continue
    }

    // Name is anchor text with any remaining bracket codes stripped
    const name = anchorText.replace(/\[[A-Z?/]+\]/g, '').trim()
    if (!name) {
      skippedCount++
      continue
    }
    
    // Skip navigation/meta links (Chronology, A-Z page itself, etc.)
    if (name.toLowerCase().includes('chronology') || 
        name.toLowerCase().includes('a-z') ||
        name.toLowerCase() === 'pets' ||
        name.toLowerCase() === 'guests') {
      skippedCount++
      continue
    }

    // Determine type from Chronology (primary source) or default to 'pet'
    const key = name.toLowerCase()
    const type = chronoTypes.get(key) ?? chronoTypes.get(name.replace(/\s*\([^)]+\)\s*$/, '').trim().toLowerCase()) ?? 'pet' as EntryType

    stubs.push({
      name,
      slug: prefixedSlug(name, type),
      type,
      forumUrl: `${FORUM_BASE}/tm.asp?m=${msgId}`,
      messageId: msgId,
      elements,
      markers,
      letter: currentLetter,
    })
  }
  
  if (skippedCount > 0) {
    console.log(`   ⚠️  Skipped ${skippedCount} entries (duplicates, navigation links, or invalid names)`)
  }

  return stubs
}

// ─── Individual pet thread parsing ───────────────────────────────────────────

// ─── Multi-Variant Detection Helpers (Sprint 5) ──────────────────────────────

/**
 * Check if a forum thread has multiple posts (separate variants in single thread)
 * Examples: Baron (Kitten, Cat) - two separate posts for different variants
 * Returns array of post boundaries if multi-post, empty array if single-post
 */
function detectMultiPostVariants(html: string, baseName: string): Array<{ startIndex: number; variantName: string; level?: number }> {
  // Look for the base name followed by a variant suffix (not roman numerals)
  // Pattern: "Baron Kitten", "Baron Cat", etc.
  // This is different from roman numerals (I, II, III) or "All Versions"
  
  const variants: Array<{ startIndex: number; variantName: string; level?: number }> = []
  
  // Pattern 1: Base name + word (like "Baron Kitten", "Baron Cat")
  // Match heading-like text with the base name followed by a capitalized word
  // Must be at start of line or after HTML tag to avoid matching within paragraphs
  const variantPattern = new RegExp(
    `(?:^|<[^>]+>)\\s*(${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+([A-Z][a-z]+))\\s*(?:<|$)`,
    'gim'
  )
  
  let match: RegExpExecArray | null
  const seenVariants = new Set<string>()
  
  while ((match = variantPattern.exec(html)) !== null) {
    const variantSuffix = match[2]
    
    // Skip if this is a roman numeral (I, II, III, etc.)
    if (/^[IVX]+$/i.test(variantSuffix)) continue
    
    // Skip if this is "Level", "Element", etc. (common keywords, not variant names)
    if (/^(Level|Element|Damage|Attack|Type|Rarity|Location|Price|Sellback|Stats|Resists|Bonuses|Pet|Guest)$/i.test(variantSuffix)) continue
    
    // Skip common forum poster names (Baron Dante, etc.)
    if (/^(Dante|Member|Moderator|Admin)$/i.test(variantSuffix)) continue
    
    // Avoid duplicates
    if (seenVariants.has(variantSuffix.toLowerCase())) continue
    seenVariants.add(variantSuffix.toLowerCase())
    
    variants.push({
      startIndex: match.index,
      variantName: variantSuffix,
    })
  }
  
  // Only return if we found 2+ distinct variants
  return variants.length >= 2 ? variants : []
}

/**
 * Detect number of pages in a forum thread
 */
function detectMultiPage(html: string): number {
  // Look for "Page 1 of 7" indicators
  const pageMatch = html.match(/Page\s+\d+\s+of\s+(\d+)/i)
  if (pageMatch) return parseInt(pageMatch[1], 10)
  
  // Fallback: look for mpage= links
  const pageLinks = html.match(/mpage=\d+/gi) || []
  if (pageLinks.length > 0) {
    const pageNumbers = pageLinks.map(link => parseInt(link.match(/\d+/)![0], 10))
    return Math.max(...pageNumbers, 1)
  }
  
  return 1
}

/**
 * Parse DA requirement from section text
 * Handles all known variations:
 * - Image tag: <img src=".../tags/DA.png">
 * - "Requires a Dragon Amulet to use"
 * - "(No DA Required)" or "No DA Required"
 * - Absence of text (default: false)
 */
function parseDARequiredFromSection(sectionText: string, rawHtml: string): boolean {
  // Primary: Check for DA.png image tag (most reliable)
  if (/<img[^>]+src=["'][^"']*\/tags\/DA\.png["']/i.test(rawHtml)) {
    return true
  }
  
  // Text patterns
  if (/Requires\s+a\s+Dragon\s+Amulet/i.test(sectionText)) return true
  if (/\(?\s*No\s+DA\s+Required\s*\)?/i.test(sectionText)) return false
  
  // Default: no DA required
  return false
}

/**
 * Detect level from pet name
 * Returns { number, display } or null if not a leveled variant
 * Examples: 
 * - "Goldfish Knight IV" → {4, "IV"}
 * - "BabyWeaver I" (within body) → {1, "I"}
 * - "BabyWeaver (I-VI)" → null (range notation, not a specific level)
 */
function detectLevel(name: string): { number: number; display: string } | null {
  // Skip range notations like "(I-VI)" — these indicate the thread contains multiple levels
  if (/\([IVX]+-[IVX]+\)/.test(name)) {
    return null
  }
  
  // Roman numerals at end: "Goldfish Knight IV"
  const romanMatch = name.match(/\b([IVX]+)$/i)
  if (romanMatch) {
    const roman = romanMatch[1].toUpperCase()
    const normalized = normalizeLevel(roman)
    if (normalized.number > 0 && normalized.number <= 10) {
      return normalized
    }
  }
  
  // Numeric levels at end: "Level 30", "Lv 40"
  const numericMatch = name.match(/\b(?:Level|Lv\.?)\s+(\d+)$/i)
  if (numericMatch) {
    const num = parseInt(numericMatch[1], 10)
    return { number: num, display: num.toString() }
  }
  
  return null
}

/**
 * Check if pet name indicates a multi-level thread with range notation
 * Examples: 
 * - "BabyWeaver (I-VI)" → true
 * - "Balloon Chickencow Pet (All Versions)" → true
 * - "Goldfish Knight IV" → false
 */
function hasLevelRange(name: string): boolean {
  return /\([IVX]+-[IVX]+\)/.test(name) || /\(All Versions\)/i.test(name)
}

/**
 * Extract shared image and alternative images from post HTML
 * 
 * Priority for main image:
 * 1. GitHub DF-Pedia URLs (github.com or githubusercontent.com with DF-Pedia path)
 * 2. imgur as fallback if no DF-Pedia found
 * 
 * Alternative images: All other valid images (imgur, etc.) when DF-Pedia main exists
 * 
 * Filters out: Attack images, Button images, tag images
 */
function extractImages(html: string): { main?: string; alternatives: Array<{ url: string; caption: string }> } {
  const skipPatterns = [
    /Button/i,
    /Attack\.png/i,
    /Attack\d+\.png/i,  // Attack1.png, Attack2.png, etc.
    /PetAttack/i,       // AncientNinjaTerrapinPetAttack1.png
    /AttackType/i,      // BabyDracolichPet-AttackType1.png
    /-Attack/i,         // Any attack image with dash prefix
    /forums2\.battleon\.com\/f\/upfiles/i,  // Forum poster profile images
    /tags\/(DA|DC|DM|Temp|Rare|Seasonal|SpecialOffer|Retired)/i,
    /width=["']?\d{1,2}["']?/,  // Tiny images
    /forumheader/i,
    /clear\.gif/i,
    /blank\.gif/i,
  ]
  
  // Helper to check if URL should be skipped
  const shouldSkip = (url: string) => skipPatterns.some(p => p.test(url))
  
  // Separate lists for different sources
  const dfPediaImages: string[] = []
  const imgurImages: string[] = []
  const otherImages: string[] = []
  
  // Extract from <img> tags
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
  let imgMatch: RegExpExecArray | null
  
  while ((imgMatch = imgRegex.exec(html)) !== null) {
    const src = imgMatch[1]
    if (shouldSkip(src)) continue
    
    if (src.includes('github.com/DF-Pedia') || src.includes('githubusercontent.com') && src.includes('DF-Pedia')) {
      if (!dfPediaImages.includes(src)) dfPediaImages.push(src)
    } else if (src.includes('imgur.com') || src.includes('i.imgur.com')) {
      if (!imgurImages.includes(src)) imgurImages.push(src)
    } else if (src.includes('media.artix.com/encyc') || 
               src.includes('battleon.com/encyc') ||
               (src.includes('/f/upfiles/') && src.length > 60)) {
      if (!otherImages.includes(src)) otherImages.push(src)
    }
  }
  
  // Extract from <a href> tags (for "Alternative Image" links)
  const linkRegex = /<a[^>]+href=["']([^"']+\.(?:jpg|jpeg|png|gif))["'][^>]*>/gi
  let linkMatch: RegExpExecArray | null
  while ((linkMatch = linkRegex.exec(html)) !== null) {
    const url = linkMatch[1]
    if (shouldSkip(url)) continue
    
    if (url.includes('github.com/DF-Pedia') || url.includes('githubusercontent.com') && url.includes('DF-Pedia')) {
      if (!dfPediaImages.includes(url)) dfPediaImages.push(url)
    } else if (url.includes('imgur.com') || url.includes('i.imgur.com')) {
      if (!imgurImages.includes(url)) imgurImages.push(url)
    } else if (url.includes('media.artix.com/encyc') || 
               url.includes('battleon.com/encyc') ||
               (url.includes('/f/upfiles/') && url.length > 60)) {
      if (!otherImages.includes(url)) otherImages.push(url)
    }
  }
  
  // Extract bare URLs in text
  const bareUrlRegex = /https?:\/\/(?:[^\s<>"]+?)\.(?:jpg|jpeg|png|gif)/gi
  let urlMatch: RegExpExecArray | null
  while ((urlMatch = bareUrlRegex.exec(html)) !== null) {
    const url = urlMatch[0]
    if (shouldSkip(url)) continue
    
    if (url.includes('github.com/DF-Pedia') || url.includes('githubusercontent.com') && url.includes('DF-Pedia')) {
      if (!dfPediaImages.includes(url)) dfPediaImages.push(url)
    } else if (url.includes('imgur.com') || url.includes('i.imgur.com')) {
      if (!imgurImages.includes(url)) imgurImages.push(url)
    } else if (url.includes('media.artix.com/encyc') || 
               url.includes('battleon.com/encyc') ||
               (url.includes('/f/upfiles/') && url.length > 60)) {
      if (!otherImages.includes(url)) otherImages.push(url)
    }
  }
  
  // Determine main image
  let main: string | undefined
  const alternatives: Array<{ url: string; caption: string }> = []
  
  if (dfPediaImages.length > 0) {
    // DF-Pedia is main, everything else is alternative
    main = dfPediaImages[0]
    
    // Additional DF-Pedia images are alternatives too (but shouldn't happen since we filter attacks)
    for (let i = 1; i < dfPediaImages.length; i++) {
      alternatives.push({ url: dfPediaImages[i], caption: 'Alternative Image' })
    }
    
    // All imgur images are alternatives
    for (const url of imgurImages) {
      const imgPos = html.indexOf(url)
      const caption = findCaptionNear(html, imgPos)
      alternatives.push({ url, caption })
    }
    
    // Other images are alternatives
    for (const url of otherImages) {
      const imgPos = html.indexOf(url)
      const caption = findCaptionNear(html, imgPos)
      alternatives.push({ url, caption })
    }
  } else if (imgurImages.length > 0) {
    // No DF-Pedia, use imgur as fallback main
    main = imgurImages[0]
    
    // Rest of imgur are alternatives
    for (let i = 1; i < imgurImages.length; i++) {
      alternatives.push({ url: imgurImages[i], caption: 'Alternative Image' })
    }
    
    // Other images are alternatives
    for (const url of otherImages) {
      const imgPos = html.indexOf(url)
      const caption = findCaptionNear(html, imgPos)
      alternatives.push({ url, caption })
    }
  } else if (otherImages.length > 0) {
    // Last resort: use other images
    main = otherImages[0]
    for (let i = 1; i < otherImages.length; i++) {
      alternatives.push({ url: otherImages[i], caption: 'Alternative Image' })
    }
  }
  
  return { main, alternatives }
}

/**
 * Find caption text near an image position in HTML
 */
function findCaptionNear(html: string, imgPos: number): string {
  if (imgPos === -1) return 'Alternative Image'
  
  // Look backward up to 200 chars for caption text
  const beforeImg = html.slice(Math.max(0, imgPos - 200), imgPos)
  
  // Pattern 1: <b>Caption Text</b> followed by image
  const boldMatch = beforeImg.match(/<b>([^<]+)<\/b>\s*$/i)
  if (boldMatch) {
    return stripHtml(decodeHTML(boldMatch[1])).trim()
  }
  
  // Pattern 2: Link text like "Alternative Image"
  const linkTextMatch = beforeImg.match(/>([^<]+)<\/a>\s*$/i)
  if (linkTextMatch) {
    const text = stripHtml(decodeHTML(linkTextMatch[1])).trim()
    if (text.length > 3 && text.length < 50) {
      return text
    }
  }
  
  // Pattern 3: Plain text followed by image
  const plainTextMatch = beforeImg.match(/([A-Z][a-z\s]+)\s*$/i)
  if (plainTextMatch && plainTextMatch[1].length < 50) {
    const caption = plainTextMatch[1].trim()
    if (caption.length > 3 && /^[A-Z]/.test(caption)) {
      return caption
    }
  }
  
  return 'Alternative Image'
}

// ─────────────────────────────────────────────────────────────────────────────

function parsePriceType(price: string, requiredItems?: string): ObtainMethod['priceType'] {
  const p = price.toLowerCase()
  
  // Dragon Coins
  if (p.includes('dragon coin') || p.includes(' dc') || p === '0 dc') return 'dc'
  
  // Defender's Medals
  if (p.includes("defender's medal") || p.includes('defender medal') || p.includes(' dm')) return 'dm'
  
  // Free = explicitly 0 Gold or "Free"
  if (p === '0 gold' || p === 'free') return 'free'
  
  // Merge = N/A price WITH required items
  if ((p === 'n/a' || p === '0') && requiredItems && requiredItems.trim().length > 0) return 'merge'
  
  // Gold (includes paid gold amounts and N/A without required items)
  if (p.includes('gold')) return 'gold'
  
  // Default to merge for anything else with required items
  if (requiredItems && requiredItems.trim().length > 0) return 'merge'
  
  return 'gold'
}

// ─── Multi-Variant Wrapper (Sprint 5) ────────────────────────────────────────

/**
 * Parse pet thread with multi-variant detection
 * Returns Pet (single-variant) or ItemFamily (multi-variant)
 * 
 * Strategy:
 * 1. Check for multi-page thread (detectMultiPage)
 * 2. For single-page threads with no level indicator → use existing parsePetThread
 * 3. For multi-page or leveled threads → parse all posts as ItemFamily
 */
async function parsePetThreadMultiVariant(
  html: string,
  name: string,
  stub: PetStub,
  cookie: string,
  chronoDates: Map<string, string>,
  nameToSlug: Map<string, { slug: string; type: EntryType }>
): Promise<Pet | ItemFamily> {
  // Check for level indicator in name (e.g., "BabyWeaver I" or range notation "(I-VI)")
  const hasLevelInName = /\b([IVX]+|Level\s+\d+)$/i.test(name) || hasLevelRange(name)
  
  // Check for multi-page thread
  const totalPages = detectMultiPage(html)
  
  // Check for multi-post variants (like Baron (Kitten, Cat))
  const baseName = name.replace(/\s*\([^)]+\)/, '').trim()
  const multiPostVariants = detectMultiPostVariants(html, baseName)
  const hasMultiPostVariants = multiPostVariants.length >= 2
  
  // Single-page AND no level indicator AND no multi-post variants → use existing logic (backward compat)
  if (totalPages === 1 && !hasLevelInName && !hasMultiPostVariants) {
    const data = parsePetThread(html, name)
    return convertToPet(data, stub, chronoDates, nameToSlug)
  }
  
  // Multi-variant path: fetch all pages if needed
  let allPosts: string[] = [html]
  
  if (totalPages > 1) {
    console.log(` [${totalPages} pages]`)
    for (let page = 2; page <= totalPages; page++) {
      try {
        await sleep(DELAY_MS)
        const pageHtml = getPostContent(await fetchPrintable(stub.messageId, cookie, page))
        allPosts.push(pageHtml)
      } catch (err) {
        console.warn(`⚠️  Page ${page}/${totalPages} failed: ${err}`)
        break
      }
    }
  }
  
  // Parse level variants from all posts
  const levelVariantsMap = new Map<number, LevelVariant>()
  let sharedDescription = ''
  let sharedElement: string | undefined
  let sharedRarity: string | undefined
  let sharedResists: string | undefined
  let sharedAttacks: Attack[] = []
  let sharedNotes: string | undefined
  let sharedAlsoSeeNames: string[] = []
  
  // Handle multi-post variants first (like Baron: Kitten, Cat)
  if (hasMultiPostVariants) {
    console.log(` [Multi-post: ${multiPostVariants.map(v => v.variantName).join(', ')}]`)
    
    // Sort variants by start index
    multiPostVariants.sort((a, b) => a.startIndex - b.startIndex)
    
    // Strategy: Look for table row boundaries that separate forum posts
    // Each forum post is typically in its own table structure
    // We need to find the <tr> or <table> that contains each variant heading
    
    for (let i = 0; i < multiPostVariants.length; i++) {
      const variant = multiPostVariants[i]
      const nextVariant = multiPostVariants[i + 1]
      
      // Find the table row containing this variant
      // Search backward from variant.startIndex to find <tr or <table
      const searchStart = Math.max(0, variant.startIndex - 500)
      const htmlBefore = html.slice(searchStart, variant.startIndex)
      
      // Find the last <tr> or <table> before the variant heading
      const lastTR = htmlBefore.lastIndexOf('<tr')
      const lastTable = htmlBefore.lastIndexOf('<table')
      const contentStart = searchStart + Math.max(lastTR, lastTable, 0)
      
      // End at the next variant's table start, or at end of HTML
      let contentEnd: number
      if (nextVariant) {
        const nextSearchStart = Math.max(0, nextVariant.startIndex - 500)
        const nextHtmlBefore = html.slice(nextSearchStart, nextVariant.startIndex)
        const nextLastTR = nextHtmlBefore.lastIndexOf('<tr')
        const nextLastTable = nextHtmlBefore.lastIndexOf('<table')
        contentEnd = nextSearchStart + Math.max(nextLastTR, nextLastTable, 0)
      } else {
        contentEnd = html.length
      }
      
      const variantHtml = html.slice(contentStart, contentEnd)
      
      // Parse this variant's data
      const data = parsePetThread(variantHtml, `${baseName} ${variant.variantName}`)
      
      // Use sequential numbering for level sorting
      const levelNum = i + 1
      
      const obtainVariants: ObtainVariant[] = data.obtainMethods.map(om => ({
        location: om.location,
        price: om.price,
        priceType: computePriceType(om.price, om.requiredItems),
        sellback: om.sellback,
        daRequired: om.daRequired ?? false,
        ...(om.dcRequired ? { dcRequired: om.dcRequired } : {}),
        ...(om.dmRequired ? { dmRequired: om.dmRequired } : {}),
        ...(om.requiredItems ? { requiredItems: om.requiredItems } : {}),
      }))
      
      if (obtainVariants.length > 0) {
        const actualLevel = data.level && data.level !== 'Unknown' ? parseInt(data.level, 10) : undefined
        
        // Capture shared data from first variant BEFORE creating level variant
        // so we can distinguish between shared vs level-specific notes
        const isFirstVariant = !sharedDescription
        if (isFirstVariant) {
          sharedDescription = data.description
          sharedElement = stub.elements.length > 0 ? stub.elements[0] : undefined
          sharedRarity = data.rarity !== 'Unknown' ? data.rarity : undefined
          sharedResists = data.resists !== 'None' ? data.resists : undefined
          sharedAttacks = data.attacks
          sharedNotes = data.notes // Shared notes come from first variant
          sharedAlsoSeeNames = data.alsoSeeNames
        }
        
        // Create level variant - only include notes if NOT the first variant (to avoid duplication)
        levelVariantsMap.set(levelNum, {
          levelNumber: levelNum,
          levelDisplay: variant.variantName,  // "Kitten", "Cat"
          ...(actualLevel && !isNaN(actualLevel) ? { actualLevel } : {}),
          name: `${baseName} ${variant.variantName}`,
          damage: data.damage || 'Unknown',
          stats: data.stats || 'None',
          ...(data.statsType ? { statsType: data.statsType } : {}),
          obtainVariants,
          ...(data.resists && data.resists !== 'None' ? { resists: data.resists } : {}),
          ...(data.rarity && data.rarity !== 'Unknown' ? { rarity: data.rarity } : {}),
          // Only include notes if NOT from first variant (first variant notes go to shared)
          ...(!isFirstVariant && data.notes ? { notes: data.notes } : {}),
        })
      } else {
        console.log(` [variant ${variant.variantName}: no obtain methods found]`)
      }
    }
  } else if (hasLevelRange(name)) {
    // Two types of multi-variant notation:
    // 1. Roman numeral range: "Pet Name (I-VI)" → sections named "Pet Name I", "Pet Name II", etc.
    // 2. All Versions: "Pet Name (All Versions)" → repeated pet name + Level: X markers
    
    const baseName = name.replace(/\s*\([IVX]+-[IVX]+\)/, '').replace(/\s*\(All Versions\)/, '').trim()
    const isAllVersions = /\(All Versions\)/i.test(name)
    
    const sections: Array<{ levelNum: number; romanDisplay: string; html: string; startIndex: number }> = []
    
    if (isAllVersions) {
      // "(All Versions)" pattern - look for repeated pet name headings + Level: X
      // The same name appears multiple times, each followed by different level data
      
      // Find all occurrences of the pet name in heading-like context
      const namePattern = new RegExp(
        `(?:<[^>]*>\\s*)?${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s*<[^>]*>)?`,
        'gi'
      )
      
      const potentialSections: Array<{ startIndex: number; level?: number }> = []
      let match: RegExpExecArray | null
      
      while ((match = namePattern.exec(html)) !== null) {
        potentialSections.push({ startIndex: match.index })
      }
      
      // For each potential section, look for the Level: X that follows it
      for (const section of potentialSections) {
        const htmlSlice = html.slice(section.startIndex, section.startIndex + 500)
        const levelMatch = htmlSlice.match(/Level:\s*(\d+)/i)
        if (levelMatch) {
          section.level = parseInt(levelMatch[1], 10)
        }
      }
      
      // Keep only sections with valid levels
      const validSections = potentialSections
        .filter(s => s.level && s.level > 0 && s.level <= 200)
        .sort((a, b) => a.startIndex - b.startIndex)
      
      // Remove duplicate levels (keep first occurrence)
      const seenLevels = new Set<number>()
      for (const section of validSections) {
        if (!seenLevels.has(section.level!)) {
          seenLevels.add(section.level!)
          sections.push({
            levelNum: section.level!,
            romanDisplay: section.level!.toString(),
            html: '',
            startIndex: section.startIndex,
          })
        }
      }
    } else {
      // Roman numeral range pattern - look for "Pet Name I", "Pet Name II", etc.
      // Handle extreme spacing variations like:
      // - "BabyWeaver I" (no space in name)
      // - "Baby Weaver III" (space in name)
      // - "BabyWeaverVI" (no space before numeral)
      // Strategy: Make EVERY character in the base name match with optional whitespace after it
      const baseChars = baseName.split('')
      const ultraFlexPattern = baseChars
        .map(char => char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*')
        .join('')
      
      const sectionPattern = new RegExp(
        `(?:<[^>]*>)?\\s*(${ultraFlexPattern}([IVX]+))\\s*(?:<[^>]*>)?`,
        'gi'
      )
      
      let match: RegExpExecArray | null
      while ((match = sectionPattern.exec(html)) !== null) {
        const romanDisplay = match[2]
        const levelNum = normalizeLevel(romanDisplay).number
        if (levelNum > 0 && levelNum <= 10) {
          sections.push({
            levelNum,
            romanDisplay,
            html: '',
            startIndex: match.index,
          })
        }
      }
    }
    
    // Sort by start index and extract HTML for each section
    sections.sort((a, b) => a.startIndex - b.startIndex)
    
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i]
      const nextSection = sections[i + 1]
      
      // For the last section, look for common end markers
      let endIndex: number
      if (nextSection) {
        endIndex = nextSection.startIndex
      } else {
        // Last section - find reasonable end boundary
        // Look for common markers that indicate end of level-specific content
        const dfPediaImageMatch = html.slice(section.startIndex).search(/https:\/\/github\.com\/DF-Pedia\/DF-Pedia\/raw\/master/i)
        const otherInfoMatch = html.slice(section.startIndex).search(/<b>\s*<u>\s*Other\s+information\s*<\/u>\s*<\/b>/i)
        const thanksMatch = html.slice(section.startIndex).search(/Thanks\s+to\b/i)
        const alsoSeeMatch = html.slice(section.startIndex).search(/Also\s+See:/i)
        const endMarkers = [dfPediaImageMatch, otherInfoMatch, thanksMatch, alsoSeeMatch].filter(m => m > 0)
        
        if (endMarkers.length > 0) {
          endIndex = section.startIndex + Math.min(...endMarkers)
        } else {
          endIndex = html.length
        }
      }
      
      section.html = html.slice(section.startIndex, endIndex)
    }
    
    // Parse each section
    for (const section of sections) {
      const levelName = isAllVersions ? baseName : `${baseName} ${section.romanDisplay}`
      const data = parsePetThread(section.html, levelName)
      
      // Parse actual level number from "Level: X" in the section
      const actualLevel = data.level && data.level !== 'Unknown' ? parseInt(data.level, 10) : undefined
      
      // Detect DA/DC from THIS section's HTML (not global)
      const sectionDARequired = parseDARequiredFromSection(section.html, section.html)
      const sectionDCRequired = /<img[^>]+src=["'][^"']*\/tags\/DC\.png["']/i.test(section.html)
      const sectionDMRequired = /<img[^>]+src=["'][^"']*\/tags\/DM\.png["']/i.test(section.html)
      
      // Debug: Check for DC tag in price text as fallback (sometimes tag appears in obtain method)
      let dcFromPrice = false
      if (!sectionDCRequired && data.obtainMethods.length > 0) {
        dcFromPrice = data.obtainMethods.some(om => 
          om.price.toLowerCase().includes('dragon coin') || 
          om.priceType === 'dc'
        )
      }
      
      const obtainVariants: ObtainVariant[] = data.obtainMethods.map(om => ({
        location: om.location,
        price: om.price,
        priceType: computePriceType(om.price, om.requiredItems),
        sellback: om.sellback,
        daRequired: sectionDARequired,
        ...(sectionDCRequired || dcFromPrice ? { dcRequired: true } : {}),
        ...(sectionDMRequired ? { dmRequired: sectionDMRequired } : {}),
        ...(om.requiredItems ? { requiredItems: om.requiredItems } : {}),
      }))
      
      if (obtainVariants.length > 0) {
        // Capture shared data from first level BEFORE creating variant
        const isFirstLevel = !sharedDescription
        if (isFirstLevel) {
          sharedDescription = data.description
          sharedElement = stub.elements.length > 0 ? stub.elements[0] : undefined
          sharedRarity = data.rarity !== 'Unknown' ? data.rarity : undefined
          sharedResists = data.resists !== 'None' ? data.resists : undefined
          sharedAttacks = data.attacks
          sharedNotes = data.notes // Shared notes come from first level
          sharedAlsoSeeNames = data.alsoSeeNames
        }
        
        levelVariantsMap.set(section.levelNum, {
          levelNumber: section.levelNum,
          levelDisplay: section.romanDisplay,
          ...(actualLevel && !isNaN(actualLevel) ? { actualLevel } : {}),
          name: levelName,
          damage: data.damage || 'Unknown',
          stats: data.stats || 'None',
          ...(data.statsType ? { statsType: data.statsType } : {}),
          obtainVariants,
          ...(data.resists && data.resists !== 'None' ? { resists: data.resists } : {}),
          ...(data.rarity && data.rarity !== 'Unknown' ? { rarity: data.rarity } : {}),
          // Only include notes if NOT from first level (first level notes go to shared)
          ...(!isFirstLevel && data.notes ? { notes: data.notes } : {}),
        })
      }
    }
    
    // For range notation threads, look for "Other information" section after all levels
    // (Usually appears at the end of the thread, after all level sections)
    if (sections.length > 0 && !sharedNotes) {
      const lastSection = sections[sections.length - 1]
      const afterLastSection = html.slice(lastSection.startIndex + lastSection.html.length)
      
      // Parse the remainder of the HTML to extract notes from "Other information"
      const remainderData = parsePetThread(afterLastSection, baseName)
      if (remainderData.notes) {
        sharedNotes = remainderData.notes
      }
    }
  } else {
    // Multi-page thread with separate posts per level
    for (const postHtml of allPosts) {
      const data = parsePetThread(postHtml, name)
      
      // Detect level for this post
      const levelInfo = detectLevel(name)
      if (!levelInfo) {
        // No level detected - treat as single variant
        return convertToPet(data, stub, chronoDates, nameToSlug)
      }
      
      // Parse obtain variants from this post
      const obtainVariants: ObtainVariant[] = data.obtainMethods.map(om => ({
        location: om.location,
        price: om.price,
        priceType: computePriceType(om.price, om.requiredItems),
        sellback: om.sellback,
        daRequired: parseDARequiredFromSection(postHtml, postHtml),
        ...(data.dcRequired ? { dcRequired: data.dcRequired } : {}),
        ...(data.dmRequired ? { dmRequired: data.dmRequired } : {}),
        ...(om.requiredItems ? { requiredItems: om.requiredItems } : {}),
      }))
      
      // Check if we already have this level (same level, different obtain method)
      const existing = levelVariantsMap.get(levelInfo.number)
      if (existing) {
        // Merge obtain variants
        existing.obtainVariants.push(...obtainVariants)
      } else {
        // Capture shared data from first post BEFORE creating variant
        const isFirstPost = !sharedDescription
        if (isFirstPost) {
          sharedDescription = data.description
          sharedElement = stub.elements.length > 0 ? stub.elements[0] : undefined
          sharedRarity = data.rarity !== 'Unknown' ? data.rarity : undefined
          sharedResists = data.resists !== 'None' ? data.resists : undefined
          sharedAttacks = data.attacks
          sharedNotes = data.notes // Shared notes come from first post
          sharedAlsoSeeNames = data.alsoSeeNames
        }
        
        // New level variant
        levelVariantsMap.set(levelInfo.number, {
          levelNumber: levelInfo.number,
          levelDisplay: levelInfo.display,
          name: name,
          damage: data.damage || 'Unknown',
          stats: data.stats || 'None',
          obtainVariants,
          ...(data.resists && data.resists !== 'None' ? { resists: data.resists } : {}),
          ...(data.rarity && data.rarity !== 'Unknown' ? { rarity: data.rarity } : {}),
          // Only include notes if NOT from first post (first post notes go to shared)
          ...(!isFirstPost && data.notes ? { notes: data.notes } : {}),
        })
      }
    }
  }
  
  const levelVariants = Array.from(levelVariantsMap.values()).sort((a, b) => a.levelNumber - b.levelNumber)
  
  // If no level variants found (empty levelVariantsMap), fall back to single-variant Pet
  if (levelVariants.length === 0) {
    console.log(' [no variants detected, falling back to Pet]')
    const data = parsePetThread(allPosts[0], name)
    return convertToPet(data, stub, chronoDates, nameToSlug)
  }
  
  // If only one level variant found, return as Pet (backward compat)
  if (levelVariants.length === 1) {
    const data = parsePetThread(allPosts[0], name)
    return convertToPet(data, stub, chronoDates, nameToSlug)
  }
  
  // Extract image from LAST post first (common pattern for multi-post threads)
  let imageUrl: string | undefined
  const alternativeImages: Array<{ url: string; caption: string }> = []
  
  for (let i = allPosts.length - 1; i >= 0; i--) {
    const images = extractImages(allPosts[i])
    if (images.main) {
      imageUrl = images.main
      alternativeImages.push(...images.alternatives)
      break
    }
  }
  
  // Resolve Also See references
  const alsoSee: AlsoSeeRef[] = sharedAlsoSeeNames.map(rawName => {
    const key = rawName.toLowerCase().replace(/[.,!?]+$/, '').trim()
    const r = nameToSlug.get(key) ?? nameToSlug.get(key.replace(/\s*\([^)]+\)\s*$/, '').trim())
    return r ? { name: rawName.replace(/[.,!?]+$/, '').trim(), slug: r.slug, type: r.type } : null
  }).filter((r): r is AlsoSeeRef => r !== null)
  
  // Build ItemFamily
  const shared: SharedData = {
    description: sharedDescription || name,
    ...(sharedElement ? { element: sharedElement } : {}),
    ...(sharedRarity ? { rarity: sharedRarity } : {}),
    ...(sharedResists ? { resists: sharedResists } : {}),
    ...(sharedAttacks.length > 0 ? { attacks: sharedAttacks } : {}),
    ...(sharedNotes ? { notes: sharedNotes } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(alternativeImages.length > 0 ? { alternativeImages } : {}),
    ...(alsoSee.length > 0 ? { alsoSee } : {}),
  }
  
  // Detect category flags from the FULL thread HTML (not just sections)
  // These tags appear at thread level, usually at the top
  const threadIsTemp = /<img[^>]+src=["'][^"']*\/tags\/Temp\.png["']/i.test(html)
  const threadIsRare = /<img[^>]+src=["'][^"']*\/tags\/Rare\.jpg["']/i.test(html)
  const threadIsSeasonal = /<img[^>]+src=["'][^"']*\/tags\/Seasonal\.jpg["']/i.test(html)
  const threadIsSpecialOffer = /<img[^>]+src=["'][^"']*\/tags\/SpecialOffer\.png["']/i.test(html)
  const threadRetired = /<img[^>]+src=["'][^"']*\/tags\/Retired\.png["']/i.test(html)
  
  // Check for DC tag in thread HTML as well (for cases like Baby Kraken VI)
  const threadHasDC = /<img[^>]+src=["'][^"']*\/tags\/DC\.png["']/i.test(html)
  
  // Also check allPosts if multi-page thread
  let isTemp = threadIsTemp
  let isRare = threadIsRare
  let isSeasonal = threadIsSeasonal
  let isSpecialOffer = threadIsSpecialOffer
  let retired = threadRetired
  let hasDCInThread = threadHasDC
  
  if (allPosts.length > 1) {
    for (const postHtml of allPosts) {
      if (!isTemp) isTemp = /<img[^>]+src=["'][^"']*\/tags\/Temp\.png["']/i.test(postHtml)
      if (!isRare) isRare = /<img[^>]+src=["'][^"']*\/tags\/Rare\.jpg["']/i.test(postHtml)
      if (!isSeasonal) isSeasonal = /<img[^>]+src=["'][^"']*\/tags\/Seasonal\.jpg["']/i.test(postHtml)
      if (!isSpecialOffer) isSpecialOffer = /<img[^>]+src=["'][^"']*\/tags\/SpecialOffer\.png["']/i.test(postHtml)
      if (!retired) retired = /<img[^>]+src=["'][^"']*\/tags\/Retired\.png["']/i.test(postHtml)
      if (!hasDCInThread) hasDCInThread = /<img[^>]+src=["'][^"']*\/tags\/DC\.png["']/i.test(postHtml)
    }
  }
  
  // If DC tag found in thread, mark ALL obtain variants as DC required
  // (This handles cases like Baby Kraken VI where DC icon appears but price isn't DC)
  if (hasDCInThread) {
    for (const levelVariant of levelVariants) {
      for (const obtainVariant of levelVariant.obtainVariants) {
        obtainVariant.dcRequired = true
      }
    }
  }
  
  // Strip level suffix from family name
  // For multi-post variants (e.g., Baron (Kitten, Cat)), use the ORIGINAL name from forums
  // For roman numeral ranges (e.g., BabyWeaver (I-VI)), strip the range notation
  let familyName: string
  let isMultiPostFamily = false
  
  if (hasMultiPostVariants) {
    // Multi-post variant: use original name exactly as it appears in forums
    // e.g., "Baron (Kitten, Cat)" not "Baron"
    familyName = name
    isMultiPostFamily = true
  } else {
    // Roman numeral or "All Versions" ranges: strip the suffix
    familyName = name
      .replace(/\s+[IVX]+$/i, '')
      .replace(/\s+Level\s+\d+$/i, '')
      .replace(/\s+\([IVX]+-[IVX]+\)$/i, '')
      .replace(/\s+\(All Versions\)$/i, '')
      .trim()
  }
  
  const family: ItemFamily = {
    id: prefixedSlug(familyName, stub.type),
    familyName,
    slug: prefixedSlug(familyName, stub.type),
    type: stub.type,
    forumUrl: stub.forumUrl,
    shared,
    levelVariants,
    ...(chronoDates.get(stub.name.toLowerCase()) ? { releaseDate: chronoDates.get(stub.name.toLowerCase())! } : {}),
    tags: [stub.type, ...stub.elements.map(e => e.toLowerCase()), ...stub.markers.map(m => m.toLowerCase().replace('/', '-'))],
    // Category flags from thread-level detection
    ...(isTemp ? { isTemp } : {}),
    ...(isRare ? { isRare } : {}),
    ...(isSeasonal ? { isSeasonal } : {}),
    ...(isSpecialOffer ? { isSpecialOffer } : {}),
    ...(retired ? { retired } : {}),
    // Access flags will be computed by computeFamilyFlags
    hasDA: false,
    hasDC: false,
    hasDM: false,
    hasFree: false,
    hasMerge: false,
    levelRange: '',
    elements: [],
    // Mark multi-post families for special handling
    ...(isMultiPostFamily ? { isMultiPost: true } : {}),
  }
  
  // Compute family-level flags
  return computeFamilyFlags(family)
}

/**
 * Convert parsed thread data to Pet object (backward compatibility)
 */
function convertToPet(
  data: ReturnType<typeof parsePetThread>,
  stub: PetStub,
  chronoDates: Map<string, string>,
  nameToSlug: Map<string, { slug: string; type: EntryType }>
): Pet {
  // Resolve Also See references
  const alsoSee: AlsoSeeRef[] = data.alsoSeeNames.map(rawName => {
    const key = rawName.toLowerCase().replace(/[.,!?]+$/, '').trim()
    const r = nameToSlug.get(key) ?? nameToSlug.get(key.replace(/\s*\([^)]+\)\s*$/, '').trim())
    return r ? { name: rawName.replace(/[.,!?]+$/, '').trim(), slug: r.slug, type: r.type } : null
  }).filter((r): r is AlsoSeeRef => r !== null)
  
  // Resolve evolutions
  const evolutions: Evolution[] = data.evolutions.map(ev => {
    const key = ev.resultName.toLowerCase()
    const r = nameToSlug.get(key) ?? nameToSlug.get(key.replace(/\s*\([^)]+\)\s*$/, '').trim())
    return {
      combineWith: ev.combineWith,
      resultName: ev.resultName,
      resultSlug: r?.slug ?? prefixedSlug(ev.resultName, 'pet'),
      resultType: r?.type ?? 'pet' as EntryType,
    }
  })
  
  return {
    id: stub.slug,
    name: stub.name,
    slug: stub.slug,
    type: stub.type,
    description: data.description,
    daRequired: data.daRequired,
    ...(data.dcRequired ? { dcRequired: data.dcRequired } : {}),
    ...(data.dmRequired ? { dmRequired: data.dmRequired } : {}),
    ...(data.isTemp ? { isTemp: data.isTemp } : {}),
    ...(data.isRare ? { isRare: data.isRare } : {}),
    ...(data.isSeasonal ? { isSeasonal: data.isSeasonal } : {}),
    ...(data.isSpecialOffer ? { isSpecialOffer: data.isSpecialOffer } : {}),
    ...(data.retired ? { retired: data.retired } : {}),
    elements: stub.elements,
    traits: stub.markers,
    level: data.level || 'Unknown',
    damage: data.damage || 'Unknown',
    stats: data.stats || 'None',
    resists: data.resists || 'None',
    obtainMethods: data.obtainMethods,
    attacks: data.attacks,
    rarity: data.rarity || 'Unknown',
    evolutions,
    releaseDate: chronoDates.get(stub.name.toLowerCase()) ?? 'Unknown',
    ...(data.imageUrl ? { imageUrl: data.imageUrl } : {}),
    ...(data.alternativeImages && data.alternativeImages.length > 0 ? { alternativeImages: data.alternativeImages } : {}),
    forumUrl: stub.forumUrl,
    ...(data.notes ? { notes: data.notes } : {}),
    alsoSee,
    tags: [stub.type, ...stub.elements.map(e => e.toLowerCase()), ...stub.markers.map(m => m.toLowerCase().replace('/', '-'))]
  }
}

// ─────────────────────────────────────────────────────────────────────────────

function parsePetThread(html: string, name: string): {
  description: string; daRequired: boolean; dcRequired: boolean; dmRequired: boolean
  isTemp: boolean; isRare: boolean; isSeasonal: boolean; isSpecialOffer: boolean; retired: boolean
  obtainMethods: ObtainMethod[]
  level: string; damage: string; stats: string; statsType: 'petStats' | 'bonuses' | undefined; resists: string
  evolutions: { combineWith: string; resultName: string }[]
  rarity: string; attacks: Attack[]; notes?: string
  alsoSeeNames: string[]; imageUrl?: string; alternativeImages?: Array<{ url: string; caption: string }>; hasDetailedStats: boolean
} {
  const bodyMatch = html.match(/<td[^>]*valign=["']?top["']?[^>]*width=["']?100%["']?[^>]*>([\s\S]*?)<\/td>/i)
  const rawBody = bodyMatch ? bodyMatch[1] : html
  
  // Pre-process: Remove edit timestamp sections that can interfere with note parsing
  // Strategy: Remove <font color='#eeeeee'> tags and everything that follows them
  // These tags wrap edit timestamps that shouldn't be part of the content
  const cleanedBody = rawBody.replace(/<font color=['"]#eeeeee['"]>.*?(<\/font>|$)/gis, '')
  
  const text = stripHtml(decodeHTML(cleanedBody))
  const lines = text.split('\n').filter(l => l.length > 0)  // DON'T trim — preserve indentation!

  let description = ''
  let daRequired = false
  let dcRequired = false
  let dmRequired = false
  let isTemp = false
  let isRare = false
  let isSeasonal = false
  let isSpecialOffer = false
  let retired = false
  const obtainMethods: ObtainMethod[] = []
  let currentObtain: Partial<ObtainMethod> | null = null
  let level = '', damage = '', stats = '', resists = ''
  let statsType: 'petStats' | 'bonuses' | undefined = undefined
  const evolutions: { combineWith: string; resultName: string }[] = []
  let rarity = ''
  const attacks: Attack[] = []
  let currentAttack: Partial<Attack> | null = null
  const noteLines: string[] = []
  let inNotes = false
  const alsoSeeNames: string[] = []
  
  // Guest detection: Guests have extensive stats — used as fallback if Chronology doesn't have type
  const hasDetailedStats = /\b(HP|MP|STR|DEX|INT|CHA|LUK|END|WIS):/i.test(text)

  // Detect DA, DC, DM, and category tags from image tags
  if (/<img[^>]+src=["'][^"']*\/tags\/DA\.png["']/i.test(rawBody)) {
    daRequired = true
  }
  if (/<img[^>]+src=["'][^"']*\/tags\/DC\.png["']/i.test(rawBody)) {
    dcRequired = true
  }
  if (/<img[^>]+src=["'][^"']*\/tags\/DM\.png["']/i.test(rawBody)) {
    dmRequired = true
  }
  if (/<img[^>]+src=["'][^"']*\/tags\/Temp\.png["']/i.test(rawBody)) {
    isTemp = true
  }
  if (/<img[^>]+src=["'][^"']*\/tags\/Rare\.jpg["']/i.test(rawBody)) {
    isRare = true
  }
  if (/<img[^>]+src=["'][^"']*\/tags\/Seasonal\.jpg["']/i.test(rawBody)) {
    isSeasonal = true
  }
  if (/<img[^>]+src=["'][^"']*\/tags\/SpecialOffer\.png["']/i.test(rawBody)) {
    isSpecialOffer = true
  }
  if (/<img[^>]+src=["'][^"']*\/tags\/Retired\.png["']/i.test(rawBody)) {
    retired = true
  }

function rephraseTimedSellback(sellback: string): string {
  // Match pattern: "X [currency] before Y, Z [currency] after Y"
  // Examples:
  // "68 Dragon Coins before 24 hours, 19 Dragon Coins after 24 hours"
  // "500 Gold before 24 hours, 125 Gold after 24 hours"
  const timedPattern = /^(\d+)\s+(Dragon Coins?|Gold|Defender'?s? Medals?)\s+before\s+(.+?),\s*(\d+)\s+(Dragon Coins?|Gold|Defender'?s? Medals?)\s+after\s+\3$/i
  const match = sellback.match(timedPattern)
  
  if (match) {
    const [, beforeAmount, beforeCurrency, timeframe, afterAmount] = match
    // Normalize currency names (remove trailing 's' for singular, use standard forms)
    const currency = beforeCurrency.toLowerCase().includes('dragon') ? 'DC' : 
                     beforeCurrency.toLowerCase().includes('gold') ? 'Gold' :
                     beforeCurrency.toLowerCase().includes('medal') ? 'DM' : beforeCurrency
    
    return `${beforeAmount} ${currency} (<${timeframe}) / ${afterAmount} ${currency} (>${timeframe})`
  }
  
  return sellback
}

/**
 * Detect DA/DC/DM tags in the HTML context around a specific text location.
 * Used to check if access requirements apply to a specific obtain method.
 * 
 * IMPORTANT: If text explicitly says "(No DA Required)", respect that over image tags.
 * 
 * @param html - Full HTML to search
 * @param searchText - Text to find (e.g., location name)
 * @param contextSize - How many characters before/after to check (default: 500)
 * @returns Object with daRequired, dcRequired, dmRequired flags
 */
function detectAccessTagsNearText(html: string, searchText: string, contextSize: number = 500): {
  daRequired: boolean
  dcRequired: boolean  
  dmRequired: boolean
} {
  const index = html.indexOf(searchText)
  if (index === -1) {
    return { daRequired: false, dcRequired: false, dmRequired: false }
  }
  
  // Extract context window around the search text
  const start = Math.max(0, index - contextSize)
  const end = Math.min(html.length, index + searchText.length + contextSize)
  const context = html.slice(start, end)
  
  // Check for explicit "(No DA Required)" text - this overrides image tags
  const hasNoDAText = /\(?\s*No\s+DA\s+Required\s*\)?/i.test(context)
  
  return {
    daRequired: hasNoDAText ? false : /<img[^>]+src=["'][^"']*\/tags\/DA\.png["']/i.test(context),
    dcRequired: /<img[^>]+src=["'][^"']*\/tags\/DC\.png["']/i.test(context),
    dmRequired: /<img[^>]+src=["'][^"']*\/tags\/DM\.png["']/i.test(context),
  }
}

const saveObtain = () => {
  if (!currentObtain?.location) return
  const p = currentObtain.price ?? 'N/A'
  const rawSellback = currentObtain.sellback ?? '0 Gold'
  const sellback = rephraseTimedSellback(rawSellback)
  
  // Detect DA/DC/DM in context around this specific location
  const accessFlags = detectAccessTagsNearText(rawBody, currentObtain.location)
  
  obtainMethods.push({
    location: currentObtain.location,
    price: p,
    priceType: parsePriceType(p, currentObtain.requiredItems),
    ...(currentObtain.requiredItems ? { requiredItems: currentObtain.requiredItems } : {}),
    sellback,
    // Store per-method access flags
    ...(accessFlags.daRequired ? { daRequired: accessFlags.daRequired } : {}),
    ...(accessFlags.dcRequired ? { dcRequired: accessFlags.dcRequired } : {}),
    ...(accessFlags.dmRequired ? { dmRequired: accessFlags.dmRequired } : {}),
  })
  currentObtain = null
}

  for (const line of lines) {
    const trimmedLine = line.trim()
    if (trimmedLine === name || trimmedLine === `The ${name}`) continue

    // Skip parenthetical notes like "(No DA)" or "(DA Required)" - already detected from images
    if (/^\(.*\)$/.test(trimmedLine)) continue

    if (/^Location:/i.test(trimmedLine)) { saveObtain(); currentObtain = { location: trimmedLine.replace(/^Location:\s*/i, '').trim() }; continue }
    if (/^Price:/i.test(trimmedLine) && currentObtain) { currentObtain.price = trimmedLine.replace(/^Price:\s*/i, '').trim(); continue }
    if (/^Required Items?:/i.test(trimmedLine) && currentObtain) { currentObtain.requiredItems = trimmedLine.replace(/^Required Items?:\s*/i, '').trim(); continue }
    if (/^Sellback:/i.test(trimmedLine) && currentObtain) { currentObtain.sellback = trimmedLine.replace(/^Sellback:\s*/i, '').trim(); continue }

    if (/^Level:/i.test(trimmedLine)) { level = trimmedLine.replace(/^Level:\s*/i, '').trim(); continue }
    if (/^Damage:/i.test(trimmedLine)) { damage = trimmedLine.replace(/^Damage:\s*/i, '').trim(); continue }
    // Handle bullets or direct Min:/Max: lines
    if (/^•?\s*Min:/i.test(trimmedLine)) { damage += '\n' + trimmedLine.replace(/^•?\s*/, '').trim(); continue }
    if (/^•?\s*Max:/i.test(trimmedLine)) { damage += '\n' + trimmedLine.replace(/^•?\s*/, '').trim(); continue }
    if (/^Pet'?s?\s+Stats?:/i.test(trimmedLine)) { 
      stats = trimmedLine.replace(/^Pet'?s?\s+Stats?:\s*/i, '').trim()
      statsType = 'petStats'
      continue
    }
    if (/^Bonuses?:/i.test(trimmedLine)) { 
      stats = trimmedLine.replace(/^Bonuses?:\s*/i, '').trim()
      statsType = 'bonuses'
      continue
    }
    if (/^Pet'?s?\s+Resists?:/i.test(trimmedLine)) { resists = trimmedLine.replace(/^Pet'?s?\s+Resists?:\s*/i, '').trim(); continue }
    if (/^Element:/i.test(trimmedLine)) continue  // elements come from A-Z listing

    if (/^Combine\s+\d+\s+with/i.test(trimmedLine)) {
      const m = trimmedLine.match(/^Combine\s+\d+\s+with\s+(.+?)\s+to\s+form\s+(.+)$/i)
      if (m) evolutions.push({ combineWith: m[1].trim(), resultName: m[2].trim() })
      continue
    }

    if (/^Rarity:/i.test(trimmedLine)) { rarity = trimmedLine.replace(/^Rarity:\s*/i, '').trim(); continue }

    if (/^Attack\s+Type\s+[\d./]+/i.test(trimmedLine)) {
      // If we're already in notes section, don't treat this as an attack — add to notes instead
      if (inNotes) {
        noteLines.push(trimmedLine)
        continue
      }
      if (currentAttack?.name) attacks.push(currentAttack as Attack)
      const dashIdx = trimmedLine.indexOf(' - ')
      currentAttack = dashIdx > -1
        ? { name: trimmedLine.slice(0, dashIdx).trim(), description: trimmedLine.slice(dashIdx + 3).trim(), images: [], notes: [] }
        : { name: trimmedLine.trim(), description: '', images: [], notes: [] }
      continue
    }

    if (currentAttack && !inNotes && /^[•\-\*]\s+/.test(trimmedLine)) {
      currentAttack.notes = currentAttack.notes ?? []
      
      // Detect indented bullets (sub-items) using ORIGINAL line to preserve spacing
      const indentMatch = line.match(/^(\s*)([•\-\*])\s*(.*)$/)
      
      if (indentMatch) {
        const [, indent, , text] = indentMatch
        const isSubBullet = indent.length >= 2
        
        if (isSubBullet && currentAttack.notes.length > 0) {
          // Sub-bullet: append to previous note with preserved indent
          const lastIdx = currentAttack.notes.length - 1
          currentAttack.notes[lastIdx] += '\n  • ' + text.trim()
        } else {
          // Top-level bullet
          currentAttack.notes.push(text.trim())
        }
      } else {
        // Fallback: just strip bullet marker
        currentAttack.notes.push(trimmedLine.replace(/^[•\-\*]\s+/, ''))
      }
      continue
    }

    if (/^Also\s+See:/i.test(trimmedLine)) {
      alsoSeeNames.push(...trimmedLine.replace(/^Also\s+See:\s*/i, '').split(',').map(n => n.trim()).filter(Boolean))
      continue
    }

    if (/^Other\s+information/i.test(trimmedLine)) {
      // Finalize current attack before switching to notes section
      if (currentAttack?.name) {
        attacks.push(currentAttack as Attack)
        currentAttack = null
      }
      inNotes = true
      continue
    }
    
    // Capture standalone "Note:" lines (outside "Other information" section)
    if (!inNotes && /^Note:/i.test(trimmedLine)) {
      // Add to notes array without the "Note:" prefix
      const noteText = trimmedLine.replace(/^Note:\s*/i, '').trim()
      if (noteText.length > 0) {
        noteLines.push(noteText)
      }
      continue
    }
    
    if (/^Thanks\s+to/i.test(trimmedLine)) {
      // Stop processing — everything from here is attribution
      break
    }

    if (!description && !inNotes && !currentAttack && trimmedLine.length > 5) { description = trimmedLine; continue }
    if (inNotes && trimmedLine.length > 3) {
      // Skip edit timestamps
      if (/\w+\s+--\s+\d+\/\d+\/\d+\s+\d+:\d+:\d+/.test(trimmedLine)) continue
      // Stop at attribution lines: "Name for image/entry/corrections/etc."
      // Attribution format: short name (1-4 words max) followed by " for [contribution type]"
      // Example: "John Smith for image", "Alex for corrections", "Name1, Name2 for stats"
      // BUT: Don't match if the line is part of a note like "Pet's name is erroneously called 'BabyWeaver' instead of..."
      const attributionPattern = /^([A-Z][\w'-]+(?:\s+[A-Z][\w'-]+){0,3}(?:\s*,\s*[A-Z][\w'-]+(?:\s+[A-Z][\w'-]+){0,2})*)\s+for\s+(image|attack|information|images|entry|entries|corrections|formatting|description|original|banner|code|stats|data|location|price)/i
      // Only stop if it's a clean attribution line (not mid-sentence)
      // Check if this line starts with a capital letter AND matches attribution pattern AND is short (< 100 chars)
      if (attributionPattern.test(trimmedLine) && trimmedLine.length < 100 && /^[A-Z]/.test(trimmedLine)) break
      
      // Strip "Note:" prefix if present at the start of a line
      let processedLine = trimmedLine
      if (/^Note:/i.test(processedLine)) {
        processedLine = processedLine.replace(/^Note:\s*/i, '').trim()
      }
      
      // Detect indented bullets (sub-items) — use ORIGINAL line to preserve spacing
      const indentMatch = line.match(/^(\s*)([•\-\*])\s*(.*)$/)
      
      if (indentMatch) {
        const [, indent, , text] = indentMatch
        const isSubBullet = indent.length >= 2
        
        if (isSubBullet && noteLines.length > 0) {
          // Sub-bullet: append to previous line with preserved indent
          noteLines[noteLines.length - 1] += '\n  • ' + text.trim()
        } else {
          // Top-level bullet
          noteLines.push(text.trim())
        }
      } else {
        // Non-bullet line
        // If the previous line doesn't end with punctuation (., !, ?, :) and this line continues text,
        // append to previous line (handle line wrapping in forum posts)
        if (processedLine.length > 0) {
          if (noteLines.length > 0 && 
              !/[.!?:]$/.test(noteLines[noteLines.length - 1]) && 
              /^[a-z'"]/.test(processedLine)) {
            // Continuation of previous line - append with space
            noteLines[noteLines.length - 1] += ' ' + processedLine
          } else {
            // New note line
            noteLines.push(processedLine)
          }
        }
      }
    }
  }

  saveObtain()
  if (currentAttack?.name) attacks.push(currentAttack as Attack)

  // Extract pet images using extractImages helper
  const { main: imageUrl, alternatives: alternativeImages } = extractImages(rawBody)

  return {
    description: description || name,
    daRequired,
    dcRequired,
    dmRequired,
    isTemp,
    isRare,
    isSeasonal,
    isSpecialOffer,
    retired,
    obtainMethods,
    level, damage, stats, statsType, resists,
    evolutions, rarity, attacks,
    notes: noteLines.length > 0 ? noteLines.join('\n') : undefined,
    alsoSeeNames, 
    imageUrl,
    ...(alternativeImages.length > 0 ? { alternativeImages } : {}),
    hasDetailedStats,
  }
}

// ─── Chronology parsing ───────────────────────────────────────────────────────

function parseChronology(html: string): { dates: Map<string, string>; types: Map<string, EntryType> } {
  const dates = new Map<string, string>()
  const types = new Map<string, EntryType>()
  const text = stripHtml(decodeHTML(html))
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  // Format:
  //   "November 10th, 2006"   ← date heading (bold line)
  //   "[P] King Linus (Normal; D-Coins)"
  //   "[G] Ash (1)"
  //   "[P] Battle Piggy"
  //
  // Date headings look like: "Month Nth, YYYY"
  const datePattern = /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d+\w+,?\s+\d{4}$/i
  const entryPattern = /^\[([PG])\]\s+(.+)$/

  let currentDate = ''

  for (const line of lines) {
    if (datePattern.test(line)) {
      currentDate = line
      continue
    }

    const entryMatch = entryPattern.exec(line)
    if (entryMatch && currentDate) {
      const typeMarker = entryMatch[1]  // 'P' or 'G'
      const type: EntryType = typeMarker === 'G' ? 'guest' : 'pet'
      
      // Extract name — strip trailing parenthetical (D-Coins), (Normal; D-Coins), (Seasonal) etc.
      const rawName = entryMatch[2].trim()
      const name = rawName.replace(/\s*\([^)]*\)\s*$/, '').trim()
      if (name.length > 0) {
        const key = name.toLowerCase()
        dates.set(key, currentDate)
        types.set(key, type)
        // Also store with parenthetical in case entry names include them (e.g. "King Linus (Normal)")
        if (rawName !== name) {
          const rawKey = rawName.toLowerCase()
          dates.set(rawKey, currentDate)
          types.set(rawKey, type)
        }
      }
    }
  }

  return { dates, types }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🐾 DragonFable Pets & Guests Scraper (Resumable, Chronology-First)')
  console.log('─'.repeat(50))
  if (startArg) console.log(`▶  Resuming from letter: ${startArg}`)
  if (letterArg) console.log(`▶  Only scraping letter: ${letterArg}`)
  console.log()

  const cookie = loadCookie()
  console.log('✅ Cookie loaded\n')

  // ── Step 1: Fetch Chronology for types and dates ──────────────────────────

  console.log('📅 Fetching Chronology for types and release dates...')
  let chronoDates = new Map<string, string>()
  let chronoTypes = new Map<string, EntryType>()
  try {
    const chronoHtml = await fetchPage(CHRONOLOGY_URL, cookie)
    const parsed = parseChronology(chronoHtml)
    chronoDates = parsed.dates
    chronoTypes = parsed.types
    console.log(`✅ Parsed ${chronoDates.size} chronology entries`)
  } catch (err) {
    console.warn(`⚠️  Chronology fetch error: ${err} — will use content detection fallback`)
  }
  console.log()

  // ── Step 2: Fetch A-Z master page ─────────────────────────────────────────

  console.log('📄 Fetching A-Z Pets & Guests master page...')
  let azHtml = ''
  try {
    azHtml = await fetchPage(AZ_PETS_URL, cookie)
  } catch (err) {
    console.error(`❌ Failed to fetch A-Z page: ${err}`)
    process.exit(1)
  }

  const allStubs = parseAZPage(azHtml, chronoTypes)
  if (allStubs.length === 0) {
    console.error('❌ No pet/guest stubs found. Page size:', azHtml.length)
    const preview = stripHtml(decodeHTML(azHtml)).slice(0, 200)
    console.error('   Page preview:', preview)
    process.exit(1)
  }
  console.log(`✅ Found ${allStubs.length} pets & guests in A-Z listing`)

  // Filter out guests (now handled by scrape-guests.ts)
  const petsOnly = allStubs.filter(s => s.type === 'pet')
  console.log(`   Filtered to pets only: ${petsOnly.length} entries (guests excluded)`)

  // Apply letter filters
  let stubs = petsOnly
  if (lettersArg && lettersArg.length > 0) {
    // Filter by multiple letters: --letters=A,B
    stubs = petsOnly.filter(s => lettersArg.includes(s.letter))
    console.log(`   Filtered to letters ${lettersArg.join(', ')}: ${stubs.length} entries`)
  } else if (letterArg) {
    // Filter by single letter: --letter=A
    stubs = petsOnly.filter(s => s.letter === letterArg)
    console.log(`   Filtered to letter ${letterArg}: ${stubs.length} entries`)
  } else if (startArg) {
    // Resume from letter: --start=C
    let past = false
    stubs = petsOnly.filter(s => {
      if (s.letter === startArg) past = true
      return past
    })
    console.log(`   Resuming from ${startArg}: ${stubs.length} entries remaining`)
  }
  console.log()

  // Build name→slug map for ALL pets (needed for cross-reference resolution)
  const nameToSlug = new Map<string, { slug: string; type: EntryType }>()
  for (const stub of petsOnly) {
    nameToSlug.set(stub.name.toLowerCase(), { slug: stub.slug, type: stub.type })
    // Also index without trailing parentheticals: "Emperor Linus (Normal)" → "emperor linus"
    const base = stub.name.replace(/\s*\([^)]+\)\s*$/, '').trim().toLowerCase()
    if (base !== stub.name.toLowerCase()) nameToSlug.set(base, { slug: stub.slug, type: stub.type })
  }

  // ── Step 3: Load existing progress ────────────────────────────────────────

  const progressMap = new Map<string, Pet | ItemFamily>()
  if (fs.existsSync(PROGRESS_PATH)) {
    try {
      const existing: (Pet | ItemFamily)[] = JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf-8'))
      for (const p of existing) progressMap.set(p.slug, p)
      console.log(`📂 Loaded ${progressMap.size} previously scraped entries from progress file`)
    } catch { /* ignore corrupt progress */ }
  }

  // ── Step 4: Fetch each pet/guest thread ────────────────────────────────────

  let scraped = 0, skipped = 0, fromCache = 0
  const startTime = Date.now()

  for (let i = 0; i < stubs.length; i++) {
    const stub = stubs[i]

    // Skip if already in progress cache
    if (progressMap.has(stub.slug)) {
      process.stdout.write(`[${i + 1}/${stubs.length}] ${stub.name} (cached)\n`)
      fromCache++
      continue
    }

    process.stdout.write(`[${i + 1}/${stubs.length}] ${stub.name}...`)

    try {
      const html = getPostContent(await fetchPrintable(stub.messageId, cookie))

      if (!html) {
        console.log(' ⚠️  deleted — skipping')
        skipped++
        if (i < stubs.length - 1) await sleep(DELAY_MS)
        continue
      }

      // Use multi-variant parser (Sprint 5)
      const result = await parsePetThreadMultiVariant(html, stub.name, stub, cookie, chronoDates, nameToSlug)
      
      // Handle both Pet and ItemFamily types
      if ('levelVariants' in result) {
        // ItemFamily path (multi-variant)
        const family = result as ItemFamily
        progressMap.set(family.slug, family)
        console.log(' ✓ [ItemFamily]')
      } else {
        // Pet path (single-variant, existing logic)
        const pet = result as Pet
        progressMap.set(pet.slug, pet)
        console.log(' ✓')
      }
      
      scraped++

      // Save progress after every entry
      const progress = Array.from(progressMap.values())
      fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2) + '\n', 'utf-8')

      // Progress update every 10 pets
      if ((scraped + skipped) % 10 === 0) {
        const elapsed = Math.round((Date.now() - startTime) / 1000)
        const rate = elapsed > 0 ? (scraped + fromCache) / elapsed : 0
        const remaining = stubs.length - (i + 1)
        const eta = rate > 0 ? Math.round(remaining / rate) : 0
        console.log(`   ⏱️  Progress: ${scraped + fromCache}/${stubs.length} | ${elapsed}s elapsed | ETA ${eta}s`)
      }

    } catch (err) {
      console.log(` ❌ error: ${err} — skipping`)
      skipped++
    }

    if (i < stubs.length - 1) await sleep(DELAY_MS)
  }

  console.log(`\n✅ Scraped: ${scraped}  Cached: ${fromCache}  Skipped: ${skipped}`)

  // ── Step 5: Write final output ─────────────────────────────────────────────

  // Always write ALL pets from progress map (full dataset)
  const finalPets = Array.from(progressMap.values())
    .sort((a, b) => {
      const aName: string = 'familyName' in a ? a.familyName : a.name
      const bName: string = 'familyName' in b ? b.familyName : b.name
      return aName.localeCompare(bName)
    })

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(finalPets, null, 2) + '\n', 'utf-8')

  console.log(`\n📁 Written ${finalPets.length} pets to pets.json (guests excluded)`)
  console.log(`📁 Progress file (${progressMap.size} total) saved to pets-progress.json`)
  console.log('\n🎉 Done!')
  console.log('\n📊 Summary:')
  console.log(`   Total stubs:   ${allStubs.length}`)
  console.log(`   In progress:   ${progressMap.size}`)
  console.log(`   Pets:          ${finalPets.filter(p => p.type === 'pet').length}`)
  console.log(`   With images:   ${finalPets.filter(p => p.imageUrl).length}`)
  console.log(`   With dates:    ${finalPets.filter(p => p.releaseDate !== 'Unknown').length}`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
