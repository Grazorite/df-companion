/**
 * Badge Scraper for DragonFable Forums
 *
 * This script crawls the DF Encyclopedia Badges forum section and builds
 * a complete badges.json file from the forum data.
 *
 * USAGE:
 * 1. Open the badges forum in your browser: https://forums2.battleon.com/f/tt.asp?forumid=412
 * 2. Open DevTools → Network tab → click the first request → Headers tab
 * 3. Copy the Cookie value from Request Headers
 * 4. Create a .env file in the project root with: FORUM_COOKIE="your_cookie_string_here"
 * 5. Run: npm run scrape:badges
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

// ─── Configuration ───────────────────────────────────────────────────────────

const FORUM_BASE = 'https://forums2.battleon.com/f'
const BADGES_FORUM_ID = 412
const DELAY_MS = 2000
const OUTPUT_PATH = path.resolve(import.meta.dirname, '../src/data/badges.json')

// ─── Load cookie from .env ───────────────────────────────────────────────────

function loadCookie(): string {
  const envPath = path.resolve(import.meta.dirname, '../.env')
  if (!fs.existsSync(envPath)) {
    console.error('❌ Missing .env file. Create one with FORUM_COOKIE="your_cookie_here"')
    process.exit(1)
  }

  const envContent = fs.readFileSync(envPath, 'utf-8')
  const match = envContent.match(/FORUM_COOKIE=["'](.+?)["']\s*$/)
  if (!match) {
    console.error('❌ FORUM_COOKIE not found in .env file')
    process.exit(1)
  }

  return match[1]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchPage(url: string, cookie: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      Cookie: cookie,
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  return response.text()
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

function decodeHTMLEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
}

// ─── Badge parsing from topic list title attribute ───────────────────────────

interface BadgeData {
  id: string
  name: string
  slug: string
  description: string
  category: string
  requirements: string
  daRequired: boolean
  howToObtain: { order: number; instruction: string }[]
  forumLinks: { url: string; title: string; isPrimary: boolean }[]
  tags: string[]
  notes?: string
}

function parseBadgeFromTitle(name: string, titleAttr: string, messageId: string): BadgeData | null {
  // The title attribute contains the badge info separated by <br>
  // Format: [optional image tags] BadgeName <br> Description <br> (DA status) <br> <br> Requirements: ... <br> Category: ...
  const parts = titleAttr
    .split(/<br\s*\/?>|\n/)
    .map((p) => decodeHTMLEntities(p.trim()))
    .filter((p) => p.length > 0)

  // Remove image URLs from parts
  const cleanParts = parts.filter(
    (p) => !p.startsWith('http://') && !p.startsWith('https://') && p.length > 0
  )

  if (cleanParts.length < 2) {
    return null
  }

  // Find description — usually the first line after the badge name that isn't metadata
  let description = ''
  let daRequired = false
  let requirements = ''
  let category = 'misc'
  const noteLines: string[] = []

  let foundReqs = false

  for (const part of cleanParts) {
    // Skip the badge name line itself
    if (part === name || part === `The ${name}` || part.replace(/^The /, '') === name) continue

    // DA status
    if (/^\(.*DA.*\)$/i.test(part)) {
      daRequired = /DA Required/i.test(part) && !/No DA/i.test(part)
      continue
    }

    // Requirements line
    if (/^Requirements?:/i.test(part)) {
      requirements = part.replace(/^Requirements?:\s*/i, '').trim()
      foundReqs = true
      continue
    }

    // Category line
    if (/^Category:/i.test(part)) {
      category = mapCategory(part.replace(/^Category:\s*/i, '').trim())
      continue
    }

    // Other information header
    if (/^Other information/i.test(part)) continue

    // "Thanks to" attribution line - skip
    if (/^Thanks to/i.test(part)) continue

    // If we haven't found requirements yet and no description yet, it's the description
    if (!foundReqs && !description && part.length > 3) {
      description = part
      continue
    }

    // Everything after requirements/category is notes
    if (foundReqs && part.length > 3 && !/^Category:/i.test(part)) {
      noteLines.push(part)
    }
  }

  // Clean up the display name (forum uses "Name, The" format)
  const displayName = name.includes(', The')
    ? `The ${name.replace(', The', '')}`
    : name.includes(', A')
      ? `A ${name.replace(', A', '')}`
      : name

  const slug = slugify(displayName)
  const notes = noteLines.length > 0 ? noteLines.join('. ') : undefined

  // Generate obtaining steps from requirements
  const howToObtain = requirements
    ? [{ order: 1, instruction: requirements }]
    : [{ order: 1, instruction: 'See forum link for details' }]

  return {
    id: slug,
    name: displayName,
    slug,
    description: description || `Badge: ${displayName}`,
    category,
    requirements,
    daRequired,
    howToObtain,
    forumLinks: [
      {
        url: `${FORUM_BASE}/tm.asp?m=${messageId}`,
        title: `DF Encyclopedia: ${displayName}`,
        isPrimary: true,
      },
    ],
    tags: generateTags(displayName, requirements, category),
    ...(notes ? { notes } : {}),
  }
}

