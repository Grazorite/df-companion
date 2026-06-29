/**
 * Badge Scraper for DragonFable Forums
 *
 * This script crawls the DF Encyclopedia Badges forum section and builds
 * a complete badges.json file from the forum data.
 *
 * USAGE:
 * 1. Open the badges forum in your browser: https://forums2.battleon.com/f/tt.asp?forumid=412
 * 2. Open DevTools → Application → Cookies → forums2.battleon.com
 * 3. Copy the full cookie string (or just the session cookie value)
 * 4. Create a .env file in the project root with: FORUM_COOKIE="your_cookie_string_here"
 * 5. Run: npx tsx scripts/scrape-badges.ts
 *
 * The script will:
 * - Fetch the badge forum topic listing (all pages)
 * - Extract each badge thread link and name
 * - Fetch each individual badge thread
 * - Parse the badge data (name, description, requirements, category, DA status, notes)
 * - Write the result to src/data/badges.json
 *
 * RATE LIMITING:
 * - 2 second delay between requests to be respectful to the forum server
 * - If a request fails, it retries once after 5 seconds
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

// ─── Configuration ───────────────────────────────────────────────────────────

const FORUM_BASE = 'https://forums2.battleon.com/f'
const BADGES_FORUM_ID = 412
const DELAY_MS = 2000 // 2 seconds between requests
const RETRY_DELAY_MS = 5000
const OUTPUT_PATH = path.resolve(import.meta.dirname, '../src/data/badges.json')

// ─── Load cookie from .env ───────────────────────────────────────────────────

function loadCookie(): string {
  const envPath = path.resolve(import.meta.dirname, '../.env')
  if (!fs.existsSync(envPath)) {
    console.error('❌ Missing .env file. Create one with FORUM_COOKIE="your_cookie_here"')
    console.error('   See instructions at the top of this script.')
    process.exit(1)
  }

  const envContent = fs.readFileSync(envPath, 'utf-8')
  const match = envContent.match(/FORUM_COOKIE=["']?(.+?)["']?\s*$/)
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

// ─── Step 1: Get all badge topic links from the forum listing ────────────────

interface TopicLink {
  name: string
  url: string
  messageId: string
}

async function getTopicLinks(cookie: string): Promise<TopicLink[]> {
  const topics: TopicLink[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const url = `${FORUM_BASE}/tt.asp?forumid=${BADGES_FORUM_ID}&page=${page}`
    console.log(`📄 Fetching topic list page ${page}...`)

    const html = await fetchPage(url, cookie)

    // Extract topic links: pattern like <a href="tm.asp?m=XXXXX">Topic Name</a>
    const linkRegex = /<a[^>]*href=["']tm\.asp\?m=(\d+)["'][^>]*>([^<]+)<\/a>/gi
    let match: RegExpExecArray | null
    let foundOnPage = 0

    while ((match = linkRegex.exec(html)) !== null) {
      const messageId = match[1]
      const name = match[2].trim()

      // Skip "A-Z Badges" (the index thread) and navigation links
      if (name === 'A-Z Badges' || name === 'Older Topic' || name === 'Newer Topic') continue
      // Skip if already have this topic
      if (topics.some((t) => t.messageId === messageId)) continue

      topics.push({
        name: decodeHTMLEntities(name),
        url: `${FORUM_BASE}/tm.asp?m=${messageId}`,
        messageId,
      })
      foundOnPage++
    }

    console.log(`   Found ${foundOnPage} badge topics on page ${page}`)

    // Check if there's a "next page" link
    if (html.includes(`page=${page + 1}`) && foundOnPage > 0) {
      page++
      await sleep(DELAY_MS)
    } else {
      hasMore = false
    }
  }

  console.log(`\n✅ Found ${topics.length} total badge topics\n`)
  return topics
}

// ─── Step 2: Parse individual badge pages ────────────────────────────────────

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
  wikiLink?: string
  tags: string[]
  notes?: string
}

async function parseBadgePage(topic: TopicLink, cookie: string): Promise<BadgeData | null> {
  try {
    const html = await fetchPage(topic.url, cookie)

    // Check if the page has actual content
    if (html.includes('This message has been deleted or moved')) {
      console.warn(`   ⚠️  Skipping "${topic.name}" — message deleted/moved`)
      return null
    }

    // Extract the message body content
    // The forum uses a table structure. The message content is typically in a <td> after the user info.
    // We'll look for the post content between common markers.

    // Try to extract the main post body
    const bodyMatch = html.match(
      /<td[^>]*class=["']post-body["'][^>]*>([\s\S]*?)<\/td>/i
    ) ?? html.match(
      /<td[^>]*valign=["']top["'][^>]*width=["']100%["'][^>]*>([\s\S]*?)<\/td>/i
    )

    const body = bodyMatch ? bodyMatch[1] : html

    // Parse fields from the body text
    const textContent = stripHtml(body)

    // Extract description (usually italic text after the badge name)
    const descMatch = textContent.match(/(?:^|\n)\s*(.+?)(?:\n|$)/) 
    const description = extractDescription(textContent, topic.name)

    // Extract DA requirement
    const daRequired = /\bDA Required\b/i.test(textContent) || /\bDragon Amulet Required\b/i.test(textContent)
    const noDA = /\bNo DA Required\b/i.test(textContent) || /\bNo Dragon Amulet\b/i.test(textContent)

    // Extract requirements line
    const reqMatch = textContent.match(/Requirements?:\s*(.+?)(?:\n|$)/i)
    const requirements = reqMatch ? reqMatch[1].trim() : ''

    // Extract category
    const catMatch = textContent.match(/Category:\s*(.+?)(?:\n|$)/i)
    const categoryRaw = catMatch ? catMatch[1].trim() : ''
    const category = mapCategory(categoryRaw)

    // Extract "Other information" / notes
    const notesMatch = textContent.match(/Other information[:\s]*\n?([\s\S]*?)(?:\n\n|Thanks to|$)/i)
    const notes = notesMatch ? notesMatch[1].replace(/^[•\-\s]+/gm, '').trim() : undefined

    // Generate tags from name and requirements
    const tags = generateTags(topic.name, requirements, category)

    const badge: BadgeData = {
      id: slugify(topic.name),
      name: topic.name,
      slug: slugify(topic.name),
      description: description || `Badge: ${topic.name}`,
      category,
      requirements,
      daRequired: daRequired && !noDA,
      howToObtain: requirements
        ? [{ order: 1, instruction: requirements }]
        : [{ order: 1, instruction: `See forum link for details` }],
      forumLinks: [
        {
          url: topic.url,
          title: `DF Encyclopedia: ${topic.name}`,
          isPrimary: true,
        },
      ],
      tags,
      ...(notes && notes.length > 0 ? { notes } : {}),
    }

    return badge
  } catch (error) {
    console.error(`   ❌ Error parsing "${topic.name}": ${error}`)
    return null
  }
}

// ─── Utility functions ───────────────────────────────────────────────────────

function decodeHTMLEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function extractDescription(text: string, badgeName: string): string {
  // Description is usually the italic line right after the badge name
  // Format: "BadgeName\nThe italic description\n(No DA Required)"
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)

  // Find the line after the badge name that looks like a description
  const nameIdx = lines.findIndex((l) => l.includes(badgeName))
  if (nameIdx >= 0 && nameIdx + 1 < lines.length) {
    const nextLine = lines[nameIdx + 1]
    // Skip if it's a metadata line
    if (
      !nextLine.startsWith('(') &&
      !nextLine.startsWith('Requirements') &&
      !nextLine.startsWith('Category') &&
      nextLine.length > 5
    ) {
      return nextLine
    }
  }

  // Fallback: look for first non-metadata line
  for (const line of lines) {
    if (
      line !== badgeName &&
      !line.startsWith('(') &&
      !line.startsWith('Requirements') &&
      !line.startsWith('Category') &&
      !line.startsWith('Other') &&
      !line.startsWith('Thanks') &&
      !line.startsWith('Badge') &&
      line.length > 10 &&
      line.length < 200
    ) {
      return line
    }
  }

  return ''
}

function mapCategory(raw: string): string {
  const lower = raw.toLowerCase()
  if (lower.includes('quest')) return 'quest-completion'
  if (lower.includes('holiday') || lower.includes('seasonal')) return 'seasonal'
  if (lower.includes('pvp') || lower.includes('combat')) return 'combat'
  if (lower.includes('skill')) return 'collection'
  if (lower.includes('armor')) return 'collection'
  if (lower.includes('random') || lower.includes('misc')) return 'misc'
  if (lower.includes('exploration')) return 'exploration'
  if (lower.includes('secret')) return 'secret'
  if (lower.includes('community')) return 'community'
  return 'misc'
}

function generateTags(name: string, requirements: string, category: string): string[] {
  const tags: string[] = []
  const combined = `${name} ${requirements}`.toLowerCase()

  // Location-based tags
  if (combined.includes('oaklore')) tags.push('oaklore')
  if (combined.includes('falconreach')) tags.push('falconreach')
  if (combined.includes('amityvale')) tags.push('amityvale')
  if (combined.includes('dragesvard')) tags.push('dragesvard')
  if (combined.includes('necropolis')) tags.push('necropolis')
  if (combined.includes('lymcrest')) tags.push('lymcrest')
  if (combined.includes('dragonsgrasp')) tags.push('dragonsgrasp')
  if (combined.includes('sulen')) tags.push("swordhaven")
  if (combined.includes('frostval')) tags.push('frostval')
  if (combined.includes('mogloween')) tags.push('mogloween')

  // Category tag
  tags.push(category)

  return [...new Set(tags)]
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🐉 DragonFable Badge Scraper')
  console.log('─'.repeat(50))

  const cookie = loadCookie()
  console.log('✅ Cookie loaded from .env\n')

  // Step 1: Get all topic links
  const topics = await getTopicLinks(cookie)

  if (topics.length === 0) {
    console.error('❌ No badge topics found. Check your cookie — you may need to refresh it.')
    process.exit(1)
  }

  // Step 2: Fetch and parse each badge
  const badges: BadgeData[] = []
  let success = 0
  let failed = 0

  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i]
    console.log(`[${i + 1}/${topics.length}] Fetching: ${topic.name}`)

    let badge = await parseBadgePage(topic, cookie)

    // Retry once on failure
    if (!badge) {
      console.log(`   Retrying after ${RETRY_DELAY_MS / 1000}s...`)
      await sleep(RETRY_DELAY_MS)
      badge = await parseBadgePage(topic, cookie)
    }

    if (badge) {
      badges.push(badge)
      success++
    } else {
      failed++
    }

    // Rate limit
    if (i < topics.length - 1) {
      await sleep(DELAY_MS)
    }
  }

  // Step 3: Write output
  console.log('\n' + '─'.repeat(50))
  console.log(`✅ Successfully parsed: ${success}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`📁 Writing to: ${OUTPUT_PATH}`)

  // Sort alphabetically by name
  badges.sort((a, b) => a.name.localeCompare(b.name))

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(badges, null, 2) + '\n', 'utf-8')

  console.log(`\n🎉 Done! ${badges.length} badges written to badges.json`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
