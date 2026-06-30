/**
 * Pet Scraper — A-Z Pets Strategy (Two-Pass)
 *
 * Pass 1: Fetch A-Z Pets listing, then each individual pet thread.
 *         Builds raw data with element codes, stats, obtain methods, attacks, etc.
 *         Evolutions and Also See are stored as raw text/names (unresolved).
 *
 * Pass 2: Resolve cross-references.
 *         Maps evolution result names → type-prefixed slugs.
 *         Maps Also See names → { name, slug, type } objects.
 *         Fetches Chronology page for release dates.
 *
 * USAGE:
 * 1. Get your session cookie from DevTools → Network → Headers → Cookie
 * 2. Add to .env: FORUM_COOKIE="your_cookie_string"
 * 3. Run: npm run scrape:pets
 *
 * Data sources:
 *   A-Z Pets:    https://forums2.battleon.com/f/tm.asp?m=22349621
 *   Chronology:  https://forums2.battleon.com/f/tm.asp?m=10738071
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { Pet, ObtainMethod, Attack, Evolution, AlsoSeeRef, EntryType } from '../src/types/pet.ts'

const FORUM_BASE = 'https://forums2.battleon.com/f'
const AZ_PETS_URL = `${FORUM_BASE}/tm.asp?m=22349621`
const CHRONOLOGY_URL = `${FORUM_BASE}/tm.asp?m=10738071`
const DELAY_MS = 800
const OUTPUT_PATH = path.resolve(import.meta.dirname, '../src/data/pets.json')

// ─── Helpers (shared with badge scraper) ─────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchPage(url: string, cookie: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      Cookie: cookie,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`)
  return res.text()
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

function prefixedSlug(name: string, type: EntryType): string {
  return `${type}-${slugify(name)}`
}

function decodeHTML(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&nbsp;/g, ' ')
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function loadCookie(): string {
  const envPath = path.resolve(import.meta.dirname, '../.env')
  if (!fs.existsSync(envPath)) {
    console.error('❌ Missing .env file. Add FORUM_COOKIE="..." to it.')
    process.exit(1)
  }
  const content = fs.readFileSync(envPath, 'utf-8')
  const match = content.match(/FORUM_COOKIE=["'](.+?)["']\s*$/)
  if (!match) {
    console.error('❌ FORUM_COOKIE not found in .env')
    process.exit(1)
  }
  return match[1]
}

// ─── Bracket code parser ─────────────────────────────────────────────────────
// Handles: [ICE], [FIR], [N/A], [W/S], mixed [ICE][SHR], [???]
// Returns { elements, markers, name }

const KNOWN_MARKERS = new Set(['A/C', 'ALA', 'N/A', 'SHR', 'W/S'])

function parseBracketLine(raw: string): { elements: string[]; markers: string[]; name: string } {
  const elements: string[] = []
  const markers: string[] = []

  // Extract all [CODE] groups — code can be letters, digits, / or ?
  const bracketRegex = /\[([A-Z?/]+)\]/g
  let match: RegExpExecArray | null
  let lastIndex = 0

  while ((match = bracketRegex.exec(raw)) !== null) {
    const code = match[1]
    if (KNOWN_MARKERS.has(code)) {
      markers.push(code)
    } else {
      elements.push(code)
    }
    lastIndex = match.index + match[0].length
  }

  const name = raw.slice(lastIndex).trim()
  return { elements, markers, name }
}

// ─── A-Z page parsing ────────────────────────────────────────────────────────

interface PetStub {
  name: string
  slug: string
  type: EntryType
  forumUrl: string
  messageId: string
  elements: string[]
  markers: string[]
}

function parseAZPage(html: string, type: EntryType): PetStub[] {
  const stubs: PetStub[] = []
  const seen = new Set<string>()

  const chunks = html.split(/<br\s*\/?>/)

  for (const chunk of chunks) {
    const linkMatch = /href="https?:\/\/forums2\.battleon\.com\/f\/tm\.asp\?m=(\d+)"[^>]*>\s*([^<]+?)\s*<\/a>/i.exec(chunk)
    if (!linkMatch) continue

    const msgId = linkMatch[1]
    const rawText = decodeHTML(linkMatch[2].trim())
    if (!rawText || rawText.length < 2) continue

    if (seen.has(msgId)) continue
    seen.add(msgId)

    const { elements, markers, name } = parseBracketLine(rawText)
    if (!name) continue

    stubs.push({
      name,
      slug: prefixedSlug(name, type),
      type,
      forumUrl: `${FORUM_BASE}/tm.asp?m=${msgId}`,
      messageId: msgId,
      elements,
      markers,
    })
  }

  return stubs
}

// ─── Individual pet thread parsing ───────────────────────────────────────────

interface RawPetData {
  description: string
  daRequired: boolean
  obtainMethods: ObtainMethod[]
  level: string
  damage: string
  stats: string
  resists: string
  evolutions: { combineWith: string; resultName: string }[]  // raw, resolved in pass 2
  rarity: string
  attacks: Attack[]
  notes?: string
  alsoSeeNames: string[]  // raw names, resolved to AlsoSeeRef in pass 2
  imageUrl?: string
}

function parsePriceType(price: string): ObtainMethod['priceType'] {
  const p = price.toLowerCase()
  if (p.includes('dragon coin') || p.includes(' dc') || p === '0 dc') return 'dc'
  if (p === 'n/a' || p === '0 gold' || p === '0') return 'free'
  if (p.includes('gold')) return 'gold'
  if (p.includes('required items') || p.includes('combine')) return 'merge'
  return 'free'
}

function parsePetThread(html: string, name: string): RawPetData {
  const bodyMatch = html.match(/<td[^>]*valign=["']?top["']?[^>]*width=["']?100%["']?[^>]*>([\s\S]*?)<\/td>/i)
  const rawBody = bodyMatch ? bodyMatch[1] : html
  const text = stripHtml(decodeHTML(rawBody))
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  let description = ''
  let daRequired = false
  const obtainMethods: ObtainMethod[] = []
  let currentObtain: Partial<ObtainMethod> | null = null
  let level = ''
  let damage = ''
  let element = ''
  let stats = ''
  let resists = ''
  const evolutions: { combineWith: string; resultName: string }[] = []
  let rarity = ''
  const attacks: Attack[] = []
  let currentAttack: Partial<Attack> | null = null
  const noteLines: string[] = []
  let inNotes = false
  const alsoSeeNames: string[] = []
  let imageUrl: string | undefined

  for (const line of lines) {
    // Skip name line
    if (line === name || line === `The ${name}`) continue

    // DA status
    if (/^\(.*\)$/.test(line)) {
      if (/No DA/i.test(line)) daRequired = false
      else if (/DA Required/i.test(line)) daRequired = true
      continue
    }

    // Obtain method fields — detect new block when Location: appears
    if (/^Location:/i.test(line)) {
      if (currentObtain?.location) {
        // save previous block
        const p = currentObtain.price ?? 'N/A'
        obtainMethods.push({
          location: currentObtain.location,
          price: p,
          priceType: parsePriceType(p),
          requiredItems: currentObtain.requiredItems,
          sellback: currentObtain.sellback ?? '0 Gold',
        })
      }
      currentObtain = { location: line.replace(/^Location:\s*/i, '').trim() }
      continue
    }
    if (/^Price:/i.test(line) && currentObtain) {
      currentObtain.price = line.replace(/^Price:\s*/i, '').trim()
      continue
    }
    if (/^Required Items?:/i.test(line) && currentObtain) {
      currentObtain.requiredItems = line.replace(/^Required Items?:\s*/i, '').trim()
      continue
    }
    if (/^Sellback:/i.test(line) && currentObtain) {
      currentObtain.sellback = line.replace(/^Sellback:\s*/i, '').trim()
      continue
    }

    // Stats
    if (/^Level:/i.test(line)) { level = line.replace(/^Level:\s*/i, '').trim(); continue }
    if (/^Damage:/i.test(line)) { damage = line.replace(/^Damage:\s*/i, '').trim(); continue }
    if (/^Element:/i.test(line)) { element = line.replace(/^Element:\s*/i, '').trim(); continue }
    if (/^Pet'?s?\s+Stats?:/i.test(line)) { stats = line.replace(/^Pet'?s?\s+Stats?:\s*/i, '').trim(); continue }
    if (/^Pet'?s?\s+Resists?:/i.test(line)) { resists = line.replace(/^Pet'?s?\s+Resists?:\s*/i, '').trim(); continue }

    // Evolutions: "Combine 1 with X to form Y"
    if (/^Combine\s+\d+\s+with/i.test(line)) {
      const m = line.match(/^Combine\s+\d+\s+with\s+(.+?)\s+to\s+form\s+(.+)$/i)
      if (m) evolutions.push({ combineWith: m[1].trim(), resultName: m[2].trim() })
      continue
    }

    // Rarity
    if (/^Rarity:/i.test(line)) { rarity = line.replace(/^Rarity:\s*/i, '').trim(); continue }

    // Attacks: "Attack Type 1 - description" or "Attack Type 2 / 2.1 - description"
    if (/^Attack\s+Type\s+[\d./]+/i.test(line)) {
      if (currentAttack?.name) attacks.push(currentAttack as Attack)
      const dashIdx = line.indexOf(' - ')
      if (dashIdx > -1) {
        currentAttack = {
          name: line.slice(0, dashIdx).trim(),
          description: line.slice(dashIdx + 3).trim(),
          images: [],
          notes: [],
        }
      } else {
        currentAttack = { name: line.trim(), description: '', images: [], notes: [] }
      }
      continue
    }

    // Attack sub-notes (indented bullets)
    if (currentAttack && /^[•\-\*]\s+/.test(line)) {
      currentAttack.notes = currentAttack.notes ?? []
      currentAttack.notes.push(line.replace(/^[•\-\*]\s+/, '').trim())
      continue
    }

    // Also See
    if (/^Also\s+See:/i.test(line)) {
      const names = line.replace(/^Also\s+See:\s*/i, '').split(',').map(n => n.trim()).filter(Boolean)
      alsoSeeNames.push(...names)
      continue
    }

    // Other information
    if (/^Other\s+information/i.test(line)) { inNotes = true; continue }
    if (/^Thanks\s+to/i.test(line)) continue

    // First non-metadata line = description
    if (!description && !inNotes && line.length > 5 && !currentAttack) {
      description = line
      continue
    }

    if (inNotes && line.length > 3) {
      noteLines.push(line.replace(/^[•\-\*]\s*/, ''))
    }
  }

  // Save last obtain block and attack
  if (currentObtain?.location) {
    const p = currentObtain.price ?? 'N/A'
    obtainMethods.push({
      location: currentObtain.location,
      price: p,
      priceType: parsePriceType(p),
      requiredItems: currentObtain.requiredItems,
      sellback: currentObtain.sellback ?? '0 Gold',
    })
  }
  if (currentAttack?.name) attacks.push(currentAttack as Attack)

  // Extract images from raw HTML (skip forum UI, grab pet/attack images)
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
  let imgMatch: RegExpExecArray | null
  const allImages: string[] = []
  while ((imgMatch = imgRegex.exec(rawBody)) !== null) {
    const src = imgMatch[1]
    if (
      src.includes('/f/image/') || src.includes('forumheader') ||
      src.includes('quantserve') || src.includes('artix.com/shared') ||
      src.includes('ArtixGameLauncher') || src.includes('tags/DA') ||
      src.includes('tags/DC') || src.includes('tags/Seasonal') ||
      src.includes('tags/Retired')
    ) continue
    if (
      src.includes('imgur.com') || src.includes('i.imgur.com') ||
      src.includes('battleon.com/encyc') || src.includes('artix.com/encyc') ||
      (src.includes('/f/upfiles/') && src.length > 60)
    ) {
      allImages.push(src)
    }
  }

  // First image = pet image; remaining may be attack images
  if (allImages.length > 0) imageUrl = allImages[0]

  // Assign remaining images to attacks if any
  if (allImages.length > 1 && attacks.length > 0) {
    // Distribute extra images across attacks (best effort)
    const attackImages = allImages.slice(1)
    attackImages.forEach((img, idx) => {
      if (idx < attacks.length) {
        attacks[idx].images = [...(attacks[idx].images ?? []), img]
      }
    })
  }

  // If element was found in stats block but not in A-Z brackets, note it for reconciliation
  void element  // used below via return

  return {
    description: description || `${name}`,
    daRequired,
    obtainMethods,
    level,
    damage,
    stats,
    resists,
    evolutions,
    rarity,
    attacks,
    notes: noteLines.length > 0 ? noteLines.join(' • ') : undefined,
    alsoSeeNames,
    imageUrl,
  }
}

