/**
 * Badge Scraper - A-Z Page Strategy
 *
 * Parses the A-Z Badges master post which contains:
 * - All badge names with forum links
 * - Category and subcategory classification
 * - Retired / unreleased status
 *
 * Then fetches each individual badge thread for full details:
 * - Flavour text / description
 * - DA Required status
 * - Requirements
 * - Notes / Other information
 *
 * USAGE:
 * 1. Get your session cookie from DevTools → Network → Headers → Cookie
 * 2. Add to .env: FORUM_COOKIE="your_cookie_string"
 * 3. Run: npm run scrape:badges
 *
 * The A-Z master post URL:
 * https://forums2.battleon.com/f/tm.asp?m=22304590&mpage=1&key=
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

const FORUM_BASE = 'https://forums2.battleon.com/f'
const AZ_PAGE_URL = `${FORUM_BASE}/tm.asp?m=22304590&mpage=1&key=`
const DELAY_MS = 800
const OUTPUT_PATH = path.resolve(import.meta.dirname, '../src/data/badges.json')

// ─── Types ───────────────────────────────────────────────────────────────────

interface BadgeStub {
  name: string
  slug: string
  messageId: string
  forumUrl: string
  category: string      // top-level: quest-completion, classes, challenges, other
  subcategory: string   // e.g. "Early Days", "Book 3", "Side Quests", "Frostval"
  retired: boolean
  unreleased: boolean
}

interface BadgeData extends BadgeStub {
  id: string
  description: string
  requirements: string
  daRequired: boolean
  howToObtain: { order: number; instruction: string }[]
  forumLinks: { url: string; title: string; isPrimary: boolean }[]
  forumImageUrl?: string  // image URL extracted from forum post (imgur, upfiles, etc.)
  tags: string[]
  notes?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Step 1: Parse A-Z master page ───────────────────────────────────────────

function mapForumCategory(raw: string): string {
  const s = raw.toLowerCase()
  // Forum category strings from the badge threads:
  // "Quests Badges", "Classes Badges", "Challenges Badges", "Other Badges"
  // "Holiday Badge", "PvP Badges", "Skill Badges", "Armor Badges"
  // "Random Badges"
  if (s.includes('quest')) return 'quest-completion'
  if (s.includes('holiday') || s.includes('seasonal')) return 'seasonal'
  if (s.includes('class') || s.includes('armor') || s.includes('skill') || s.includes('random')) return 'collection'
  if (s.includes('challenge') || s.includes('pvp') || s.includes('combat')) return 'combat'
  return 'misc'
}

function mapSubcategoryToSeasonal(subcategory: string): boolean {
  // Some badges are in "Other Badges" category but their subcategory reveals they're seasonal
  const s = subcategory.toLowerCase()
  return s.includes('frostval') || s.includes('mogloween') || s.includes('hhd') ||
    s.includes('holiday') || s.includes('hero\'s heart')
}

function parseAZPage(html: string): BadgeStub[] {
  const stubs: BadgeStub[] = []
  const seen = new Set<string>()

  // The A-Z page alphabetical listing has all badge links with names.
  // We extract every tm.asp?m=XXXXX link and the badge name next to it.
  // The retired section links the same badges again — we use the first occurrence
  // (alphabetical section = active badges, later = retired).

  // Track retired section
  const chunks = html.split(/<br\s*\/?>/)
  let inRetired = false
  let inUnreleased = false

  for (const chunk of chunks) {
    const text = stripHtml(decodeHTML(chunk)).trim()

    // Detect retired / unreleased sections by their headings
    if (/Retired Badges Sorted by Category/i.test(text)) { inRetired = true; inUnreleased = false; continue }
    if (/Unreleased Badges Sorted by Category/i.test(text)) { inUnreleased = true; inRetired = false; continue }
    // The alphabetical listing heading resets state
    if (/^Alphabetical Badge Listing$/i.test(text)) { inRetired = false; inUnreleased = false; continue }

    const linkMatch = /href="https?:\/\/forums2\.battleon\.com\/f\/tm\.asp\?m=(\d+)"[^>]*>\s*([^<]+?)\s*<\/a>/i.exec(chunk)
    if (!linkMatch) continue

    const msgId = linkMatch[1]
    const name = decodeHTML(linkMatch[2].trim())
    if (!name || name.length < 2) continue

    // Skip the A-Z Badges index thread itself
    if (name === 'A-Z Badges') continue

    if (seen.has(msgId)) continue // dedup — first occurrence wins (alphabetical section)
    seen.add(msgId)

    stubs.push({
      name,
      slug: slugify(name),
      messageId: msgId,
      forumUrl: `${FORUM_BASE}/tm.asp?m=${msgId}`,
      category: 'misc',
      subcategory: 'General',
      retired: inRetired,
      unreleased: inUnreleased,
    })
  }

  return stubs
}

// ─── Step 2: Fetch individual badge thread for full details ──────────────────

async function fetchBadgeDetails(
  stub: BadgeStub,
  cookie: string
): Promise<Partial<BadgeData>> {
  try {
    const html = await fetchPage(stub.forumUrl, cookie)

    if (html.includes('This message has been deleted or moved')) {
      return {}
    }

    const bodyMatch = html.match(/<td[^>]*valign=["']?top["']?[^>]*width=["']?100%["']?[^>]*>([\s\S]*?)<\/td>/i)
    const rawBody = bodyMatch ? bodyMatch[1] : html
    const text = stripHtml(decodeHTML(rawBody))
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

    let description = ''
    let daRequired = false
    let requirements = ''
    let category = stub.category
    let subcategory = stub.subcategory
    const noteLines: string[] = []
    let inNotes = false

    for (const line of lines) {
      if (line === stub.name || line === `The ${stub.name}`) continue

      if (/^\(.*\)$/.test(line)) {
        if (/No DA/i.test(line)) daRequired = false
        else if (/DA Required/i.test(line)) daRequired = true
        continue
      }

      if (/^Requirements?:/i.test(line)) {
        requirements = line.replace(/^Requirements?:\s*/i, '').trim()
        continue
      }

      if (/^Category:/i.test(line)) {
        const rawCat = line.replace(/^Category:\s*/i, '').trim()
        subcategory = rawCat
        category = mapForumCategory(rawCat)
        continue
      }

      if (/^Other information/i.test(line)) { inNotes = true; continue }
      if (/^Thanks to/i.test(line)) continue

      if (!description && !inNotes && line.length > 5) {
        description = line
        continue
      }

      if (inNotes && line.length > 3) {
        noteLines.push(line.replace(/^[•\-\*]\s*/, ''))
      }
    }

    // Extract image URL from the forum post HTML
    // Forum posts may have images from imgur, battleon upfiles, or DF-Pedia GitHub
    // Skip UI/avatar images (board icons, user avatars, tag banners, tracker pixels)
    let forumImageUrl: string | undefined
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
    let imgMatch: RegExpExecArray | null
    while ((imgMatch = imgRegex.exec(rawBody)) !== null) {
      const src = imgMatch[1]
      // Skip known non-badge images
      if (
        src.includes('/f/image/') ||          // forum UI images
        src.includes('forumheader') ||         // header banner
        src.includes('quantserve') ||          // tracker pixel
        src.includes('artix.com/shared') ||    // nav icons
        src.includes('ArtixGameLauncher') ||   // launcher image
        src.includes('tags/') ||               // category tag banners (DA.png, Seasonal.jpg etc.)
        src.includes('upfiles/') && src.includes('/f/upfiles/') && src.length < 60 // tiny avatars
      ) continue

      // Accept badge images from known sources
      if (
        src.includes('imgur.com') ||
        src.includes('i.imgur.com') ||
        src.includes('DF-Pedia') ||
        src.includes('DF-Pedia'.toLowerCase()) ||
        src.includes('battleon.com/encyc') ||
        src.includes('artix.com/encyc') ||
        (src.includes('/f/upfiles/') && src.length > 60)  // longer upfile URLs are actual badge images
      ) {
        forumImageUrl = src
        break
      }
    }

    return {
      description: description || `Badge: ${stub.name}`,
      daRequired,
      requirements,
      category,
      subcategory,
      forumImageUrl,
      notes: noteLines.length > 0 ? noteLines.join(' • ') : undefined,
    }
  } catch (err) {
    console.warn(`   ⚠️  Could not fetch details for "${stub.name}": ${err}`)
    return {}
  }
}

