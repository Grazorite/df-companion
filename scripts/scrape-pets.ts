/**
 * Pet Scraper — A-Z Master Page Strategy (Two-Pass, Resumable)
 *
 * The A-Z Pets page (m=22349620, mpage=1) contains all pet entries grouped
 * by letter, each hyperlinked to its individual forum thread.
 *
 * Entry format: [ICE][SHR] Pet Name (D-Amulet/Seasonal)
 *
 * USAGE:
 *   npm run scrape:pets              # Scrape all pets
 *   npm run scrape:pets -- --start=C # Resume from letter C onwards
 *   npm run scrape:pets -- --letter=B # Scrape only letter B
 *
 * Progress is saved to pets-progress.json after each entry,
 * so a timeout or crash won't lose work. Final output is pets.json.
 *
 * Cookie: Add FORUM_COOKIE="..." to .env
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { Pet, ObtainMethod, Attack, Evolution, AlsoSeeRef, EntryType } from '../src/types/pet.ts'

const FORUM_BASE = 'https://forums2.battleon.com/f'
const AZ_PETS_URL = `${FORUM_BASE}/tm.asp?m=22349620&mpage=1`
const CHRONOLOGY_URL = `${FORUM_BASE}/tm.asp?m=10738071`
const DELAY_MS = 1000
const OUTPUT_PATH = path.resolve(import.meta.dirname, '../src/data/pets.json')
const PROGRESS_PATH = path.resolve(import.meta.dirname, '../src/data/pets-progress.json')

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const startArg = args.find(a => a.startsWith('--start='))?.split('=')[1]?.toUpperCase()
const letterArg = args.find(a => a.startsWith('--letter='))?.split('=')[1]?.toUpperCase()

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
}

function stripHtml(html: string): string {
  // Handle forum's malformed HTML:
  // - Top-level <li> without <ul>
  // - Nested <ul><li>...<li></ul> for sub-items
  
  let depth = 0
  let processed = ''
  let i = 0
  const maxIterations = html.length * 2  // Safety limit
  let iterations = 0
  
  while (i < html.length && iterations < maxIterations) {
    iterations++
    
    // Check for <ul> or <ol> opening
    if (html.substr(i, 3) === '<ul' || html.substr(i, 3) === '<ol') {
      depth++
      const closeTag = html.indexOf('>', i)
      i = closeTag >= 0 ? closeTag + 1 : i + 3
      processed += '\n'
    }
    // Check for </ul> or </ol> closing
    else if (html.substr(i, 4) === '</ul' || html.substr(i, 4) === '</ol') {
      depth = Math.max(0, depth - 1)
      const closeTag = html.indexOf('>', i)
      i = closeTag >= 0 ? closeTag + 1 : i + 4
      processed += '\n'
    }
    // Check for <li>
    else if (html.substr(i, 3) === '<li') {
      const closeTag = html.indexOf('>', i)
      const indent = '  '.repeat(Math.max(0, depth))
      processed += `\n${indent}• `
      i = closeTag >= 0 ? closeTag + 1 : i + 3
    }
    // Check for </li>
    else if (html.substr(i, 4) === '</li') {
      const closeTag = html.indexOf('>', i)
      i = closeTag >= 0 ? closeTag + 1 : i + 4
      processed += '\n'
    }
    // Regular character
    else {
      processed += html[i]
      i++
    }
  }
  
  if (iterations >= maxIterations) {
    console.warn('⚠️  stripHtml reached iteration limit — possible infinite loop avoided')
  }
  
  // Clean up remaining HTML and whitespace
  return processed
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
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

function parseAZPage(html: string): PetStub[] {
  const stubs: PetStub[] = []
  const seen = new Set<string>()
  const chunks = html.split(/<br\s*\/?>/)
  let currentLetter = '#'

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
    if (seen.has(msgId)) continue
    seen.add(msgId)

    // Elements/markers appear BEFORE the <a> tag in the line
    // e.g: [BAC][DAR][WIN] <a href="...">Pet Name</a>
    const { elements, markers } = parseBracketCodes(chunk)

    // Extract anchor text (pet name — may also contain brackets if inside the <a>)
    const anchorText = decodeHTML((chunk.match(/<a[^>]+>([^<]+)<\/a>/i)?.[1] ?? '').trim())
    if (!anchorText || anchorText.length < 2) continue

    // Name is anchor text with any remaining bracket codes stripped
    const name = anchorText.replace(/\[[A-Z?/]+\]/g, '').trim()
    if (!name) continue

    stubs.push({
      name,
      slug: prefixedSlug(name, 'pet'),
      type: 'pet',
      forumUrl: `${FORUM_BASE}/tm.asp?m=${msgId}`,
      messageId: msgId,
      elements,
      markers,
      letter: currentLetter,
    })
  }

  return stubs
}

// ─── Individual pet thread parsing ───────────────────────────────────────────

function parsePriceType(price: string): ObtainMethod['priceType'] {
  const p = price.toLowerCase()
  if (p.includes('dragon coin') || p.includes(' dc') || p === '0 dc') return 'dc'
  if (p === 'n/a' || p === '0 gold' || p === '0' || p === 'free') return 'free'
  if (p.includes('gold')) return 'gold'
  return 'merge'
}

function parsePetThread(html: string, name: string): {
  description: string; daRequired: boolean; dcRequired: boolean; obtainMethods: ObtainMethod[]
  level: string; damage: string; stats: string; resists: string
  evolutions: { combineWith: string; resultName: string }[]
  rarity: string; attacks: Attack[]; notes?: string
  alsoSeeNames: string[]; imageUrl?: string
} {
  const bodyMatch = html.match(/<td[^>]*valign=["']?top["']?[^>]*width=["']?100%["']?[^>]*>([\s\S]*?)<\/td>/i)
  const rawBody = bodyMatch ? bodyMatch[1] : html
  const text = stripHtml(decodeHTML(rawBody))
  const lines = text.split('\n').filter(l => l.length > 0)  // DON'T trim — preserve indentation!

  let description = ''
  let daRequired = false
  let dcRequired = false  // detect from DC.png presence
  const obtainMethods: ObtainMethod[] = []
  let currentObtain: Partial<ObtainMethod> | null = null
  let level = '', damage = '', stats = '', resists = ''
  const evolutions: { combineWith: string; resultName: string }[] = []
  let rarity = ''
  const attacks: Attack[] = []
  let currentAttack: Partial<Attack> | null = null
  const noteLines: string[] = []
  let inNotes = false
  const alsoSeeNames: string[] = []

  // Detect DA and DC requirements from image tags
  if (/<img[^>]+src=["'][^"']*\/tags\/DC\.png["']/i.test(rawBody)) {
    dcRequired = true
  }
  if (/<img[^>]+src=["'][^"']*\/tags\/DA\.png["']/i.test(rawBody)) {
    daRequired = true
  }

  const saveObtain = () => {
    if (!currentObtain?.location) return
    const p = currentObtain.price ?? 'N/A'
    obtainMethods.push({
      location: currentObtain.location,
      price: p,
      priceType: parsePriceType(p),
      ...(currentObtain.requiredItems ? { requiredItems: currentObtain.requiredItems } : {}),
      sellback: currentObtain.sellback ?? '0 Gold',
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
    if (/^Min:/i.test(trimmedLine)) { damage += '\n' + trimmedLine.trim(); continue }
    if (/^Max:/i.test(trimmedLine)) { damage += '\n' + trimmedLine.trim(); continue }
    if (/^Pet'?s?\s+Stats?:/i.test(trimmedLine)) { stats = trimmedLine.replace(/^Pet'?s?\s+Stats?:\s*/i, '').trim(); continue }
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
    if (/^Thanks\s+to/i.test(trimmedLine)) break  // stop processing — everything from here is attribution

    if (!description && !inNotes && !currentAttack && trimmedLine.length > 5) { description = trimmedLine; continue }
    if (inNotes && trimmedLine.length > 3) {
      // Skip edit timestamps
      if (/\w+\s+--\s+\d+\/\d+\/\d+\s+\d+:\d+:\d+/.test(trimmedLine)) continue
      // Stop at attribution lines: "Name for image/entry/corrections/etc."
      if (/^[\w\s,]+\s+for\s+(image|attack|information|entry|corrections|formatting|description)/i.test(trimmedLine)) break
      
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
        // Non-bullet line — treat as separate top-level note
        noteLines.push(trimmedLine.trim())
      }
    }
  }

  saveObtain()
  if (currentAttack?.name) attacks.push(currentAttack as Attack)

  // Extract pet image — prioritize images with pet name in URL
  let imageUrl: string | undefined
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
  let imgMatch: RegExpExecArray | null
  const candidates: string[] = []
  
  while ((imgMatch = imgRegex.exec(rawBody)) !== null) {
    const src = imgMatch[1]
    // Skip UI/tag/button/attack images
    if (src.includes('/f/image/') || src.includes('forumheader') || src.includes('quantserve') ||
        src.includes('artix.com/shared') || src.includes('ArtixGameLauncher') ||
        src.includes('/tags/') || src.includes('clear.gif') || src.includes('blank.gif') ||
        src.includes('Button') || src.includes('-Button') || src.includes('button') ||
        src.includes('Attack.png') || src.includes('attack.png')) continue
    
    // Collect valid candidates
    if (src.includes('imgur.com') || src.includes('i.imgur.com') ||
        src.includes('battleon.com/encyc') || src.includes('artix.com/encyc') ||
        src.includes('github.com') || src.includes('githubusercontent.com') ||
        (src.includes('/f/upfiles/') && src.length > 60)) {
      candidates.push(src)
    }
  }
  
  // Prioritize: images with pet name in URL (case-insensitive, match slug-like patterns)
  const nameParts = name.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/)
  const nameMatches = candidates.filter(url => {
    const urlLower = url.toLowerCase()
    
    // Extract filename from URL (last path segment before extension)
    const filename = urlLower.split('/').pop()?.replace(/\.(png|jpg|jpeg|gif)$/, '') || ''
    
    // Exact match or very close match (filename contains name without extra suffixes)
    const nameSlug = nameParts.join('').toLowerCase()
    if (filename === nameSlug || filename === nameSlug + '1' || filename === nameSlug + 's') return true
    
    // Match if URL contains most of the name words (at least 50% for multi-word names)
    const matchCount = nameParts.filter(part => part.length > 2 && urlLower.includes(part)).length
    return matchCount >= Math.ceil(nameParts.length / 2)
  })
  
  if (nameMatches.length > 0) {
    // Prefer DF-Pedia GitHub images, and prefer shorter filenames (less likely to be attack/button variants)
    const githubMatches = nameMatches.filter(url => url.includes('github.com') || url.includes('githubusercontent.com'))
    if (githubMatches.length > 0) {
      // Sort by URL length (shorter = simpler filename = more likely to be the main image)
      githubMatches.sort((a, b) => a.length - b.length)
      imageUrl = githubMatches[0]
    } else {
      imageUrl = nameMatches[0]
    }
  } else if (candidates.length > 0) {
    // Fallback to first valid candidate (also sort by length)
    candidates.sort((a, b) => a.length - b.length)
    imageUrl = candidates[0]
  } else {
    // Last resort: construct DF-Pedia URL from name
    const filename = name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '') + '.png'
    imageUrl = `https://github.com/DF-Pedia/DF-Pedia/raw/master/pets_guests/${filename}`
  }

  return {
    description: description || name,
    daRequired,
    dcRequired,
    obtainMethods,
    level, damage, stats, resists,
    evolutions, rarity, attacks,
    notes: noteLines.length > 0 ? noteLines.join('\n') : undefined,
    alsoSeeNames, imageUrl,
  }
}