// ─── Chronology page parsing ─────────────────────────────────────────────────

function parseChronology(html: string): Map<string, string> {
  const dates = new Map<string, string>()
  const text = stripHtml(decodeHTML(html))
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  // Format: "September 15th, 2017 - Pet Name" or "September 15th, 2017: Pet Name"
  // Or lines like: "Pet Name - September 15th, 2017"
  const datePattern = /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d+\w*,?\s+\d{4}/i

  for (const line of lines) {
    const dashIdx = Math.max(line.indexOf(' - '), line.indexOf(': '))
    if (dashIdx < 0) continue

    const left = line.slice(0, dashIdx).trim()
    const right = line.slice(dashIdx + 2).trim()

    if (datePattern.test(left)) {
      // "Date - Pet Name"
      right.split(',').forEach(n => {
        const name = n.trim()
        if (name.length > 1) dates.set(name.toLowerCase(), left)
      })
    } else if (datePattern.test(right)) {
      // "Pet Name - Date"
      left.split(',').forEach(n => {
        const name = n.trim()
        if (name.length > 1) dates.set(name.toLowerCase(), right)
      })
    }
  }

  return dates
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🐾 DragonFable Pet Scraper (Two-Pass)')
  console.log('─'.repeat(50))

  const cookie = loadCookie()
  console.log('✅ Cookie loaded\n')

  // ── PASS 1: Collect all stubs from A-Z Pets listing ──────────────────────

  console.log('📄 Fetching A-Z Pets listing...')
  const azHtml = await fetchPage(AZ_PETS_URL, cookie)
  const stubs = parseAZPage(azHtml, 'pet')
  console.log(`✅ Found ${stubs.length} pet stubs\n`)

  if (stubs.length === 0) {
    console.error('❌ No pets found — cookie may have expired.')
    process.exit(1)
  }

  // Build name → slug map for cross-reference resolution
  const nameToSlug = new Map<string, { slug: string; type: EntryType }>()
  for (const stub of stubs) {
    nameToSlug.set(stub.name.toLowerCase(), { slug: stub.slug, type: stub.type })
    // Also map without parenthetical variants: "Emperor Linus (Normal)" → base name
    const baseName = stub.name.replace(/\s*\(.*?\)\s*$/, '').trim().toLowerCase()
    if (baseName !== stub.name.toLowerCase()) {
      nameToSlug.set(baseName, { slug: stub.slug, type: stub.type })
    }
  }

  // ── Fetch individual threads ─────────────────────────────────────────────

  const rawData = new Map<string, RawPetData>()
  let enriched = 0
  let skipped = 0

  for (let i = 0; i < stubs.length; i++) {
    const stub = stubs[i]
    process.stdout.write(`[${i + 1}/${stubs.length}] ${stub.name}...`)

    try {
      const html = await fetchPage(stub.forumUrl, cookie)

      if (html.includes('This message has been deleted or moved')) {
        console.log(' ⚠️  deleted/inaccessible — skipping')
        skipped++
        if (i < stubs.length - 1) await sleep(DELAY_MS)
        continue
      }

      const data = parsePetThread(html, stub.name)
      rawData.set(stub.slug, data)
      enriched++
      console.log(' ✓')
    } catch (err) {
      console.log(` ⚠️  error: ${err} — skipping`)
      skipped++
    }

    if (i < stubs.length - 1) await sleep(DELAY_MS)
  }

  console.log(`\n✅ Fetched: ${enriched}  Skipped: ${skipped}`)

  // ── PASS 2: Fetch Chronology and resolve cross-references ─────────────────

  console.log('\n📅 Fetching Chronology page for release dates...')
  await sleep(DELAY_MS)
  let releaseDates = new Map<string, string>()
  try {
    const chronoHtml = await fetchPage(CHRONOLOGY_URL, cookie)
    releaseDates = parseChronology(chronoHtml)
    console.log(`✅ Parsed ${releaseDates.size} release date entries`)
  } catch (err) {
    console.warn(`⚠️  Chronology page error: ${err} — release dates will be empty`)
  }

  // ── Assemble final Pet objects ────────────────────────────────────────────

  console.log('\n🔗 Resolving cross-references...')
  const pets: Pet[] = []

  for (const stub of stubs) {
    const data = rawData.get(stub.slug)
    if (!data) continue  // was skipped

    // Resolve Also See names → typed refs
    const alsoSee: AlsoSeeRef[] = data.alsoSeeNames
      .map(rawName => {
        const normalised = rawName.toLowerCase()
        const resolved = nameToSlug.get(normalised)
        if (resolved) {
          return { name: rawName, slug: resolved.slug, type: resolved.type }
        }
        // Try stripping trailing period/punctuation
        const clean = normalised.replace(/[.,!?]+$/, '').trim()
        const resolvedClean = nameToSlug.get(clean)
        if (resolvedClean) {
          return { name: rawName.replace(/[.,!?]+$/, '').trim(), slug: resolvedClean.slug, type: resolvedClean.type }
        }
        // Not in dataset yet — log and skip
        return null
      })
      .filter((r): r is AlsoSeeRef => r !== null)

    // Resolve evolution result slugs
    const evolutions: Evolution[] = data.evolutions.map(ev => {
      const normalised = ev.resultName.toLowerCase()
      const resolved = nameToSlug.get(normalised)
      const baseName = normalised.replace(/\s*\(.*?\)\s*$/, '').trim()
      const resolvedBase = nameToSlug.get(baseName)
      const best = resolved ?? resolvedBase
      return {
        combineWith: ev.combineWith,
        resultName: ev.resultName,
        resultSlug: best?.slug ?? prefixedSlug(ev.resultName, 'pet'),
        resultType: best?.type ?? 'pet',
      }
    })

    // Get release date (try exact name, then lowercase)
    const releaseDate =
      releaseDates.get(stub.name.toLowerCase()) ??
      releaseDates.get(stub.name) ??
      'Unknown'

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
      releaseDate,
      ...(data.imageUrl ? { imageUrl: data.imageUrl } : {}),
      forumUrl: stub.forumUrl,
      ...(data.notes ? { notes: data.notes } : {}),
      alsoSee,
      tags: generatePetTags(stub.name, stub.elements, stub.markers, stub.type),
    }

    pets.push(pet)
  }

  // Sort alphabetically
  pets.sort((a, b) => a.name.localeCompare(b.name))

  // Write output
  console.log(`\n📁 Writing ${pets.length} pets to ${OUTPUT_PATH}`)
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(pets, null, 2) + '\n', 'utf-8')
  console.log('\n🎉 Done!')

  // Summary
  const unresolved = pets.flatMap(p => p.alsoSee).length
  const withImages = pets.filter(p => p.imageUrl).length
  const withReleaseDate = pets.filter(p => p.releaseDate !== 'Unknown').length
  console.log(`\n📊 Summary:`)
  console.log(`   Pets:          ${pets.length}`)
  console.log(`   With images:   ${withImages}`)
  console.log(`   With dates:    ${withReleaseDate}`)
  console.log(`   Also See refs: ${unresolved}`)
}

function generatePetTags(name: string, elements: string[], markers: string[], type: EntryType): string[] {
  const tags: string[] = [type]
  // Add element codes as tags for search
  tags.push(...elements.map(e => e.toLowerCase()))
  tags.push(...markers.map(m => m.toLowerCase().replace('/', '-')))
  // Location hints from name
  const n = name.toLowerCase()
  if (n.includes('moglin')) tags.push('moglin')
  if (n.includes('dragon')) tags.push('dragon')
  if (n.includes('artix')) tags.push('artix')
  if (n.includes('doomknight')) tags.push('doomknight')
  return [...new Set(tags)]
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