// ─── Tag generation ──────────────────────────────────────────────────────────

function generateTags(name: string, requirements: string, subcategory: string): string[] {
  const tags: string[] = []
  const combined = `${name} ${requirements} ${subcategory}`.toLowerCase()

  // Subcategory as tag
  if (subcategory && subcategory !== 'General') {
    tags.push(subcategory.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
  }

  // Story book tags
  if (combined.includes('book 1') || combined.includes('book1')) tags.push('book-1')
  if (combined.includes('book 2') || combined.includes('book2')) tags.push('book-2')
  if (combined.includes('book 3') || combined.includes('book3')) tags.push('book-3')
  if (combined.includes('early days')) tags.push('early-game')

  // Location tags
  if (combined.includes('oaklore')) tags.push('oaklore')
  if (combined.includes('falconreach')) tags.push('falconreach')
  if (combined.includes('amityvale')) tags.push('amityvale')
  if (combined.includes('dragesvard')) tags.push('dragesvard')
  if (combined.includes('necropolis')) tags.push('necropolis')
  if (combined.includes('lymcrest')) tags.push('lymcrest')
  if (combined.includes('dragonsgrasp')) tags.push('dragonsgrasp')
  if (combined.includes('frostval')) tags.push('frostval')
  if (combined.includes('mogloween')) tags.push('mogloween')
  if (combined.includes('inn at the edge') || combined.includes('iate')) tags.push('inn-challenges')

  return [...new Set(tags)]
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🐉 DragonFable Badge Scraper (A-Z Strategy)')
  console.log('─'.repeat(50))

  const cookie = loadCookie()
  console.log('✅ Cookie loaded\n')

  // Step 1: Parse A-Z master page
  console.log('📄 Fetching A-Z Badges master page...')
  const azHtml = await fetchPage(AZ_PAGE_URL, cookie)
  const stubs = parseAZPage(azHtml)
  console.log(`✅ Found ${stubs.length} badges in A-Z page\n`)

  if (stubs.length === 0) {
    console.error('❌ No badges found — cookie may have expired. Refresh and retry.')
    process.exit(1)
  }

  // Step 2: Fetch details for each badge
  const badges: BadgeData[] = []
  let enriched = 0
  let fallback = 0

  for (let i = 0; i < stubs.length; i++) {
    const stub = stubs[i]
    process.stdout.write(`[${i + 1}/${stubs.length}] ${stub.name}...`)

    const details = await fetchBadgeDetails(stub, cookie)
    const hasDetails = !!details.description && !details.description?.startsWith('Badge:')

    if (hasDetails) enriched++
    else fallback++

    const badge: BadgeData = {
      ...stub,
      id: stub.slug,
      description: details.description ?? `Badge: ${stub.name}`,
      requirements: details.requirements ?? '',
      daRequired: details.daRequired ?? false,
      category: (() => {
        const cat = details.category ?? stub.category
        const sub = details.subcategory ?? stub.subcategory
        const name = stub.name.toLowerCase()
        // Seasonal detection: subcategory hint OR name patterns
        if (cat === 'misc') {
          if (mapSubcategoryToSeasonal(sub)) return 'seasonal'
          if (/mogloween|frostval|frost moglin|golem breaker|naughty list|bad toys|x-val|icemaster|merry togsmas|sugary nightmare|frostvayle|list completion|resident: sneevil|pumpkinlord|evolved pumpkinlord|togslayer|#1 threat|bachelor|wrestling champion|catastrophic candy|48 weeks/i.test(name)) return 'seasonal'
          if (/pvp/i.test(name)) return 'combat'
        }
        return cat
      })(),
      subcategory: details.subcategory ?? stub.subcategory,
      howToObtain: details.requirements
        ? [{ order: 1, instruction: details.requirements }]
        : [{ order: 1, instruction: 'See forum link for details.' }],
      forumLinks: [
        {
          url: stub.forumUrl,
          title: `DF Encyclopedia: ${stub.name}`,
          isPrimary: true,
        },
      ],
      tags: generateTags(stub.name, details.requirements ?? '', details.subcategory ?? stub.subcategory),
      // imageUrl: DF-Pedia adds this in a post-processing step (add_images.py)
      // forumImageUrl is stored for badges where DF-Pedia has no image
      ...(details.forumImageUrl ? { forumImageUrl: details.forumImageUrl } : {}),
      ...(details.notes ? { notes: details.notes } : {}),
    }

    badges.push(badge)
    console.log(hasDetails ? ' ✓' : ' (no details)')

    if (i < stubs.length - 1) await sleep(DELAY_MS)
  }

  // Sort alphabetically
  badges.sort((a, b) => a.name.localeCompare(b.name))

  console.log('\n' + '─'.repeat(50))
  console.log(`✅ Enriched with full details: ${enriched}`)
  console.log(`⚠️  Name + forum link only:    ${fallback}`)
  console.log(`📁 Writing ${badges.length} badges to ${OUTPUT_PATH}`)

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(badges, null, 2) + '\n', 'utf-8')
  console.log('\n🎉 Done!')
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