// ─── Chronology parsing ───────────────────────────────────────────────────────

function parseChronology(html: string): Map<string, string> {
  const dates = new Map<string, string>()
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
      // Extract name — strip trailing parenthetical (D-Coins), (Normal; D-Coins), (Seasonal) etc.
      const rawName = entryMatch[2].trim()
      const name = rawName.replace(/\s*\([^)]*\)\s*$/, '').trim()
      if (name.length > 0) {
        dates.set(name.toLowerCase(), currentDate)
        // Also store with parenthetical in case entry names include them (e.g. "King Linus (Normal)")
        if (rawName !== name) dates.set(rawName.toLowerCase(), currentDate)
      }
    }
  }

  return dates
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🐾 DragonFable Pet Scraper (Resumable, Two-Pass)')
  console.log('─'.repeat(50))
  if (startArg) console.log(`▶  Resuming from letter: ${startArg}`)
  if (letterArg) console.log(`▶  Only scraping letter: ${letterArg}`)
  console.log()

  const cookie = loadCookie()
  console.log('✅ Cookie loaded\n')

  // ── Step 1: Fetch A-Z master page ─────────────────────────────────────────

  console.log('📄 Fetching A-Z Pets master page...')
  let azHtml = ''
  try {
    azHtml = await fetchPage(AZ_PETS_URL, cookie)
  } catch (err) {
    console.error(`❌ Failed to fetch A-Z page: ${err}`)
    process.exit(1)
  }

  const allStubs = parseAZPage(azHtml)
  if (allStubs.length === 0) {
    console.error('❌ No pet stubs found. Page size:', azHtml.length)
    const preview = stripHtml(decodeHTML(azHtml)).slice(0, 200)
    console.error('   Page preview:', preview)
    process.exit(1)
  }
  console.log(`✅ Found ${allStubs.length} pets in A-Z listing`)

  // Apply letter filters
  let stubs = allStubs
  if (letterArg) {
    stubs = allStubs.filter(s => s.letter === letterArg)
    console.log(`   Filtered to letter ${letterArg}: ${stubs.length} pets`)
  } else if (startArg) {
    let past = false
    stubs = allStubs.filter(s => {
      if (s.letter === startArg) past = true
      return past
    })
    console.log(`   Resuming from ${startArg}: ${stubs.length} pets remaining`)
  }
  console.log()

  // Build name→slug map for ALL pets (needed for cross-reference resolution)
  const nameToSlug = new Map<string, { slug: string; type: EntryType }>()
  for (const stub of allStubs) {
    nameToSlug.set(stub.name.toLowerCase(), { slug: stub.slug, type: stub.type })
    // Also index without trailing parentheticals: "Emperor Linus (Normal)" → "emperor linus"
    const base = stub.name.replace(/\s*\([^)]+\)\s*$/, '').trim().toLowerCase()
    if (base !== stub.name.toLowerCase()) nameToSlug.set(base, { slug: stub.slug, type: stub.type })
  }

  // ── Step 2: Load existing progress ────────────────────────────────────────

  const progressMap = new Map<string, Pet>()
  if (fs.existsSync(PROGRESS_PATH)) {
    try {
      const existing: Pet[] = JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf-8'))
      for (const p of existing) progressMap.set(p.slug, p)
      console.log(`📂 Loaded ${progressMap.size} previously scraped entries from progress file`)
    } catch { /* ignore corrupt progress */ }
  }

  // ── Step 3: Fetch each pet thread ─────────────────────────────────────────

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
      const html = await fetchPage(stub.forumUrl, cookie)

      if (html.includes('This message has been deleted or moved')) {
        console.log(' ⚠️  deleted — skipping')
        skipped++
        if (i < stubs.length - 1) await sleep(DELAY_MS)
        continue
      }

      const data = parsePetThread(html, stub.name)

      // Resolve Also See (best effort — may be partially unresolved)
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

      const pet: Pet = {
        id: stub.slug,
        name: stub.name,
        slug: stub.slug,
        type: stub.type,
        description: data.description,
        daRequired: data.daRequired,
        ...(data.dcRequired ? { dcRequired: data.dcRequired } : {}),
        elements: stub.elements,
        traits: stub.markers,        level: data.level || 'Unknown',
        damage: data.damage || 'Unknown',
        stats: data.stats || 'None',
        resists: data.resists || 'None',
        obtainMethods: data.obtainMethods,
        attacks: data.attacks,
        rarity: data.rarity || 'Unknown',
        evolutions,
        releaseDate: 'Unknown',  // filled in Step 4
        ...(data.imageUrl ? { imageUrl: data.imageUrl } : {}),
        forumUrl: stub.forumUrl,
        ...(data.notes ? { notes: data.notes } : {}),
        alsoSee,
        tags: [stub.type, ...stub.elements.map(e => e.toLowerCase()), ...stub.markers.map(m => m.toLowerCase().replace('/', '-'))]      }

      progressMap.set(stub.slug, pet)
      scraped++
      console.log(' ✓')

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

  // ── Step 4: Fetch Chronology and add release dates ─────────────────────────

  console.log('\n📅 Fetching Chronology for release dates...')
  await sleep(DELAY_MS)
  try {
    const chronoHtml = await fetchPage(CHRONOLOGY_URL, cookie)
    const dates = parseChronology(chronoHtml)
    console.log(`✅ Parsed ${dates.size} release date entries`)

    for (const pet of progressMap.values()) {
      const date = dates.get(pet.name.toLowerCase()) ?? dates.get(pet.name)
      if (date) pet.releaseDate = date
    }
  } catch (err) {
    console.warn(`⚠️  Chronology fetch error: ${err} — release dates left as Unknown`)
  }

  // ── Step 5: Write final output ─────────────────────────────────────────────

  // Always write ALL pets from progress map (full dataset)
  const finalPets = Array.from(progressMap.values())
    .sort((a, b) => a.name.localeCompare(b.name))

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(finalPets, null, 2) + '\n', 'utf-8')

  console.log(`\n📁 Written ${finalPets.length} pets to pets.json`)
  console.log(`📁 Progress file (${progressMap.size} total) saved to pets-progress.json`)
  console.log('\n🎉 Done!')
  console.log('\n📊 Summary:')
  console.log(`   Total stubs:   ${allStubs.length}`)
  console.log(`   In progress:   ${progressMap.size}`)
  console.log(`   With images:   ${finalPets.filter(p => p.imageUrl).length}`)
  console.log(`   With dates:    ${finalPets.filter(p => p.releaseDate !== 'Unknown').length}`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
