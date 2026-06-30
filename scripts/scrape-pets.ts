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
  return html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim()
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

    // Extract anchor text (pet name with bracket codes)
    const anchorText = decodeHTML((chunk.match(/>([^<]+)<\/a>/)?.[1] ?? '').trim())
    if (!anchorText || anchorText.length < 2) continue

    const { elements, markers } = parseBracketCodes(anchorText)
    // Name is the anchor text with brackets stripped
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
  description: string; daRequired: boolean; obtainMethods: ObtainMethod[]
  level: string; damage: string; stats: string; resists: string
  evolutions: { combineWith: string; resultName: string }[]
  rarity: string; attacks: Attack[]; notes?: string
  alsoSeeNames: string[]; imageUrl?: string
} {
  const bodyMatch = html.match(/<td[^>]*valign=["']?top["']?[^>]*width=["']?100%["']?[^>]*>([\s\S]*?)<\/td>/i)
  const rawBody = bodyMatch ? bodyMatch[1] : html
  const text = stripHtml(decodeHTML(rawBody))
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  let description = ''
  let daRequired = false
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
    if (line === name || line === `The ${name}`) continue

    if (/^\(.*\)$/.test(line)) {
      if (/No DA/i.test(line)) daRequired = false
      else if (/DA Required/i.test(line)) daRequired = true
      continue
    }

    if (/^Location:/i.test(line)) { saveObtain(); currentObtain = { location: line.replace(/^Location:\s*/i, '').trim() }; continue }
    if (/^Price:/i.test(line) && currentObtain) { currentObtain.price = line.replace(/^Price:\s*/i, '').trim(); continue }
    if (/^Required Items?:/i.test(line) && currentObtain) { currentObtain.requiredItems = line.replace(/^Required Items?:\s*/i, '').trim(); continue }
    if (/^Sellback:/i.test(line) && currentObtain) { currentObtain.sellback = line.replace(/^Sellback:\s*/i, '').trim(); continue }

    if (/^Level:/i.test(line)) { level = line.replace(/^Level:\s*/i, '').trim(); continue }
    if (/^Damage:/i.test(line)) { damage = line.replace(/^Damage:\s*/i, '').trim(); continue }
    if (/^Pet'?s?\s+Stats?:/i.test(line)) { stats = line.replace(/^Pet'?s?\s+Stats?:\s*/i, '').trim(); continue }
    if (/^Pet'?s?\s+Resists?:/i.test(line)) { resists = line.replace(/^Pet'?s?\s+Resists?:\s*/i, '').trim(); continue }
    if (/^Element:/i.test(line)) continue  // elements come from A-Z listing

    if (/^Combine\s+\d+\s+with/i.test(line)) {
      const m = line.match(/^Combine\s+\d+\s+with\s+(.+?)\s+to\s+form\s+(.+)$/i)
      if (m) evolutions.push({ combineWith: m[1].trim(), resultName: m[2].trim() })
      continue
    }

    if (/^Rarity:/i.test(line)) { rarity = line.replace(/^Rarity:\s*/i, '').trim(); continue }

    if (/^Attack\s+Type\s+[\d./]+/i.test(line)) {
      if (currentAttack?.name) attacks.push(currentAttack as Attack)
      const dashIdx = line.indexOf(' - ')
      currentAttack = dashIdx > -1
        ? { name: line.slice(0, dashIdx).trim(), description: line.slice(dashIdx + 3).trim(), images: [], notes: [] }
        : { name: line.trim(), description: '', images: [], notes: [] }
      continue
    }

    if (currentAttack && /^[•\-\*]\s+/.test(line)) {
      currentAttack.notes = currentAttack.notes ?? []
      currentAttack.notes.push(line.replace(/^[•\-\*]\s+/, ''))
      continue
    }

    if (/^Also\s+See:/i.test(line)) {
      alsoSeeNames.push(...line.replace(/^Also\s+See:\s*/i, '').split(',').map(n => n.trim()).filter(Boolean))
      continue
    }

    if (/^Other\s+information/i.test(line)) { inNotes = true; continue }
    if (/^Thanks\s+to/i.test(line)) continue

    if (!description && !inNotes && !currentAttack && line.length > 5) { description = line; continue }
    if (inNotes && line.length > 3) noteLines.push(line.replace(/^[•\-\*]\s*/, ''))
  }

  saveObtain()
  if (currentAttack?.name) attacks.push(currentAttack as Attack)

  // Extract pet image (skip UI/tag images)
  let imageUrl: string | undefined
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
  let imgMatch: RegExpExecArray | null
  while ((imgMatch = imgRegex.exec(rawBody)) !== null) {
    const src = imgMatch[1]
    if (src.includes('/f/image/') || src.includes('forumheader') || src.includes('quantserve') ||
        src.includes('artix.com/shared') || src.includes('ArtixGameLauncher') ||
        src.includes('/tags/') || src.includes('clear.gif') || src.includes('blank.gif')) continue
    if (src.includes('imgur.com') || src.includes('i.imgur.com') ||
        src.includes('battleon.com/encyc') || src.includes('artix.com/encyc') ||
        (src.includes('/f/upfiles/') && src.length > 60)) {
      imageUrl = src; break
    }
  }

  return {
    description: description || name,
    daRequired,
    obtainMethods,
    level, damage, stats, resists,
    evolutions, rarity, attacks,
    notes: noteLines.length > 0 ? noteLines.join(' • ') : undefined,
    alsoSeeNames, imageUrl,
  }
}

// ─── Chronology parsing ───────────────────────────────────────────────────────

function parseChronology(html: string): Map<string, string> {
  const dates = new Map<string, string>()
  const text = stripHtml(decodeHTML(html))
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const datePattern = /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d+\w*,?\s+\d{4}/i

  for (const line of lines) {
    const sep = line.includes(' - ') ? ' - ' : line.includes(': ') ? ': ' : null
    if (!sep) continue
    const idx = line.indexOf(sep)
    const left = line.slice(0, idx).trim()
    const right = line.slice(idx + sep.length).trim()

    if (datePattern.test(left)) {
      right.split(',').forEach(n => { const name = n.trim(); if (name.length > 1) dates.set(name.toLowerCase(), left) })
    } else if (datePattern.test(right)) {
      left.split(',').forEach(n => { const name = n.trim(); if (name.length > 1) dates.set(name.toLowerCase(), right) })
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
        elements: stub.elements,
        specialMarkers: stub.markers,
        level: data.level || 'Unknown',
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
        tags: [stub.type, ...stub.elements.map(e => e.toLowerCase()), ...stub.markers.map(m => m.toLowerCase().replace('/', '-'))],
      }

      progressMap.set(stub.slug, pet)
      scraped++
      console.log(' ✓')

      // Save progress after every entry
      const progress = Array.from(progressMap.values())
      fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2) + '\n', 'utf-8')

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

  // Only write pets that are in our current stub set (or full set if no filter)
  const targetSlugs = new Set(letterArg || startArg ? stubs.map(s => s.slug) : allStubs.map(s => s.slug))
  const finalPets = Array.from(progressMap.values())
    .filter(p => !letterArg && !startArg ? true : targetSlugs.has(p.slug))
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