function mapCategory(raw: string): string {
  const lower = raw.toLowerCase()
  if (lower.includes('quest')) return 'quest-completion'
  if (lower.includes('holiday') || lower.includes('seasonal')) return 'seasonal'
  if (lower.includes('pvp')) return 'combat'
  if (lower.includes('challenge')) return 'combat'
  if (lower.includes('skill') || lower.includes('class') || lower.includes('armor'))
    return 'collection'
  if (lower.includes('random')) return 'misc'
  if (lower.includes('exploration')) return 'exploration'
  if (lower.includes('secret')) return 'secret'
  if (lower.includes('community')) return 'community'
  return 'misc'
}

function generateTags(name: string, requirements: string, category: string): string[] {
  const tags: string[] = [category]
  const combined = `${name} ${requirements}`.toLowerCase()

  if (combined.includes('oaklore')) tags.push('oaklore')
  if (combined.includes('falconreach')) tags.push('falconreach')
  if (combined.includes('amityvale')) tags.push('amityvale')
  if (combined.includes('dragesvard')) tags.push('dragesvard')
  if (combined.includes('necropolis')) tags.push('necropolis')
  if (combined.includes('lymcrest')) tags.push('lymcrest')
  if (combined.includes('dragonsgrasp')) tags.push('dragonsgrasp')
  if (combined.includes('frostval')) tags.push('frostval')
  if (combined.includes('mogloween')) tags.push('mogloween')
  if (combined.includes('inn at the edge')) tags.push('inn-challenges')
  if (combined.includes('book of lore')) tags.push('book-of-lore')
  if (combined.includes('hero\'s heart')) tags.push('heros-heart-day')

  return [...new Set(tags)]
}

// ─── Main: crawl all pages of badge forum ────────────────────────────────────

async function main() {
  console.log('🐉 DragonFable Badge Scraper')
  console.log('─'.repeat(50))

  const cookie = loadCookie()
  console.log('✅ Cookie loaded from .env\n')

  const badges: BadgeData[] = []
  let page = 1
  let hasMore = true
  let skipped = 0

  while (hasMore) {
    const url =
      page === 1
        ? `${FORUM_BASE}/tt.asp?forumid=${BADGES_FORUM_ID}`
        : `${FORUM_BASE}/tt.asp?forumid=${BADGES_FORUM_ID}&p=${page}&tmode=10&smode=1`

    console.log(`📄 Fetching page ${page}...`)

    const html = await fetchPage(url, cookie)

    // Extract all topic links with their title attributes
    // Pattern: <a href="tm.asp?m=XXXXX" title="badge preview...">  Badge Name  </a>
    const linkRegex = /<a\s+href="tm\.asp\?m=(\d+)"\s+title="([^"]*)">\s*(.+?)\s*<\/a>/gi
    let match: RegExpExecArray | null
    let foundOnPage = 0

    while ((match = linkRegex.exec(html)) !== null) {
      const messageId = match[1]
      const titleAttr = match[2]
      const topicName = match[3].trim()

      // Skip the A-Z index thread
      if (topicName === 'A-Z Badges') continue
      // Skip if already processed (dedup)
      if (badges.some((b) => b.forumLinks[0]?.url.includes(messageId))) continue

      const badge = parseBadgeFromTitle(topicName, titleAttr, messageId)
      if (badge) {
        badges.push(badge)
        foundOnPage++
      } else {
        skipped++
        console.log(`   ⚠️  Could not parse: ${topicName}`)
      }
    }

    console.log(`   Parsed ${foundOnPage} badges from page ${page}`)

    // Check for next page
    const nextPagePattern = new RegExp(`p=${page + 1}`)
    if (nextPagePattern.test(html) && foundOnPage > 0) {
      page++
      await sleep(DELAY_MS)
    } else {
      hasMore = false
    }
  }

  // Sort alphabetically
  badges.sort((a, b) => a.name.localeCompare(b.name))

  // Write output
  console.log('\n' + '─'.repeat(50))
  console.log(`✅ Total badges parsed: ${badges.length}`)
  console.log(`⚠️  Skipped: ${skipped}`)
  console.log(`📁 Writing to: ${OUTPUT_PATH}`)

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(badges, null, 2) + '\n', 'utf-8')

  console.log(`\n🎉 Done! ${badges.length} badges written to badges.json`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
