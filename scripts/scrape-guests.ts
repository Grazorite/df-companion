/**
 * Guests Scraper — Chronology-First Strategy (Resumable)
 *
 * This scraper fetches Chronology first to get authoritative guest types,
 * then parses the A-Z page to build stubs with correct type prefixes.
 *
 * Entry format: [DAR] Guest Name (D-Coins/Seasonal)
 *
 * USAGE:
 *   npm run scrape:guests                 # Scrape all guests
 *   npm run scrape:guests -- --start=C    # Resume from letter C onwards
 *   npm run scrape:guests -- --letter=B   # Scrape only letter B
 *   npm run scrape:guests -- --letters=A,B # Scrape multiple letters A and B
 *
 * Progress is saved to guests-progress.json after each entry,
 * so a timeout or crash won't lose work. Final output is guests.json.
 *
 * Cookie: Add FORUM_COOKIE="..." to .env
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { Guest, GuestAttack, GuestStats, ObtainMethod, AlsoSeeRef, EntryType } from '../src/types/pet.ts'
import type { ItemFamily, ObtainVariant, LevelVariant } from '../src/types/item.ts'

const FORUM_BASE = 'https://forums2.battleon.com/f'
const AZ_PETS_URL = `${FORUM_BASE}/tm.asp?m=22349620&mpage=1`  // A-Z Pets & Guests combined (filtered by type)
const CHRONOLOGY_URL = `${FORUM_BASE}/tm.asp?m=10738071`
const DELAY_MS = 1000
const OUTPUT_PATH = path.resolve(import.meta.dirname, '../src/data/guests.json')
const PROGRESS_PATH = path.resolve(import.meta.dirname, '../src/data/guests-progress.json')

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
    .replace(/&apos;/g, "'")
}

function stripHtml(html: string): string {
  // Handle forum's malformed HTML - reuse logic from scrape-pets.ts
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
    
    if (char === '<' && !inTag) {
      const nextChars = html.slice(i, i + 10)
      if (/^<[a-zA-Z!\/]/.test(nextChars)) {
        inTag = true
        tagStart = i
      } else {
        processed += char
      }
      i++
      continue
    }
    
    if (char === '>' && inTag) {
      inTag = false
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
      
      i++
      continue
    }
    
    if (inTag) {
      i++
      continue
    }
    
    processed += char
    i++
  }
  
  if (iterations >= maxIterations) {
    console.warn('⚠️  stripHtml reached iteration limit')
  }
  
  return processed.replace(/\n{3,}/g, '\n\n').trim()
}

function loadCookie(): string {
  const envPath = path.resolve(import.meta.dirname, '../.env')
  if (!fs.existsSync(envPath)) {
    console.error('❌ Missing .env file')
    console.error('   Create .env with FORUM_COOKIE="..." (see .env.example)')
    process.exit(1)
  }
  const content = fs.readFileSync(envPath, 'utf-8')
  const match = content.match(/FORUM_COOKIE=["'](.+?)["']\s*$/)
  if (!match) {
    console.error('❌ FORUM_COOKIE not found in .env')
    console.error('   Add FORUM_COOKIE="..." to your .env file')
    process.exit(1)
  }
  return match[1]
}

// ─── Guest Stub ───────────────────────────────────────────────────────────────

interface GuestStub {
  name: string
  slug: string
  type: EntryType
  forumUrl: string
  messageId: string
  elements: string[]
  traits: string[]
  letter: string
}

// ─── Bracket code parser ─────────────────────────────────────────────────────

const KNOWN_TRAITS = new Set(['A/C', 'ALA', 'N/A', 'SHR', 'W/S'])

function parseBracketCodes(raw: string): { elements: string[]; traits: string[] } {
  const elements: string[] = []
  const traits: string[] = []
  const bracketRegex = /\[([A-Z?/]+)\]/g
  let m: RegExpExecArray | null
  while ((m = bracketRegex.exec(raw)) !== null) {
    const code = m[1]
    if (KNOWN_TRAITS.has(code)) traits.push(code)
    else elements.push(code)
  }
  return { elements, traits }
}

// ─── Guest Stats Parsing ──────────────────────────────────────────────────────

function parseGuestStats(html: string, guestName: string): GuestStats {
  const DEBUG = process.env.DEBUG_STATS === '1'
  const stats: GuestStats = {}
  
  if (DEBUG) console.log(`\n[DEBUG] Parsing stats for ${guestName}`)
  
  // Extract Basic Info (Level, Damage, Damage Type, Element, HP, MP)
  const levelMatch = html.match(/<b>Level:<\/b>\s*([^<\n]+)/i)
  if (levelMatch) {
    stats.level = levelMatch[1].trim()
    if (DEBUG) console.log(`  Level: ${stats.level}`)
  }
  
  const damageMatch = html.match(/<b>Damage:<\/b>\s*([^<\n]+)/i)
  if (damageMatch) {
    stats.damage = damageMatch[1].trim()
    if (DEBUG) console.log(`  Damage: ${stats.damage}`)
  }
  
  const damageTypeMatch = html.match(/<b>Damage Type:<\/b>\s*(Melee|Magic|Pierce)/i)
  if (damageTypeMatch) {
    stats.damageType = damageTypeMatch[1] as 'Melee' | 'Magic' | 'Pierce'
    if (DEBUG) console.log(`  Damage Type: ${stats.damageType}`)
  }
  
  const elementMatch = html.match(/<b>Element:<\/b>\s*([^<\n]+)/i)
  if (elementMatch) {
    stats.element = elementMatch[1].trim()
    if (DEBUG) console.log(`  Element: ${stats.element}`)
  }
  
  const hpMatch = html.match(/<b>HP:<\/b>\s*([^<\n]+)/i)
  if (hpMatch) {
    stats.hp = hpMatch[1].trim()
    if (DEBUG) console.log(`  HP: ${stats.hp}`)
  }
  
  const mpMatch = html.match(/<b>MP:<\/b>\s*([^<\n]+)/i)
  if (mpMatch) {
    stats.mp = mpMatch[1].trim()
    if (DEBUG) console.log(`  MP: ${stats.mp}`)
  }
  
  // Parse Stats section (STR, DEX, INT, CHA, LUK, END, WIS)
  const statsSection = html.match(/<b><u>Stats<\/u><\/b>([\s\S]*?)(?=<b><u>|$)/i)
  if (statsSection) {
    if (DEBUG) console.log(`  Found Stats section`)
    const characterStats: typeof stats.characterStats = {}
    
    const strMatch = statsSection[1].match(/<b>STR:<\/b>\s*([^<\n]+)/i)
    if (strMatch) characterStats.str = strMatch[1].trim()
    
    const dexMatch = statsSection[1].match(/<b>DEX:<\/b>\s*([^<\n]+)/i)
    if (dexMatch) characterStats.dex = dexMatch[1].trim()
    
    const intMatch = statsSection[1].match(/<b>INT:<\/b>\s*([^<\n]+)/i)
    if (intMatch) characterStats.int = intMatch[1].trim()
    
    const chaMatch = statsSection[1].match(/<b>CHA:<\/b>\s*([^<\n]+)/i)
    if (chaMatch) characterStats.cha = chaMatch[1].trim()
    
    const lukMatch = statsSection[1].match(/<b>LUK:<\/b>\s*([^<\n]+)/i)
    if (lukMatch) characterStats.luk = lukMatch[1].trim()
    
    const endMatch = statsSection[1].match(/<b>END:<\/b>\s*([^<\n]+)/i)
    if (endMatch) characterStats.end = endMatch[1].trim()
    
    const wisMatch = statsSection[1].match(/<b>WIS:<\/b>\s*([^<\n]+)/i)
    if (wisMatch) characterStats.wis = wisMatch[1].trim()
    
    if (Object.keys(characterStats).length > 0) {
      stats.characterStats = characterStats
      if (DEBUG) console.log(`    Found ${Object.keys(characterStats).length} character stats`)
    }
  }
  
  // Parse Offense section
  const offenseSection = html.match(/<b><u>Offense<\/u><\/b>([\s\S]*?)(?=<b><u>|$)/i)
  if (offenseSection) {
    if (DEBUG) console.log(`  Found Offense section`)
    const offense: typeof stats.offense = {}
    
    const boostMatch = offenseSection[1].match(/<b>Boost:<\/b>\s*([^<\n]+)/i)
    if (boostMatch) offense.boost = boostMatch[1].trim()
    
    const bonusMatch = offenseSection[1].match(/<b>Bonus:<\/b>\s*([^<\n]+)/i)
    if (bonusMatch) offense.bonus = bonusMatch[1].trim()
    
    const critMatch = offenseSection[1].match(/<b>Crit:<\/b>\s*([^<\n]+)/i)
    if (critMatch) offense.crit = critMatch[1].trim()
    
    if (Object.keys(offense).length > 0) {
      stats.offense = offense
      if (DEBUG) console.log(`    Found ${Object.keys(offense).length} offense stats`)
    }
  }
  
  // Parse Damage Multipliers section
  const dmgMultSection = html.match(/<b><u>Damage Multipliers<\/u><\/b>([\s\S]*?)(?=<b><u>|$)/i)
  if (dmgMultSection) {
    if (DEBUG) console.log(`  Found Damage Multipliers section`)
    const damageMultipliers: typeof stats.damageMultipliers = {}
    
    const nonCritMatch = dmgMultSection[1].match(/<b>Non-Crit:<\/b>\s*([^<\n]+)/i)
    if (nonCritMatch) damageMultipliers.nonCrit = nonCritMatch[1].trim()
    
    const dexMatch = dmgMultSection[1].match(/<b>Dex:<\/b>\s*([^<\n]+)/i)
    if (dexMatch) damageMultipliers.dex = dexMatch[1].trim()
    
    const dotMatch = dmgMultSection[1].match(/<b>DoT:<\/b>\s*([^<\n]+)/i)
    if (dotMatch) damageMultipliers.dot = dotMatch[1].trim()
    
    const critMatch = dmgMultSection[1].match(/<b>Crit:<\/b>\s*([^<\n]+)/i)
    if (critMatch) damageMultipliers.crit = critMatch[1].trim()
    
    if (Object.keys(damageMultipliers).length > 0) {
      stats.damageMultipliers = damageMultipliers
      if (DEBUG) console.log(`    Found ${Object.keys(damageMultipliers).length} damage multipliers`)
    }
  }
  
  // Parse Defense section
  const defenseSection = html.match(/<b><u>Defense<\/u><\/b>([\s\S]*?)(?=<b><u>|$)/i)
  if (defenseSection) {
    if (DEBUG) console.log(`  Found Defense section`)
    const defense: typeof stats.defense = {}
    
    const meleeMatch = defenseSection[1].match(/<b>Melee:<\/b>\s*([^<\n]+)/i)
    if (meleeMatch) defense.melee = meleeMatch[1].trim()
    
    const pierceMatch = defenseSection[1].match(/<b>Pierce:<\/b>\s*([^<\n]+)/i)
    if (pierceMatch) defense.pierce = pierceMatch[1].trim()
    
    const magicMatch = defenseSection[1].match(/<b>Magic:<\/b>\s*([^<\n]+)/i)
    if (magicMatch) defense.magic = magicMatch[1].trim()
    
    const blockMatch = defenseSection[1].match(/<b>Block:<\/b>\s*([^<\n]+)/i)
    if (blockMatch) defense.block = blockMatch[1].trim()
    
    const parryMatch = defenseSection[1].match(/<b>Parry:<\/b>\s*([^<\n]+)/i)
    if (parryMatch) defense.parry = parryMatch[1].trim()
    
    const dodgeMatch = defenseSection[1].match(/<b>Dodge:<\/b>\s*([^<\n]+)/i)
    if (dodgeMatch) defense.dodge = dodgeMatch[1].trim()
    
    if (Object.keys(defense).length > 0) {
      stats.defense = defense
      if (DEBUG) console.log(`    Found ${Object.keys(defense).length} defense stats`)
    }
  }
  
  // Parse Damage Reduction section
  const dmgRedSection = html.match(/<b><u>Damage Reduction<\/u><\/b>([\s\S]*?)(?=<b><u>|$)/i)
  if (dmgRedSection) {
    if (DEBUG) console.log(`  Found Damage Reduction section`)
    const damageReduction: typeof stats.damageReduction = {}
    
    const nonCritMatch = dmgRedSection[1].match(/<b>Non-Crit:<\/b>\s*([^<\n]+)/i)
    if (nonCritMatch) damageReduction.nonCrit = nonCritMatch[1].trim()
    
    const dotMatch = dmgRedSection[1].match(/<b>DoT:<\/b>\s*([^<\n]+)/i)
    if (dotMatch) damageReduction.dot = dotMatch[1].trim()
    
    const critMatch = dmgRedSection[1].match(/<b>Crit:<\/b>\s*([^<\n]+)/i)
    if (critMatch) damageReduction.crit = critMatch[1].trim()
    
    if (Object.keys(damageReduction).length > 0) {
      stats.damageReduction = damageReduction
      if (DEBUG) console.log(`    Found ${Object.keys(damageReduction).length} damage reduction stats`)
    }
  }
  
  // Parse Resistances section
  const resistSection = html.match(/<b><u>Resistances<\/u><\/b>([\s\S]*?)(?=<b><u>|$)/i)
  if (resistSection) {
    if (DEBUG) console.log(`  Found Resistances section`)
    const text = stripHtml(decodeHTML(resistSection[1]))
    
    // If just "None", skip it
    if (!/^none$/i.test(text.trim())) {
      const resistances: Record<string, string> = {}
      
      // Parse lines like "Fire: +10" or "Ice +5"
      const lines = text.split('\n').filter(l => l.trim().length > 0)
      for (const line of lines) {
        const match = line.match(/([A-Za-z]+):?\s*([+-]?\d+%?)/i)
        if (match) {
          resistances[match[1]] = match[2]
        }
      }
      
      if (Object.keys(resistances).length > 0) {
        stats.resistances = resistances
        if (DEBUG) console.log(`    Found ${Object.keys(resistances).length} resistances`)
      }
    }
  }
  
  if (DEBUG) console.log(`[DEBUG] Stats parsing complete\n`)
  
  return stats
}

// ─── Attack Parsing with Button Image URLs ───────────────────────────────────

const DFPEDIA_BASE = 'https://github.com/DF-Pedia/DF-Pedia/raw/master'
const DEFAULT_ATTACK_URL = `${DFPEDIA_BASE}/classes_abilities/Attack.png`

function generateButtonImageUrl(guestName: string, attackName: string, index: number): string | undefined {
  // Skip attack named "Skip"
  if (attackName.toLowerCase() === 'skip') return undefined
  
  // Default Attack skill uses shared image
  if (attackName === 'Attack') return DEFAULT_ATTACK_URL
  
  // Sanitize names for URL
  const sanitizedGuest = guestName.replace(/[^a-zA-Z0-9]/g, '')
  const sanitizedAttack = attackName.replace(/[^a-zA-Z0-9]/g, '')
  const buttonNum = String(index).padStart(2, '0')
  
  return `${DFPEDIA_BASE}/pets_guests/${sanitizedGuest}-Button${buttonNum}-${sanitizedAttack}.png`
}

function parseGuestAttacks(html: string, guestName: string): GuestAttack[] {
  const DEBUG = process.env.DEBUG_ATTACKS === '1'
  const attacks: GuestAttack[] = []
  
  if (DEBUG) console.log(`\n[DEBUG] Parsing attacks for ${guestName}`)
  
  // Attacks are marked with <font size='2'><b>Attack Name</b></font> and separated by <hr>
  // Find the section between Resistances and Other information
  // Use a more precise pattern that stops at the FIRST occurrence of Other information
  const attacksSection = html.match(/<b><u>Resistances<\/u><\/b>([\s\S]*?)<b><u>Other information<\/u><\/b>/i)
  
  if (!attacksSection) {
    if (DEBUG) console.log(`  No attacks section found`)
    return attacks
  }
  
  const section = attacksSection[1]
  
  // Split by <hr> to get individual attack blocks
  const blocks = section.split(/<hr>/i)
  
  let buttonIndex = 1
  
  for (const block of blocks) {
    if (!block.trim()) continue
    
    // Look for attack name in <font size='2'><b>Name</b></font> format
    const nameMatch = block.match(/<font\s+size=['"]2['"]><b>([^<]+)<\/b><\/font>/i)
    if (!nameMatch) {
      if (DEBUG) console.log(`  Skipped block (no attack name): ${block.slice(0, 50)}...`)
      continue
    }
    
    const name = decodeHTML(nameMatch[1]).trim()
    
    // Skip "Skip" attack
    if (name.toLowerCase() === 'skip') {
      if (DEBUG) console.log(`  Skipped attack: ${name}`)
      continue
    }
    
    // Skip blocks that look like forum metadata or navigation
    if (name.toLowerCase().includes('logged in') || 
        name.toLowerCase().includes('post #') ||
        /^[a-z0-9_]+$/i.test(name) && name.length > 15) {
      if (DEBUG) console.log(`  Skipped junk block: ${name}`)
      continue
    }
    
    // Extract italic description
    const italicMatch = block.match(/<i>([^<]+)<\/i>/)
    let description = italicMatch ? decodeHTML(italicMatch[1]).trim() : ''
    
    // Extract structured fields
    const fields: Record<string, string> = {}
    
    const requirementsMatch = block.match(/<b>Requirements:<\/b>\s*([^<]+(?:<[^>]+>[^<]*)*?)(?=\s*<br>\s*<br>|\s*<br>\s*<b>)/i)
    if (requirementsMatch) {
      fields.requirements = stripHtml(decodeHTML(requirementsMatch[1])).trim()
    }
    
    const effectMatch = block.match(/<b>Effect:<\/b>\s*([\s\S]*?)(?=<br>\s*<b>Mana Cost|<br>\s*<img|$)/i)
    if (effectMatch) {
      fields.effect = stripHtml(decodeHTML(effectMatch[1])).trim()
    }
    
    const manaCostMatch = block.match(/<b>Mana Cost:<\/b>\s*([^<\n]+)/i)
    if (manaCostMatch) {
      fields.manaCost = decodeHTML(manaCostMatch[1]).trim()
    }
    
    const cooldownMatch = block.match(/<b>Cooldown:<\/b>\s*([^<\n]+)/i)
    if (cooldownMatch) {
      fields.cooldown = decodeHTML(cooldownMatch[1]).trim()
    }
    
    const damageTypeMatch = block.match(/<b>Damage Type:<\/b>\s*([^<\n]+)/i)
    if (damageTypeMatch) {
      fields.damageType = decodeHTML(damageTypeMatch[1]).trim()
    }
    
    const elementMatch = block.match(/<b>Element:<\/b>\s*([^<\n]+)/i)
    if (elementMatch) {
      fields.element = decodeHTML(elementMatch[1]).trim()
    }
    
    // Build full description
    let fullDescription = description
    if (Object.keys(fields).length > 0) {
      const fieldLines = []
      if (fields.requirements) fieldLines.push(`Requirements: ${fields.requirements}`)
      if (fields.effect) fieldLines.push(`Effect: ${fields.effect}`)
      if (fields.manaCost) fieldLines.push(`Mana Cost: ${fields.manaCost}`)
      if (fields.cooldown) fieldLines.push(`Cooldown: ${fields.cooldown}`)
      if (fields.damageType) fieldLines.push(`Damage Type: ${fields.damageType}`)
      if (fields.element) fieldLines.push(`Element: ${fields.element}`)
      
      if (fieldLines.length > 0) {
        fullDescription += (fullDescription ? '\n\n' : '') + fieldLines.join('\n')
      }
    }
    
    // Determine order
    const order = name === 'Attack' ? 0 : buttonIndex++
    
    // Generate button image URL
    const buttonImageUrl = generateButtonImageUrl(guestName, name, buttonIndex - 1)
    
    if (DEBUG) {
      console.log(`  Attack: ${name}`)
      console.log(`    Order: ${order}`)
      console.log(`    Button URL: ${buttonImageUrl}`)
      console.log(`    Description: ${fullDescription.slice(0, 80)}...`)
    }
    
    attacks.push({
      name,
      description: fullDescription,
      order,
      buttonImageUrl,
    })
  }
  
  // Sort by order
  attacks.sort((a, b) => a.order - b.order)
  
  if (DEBUG) console.log(`[DEBUG] Found ${attacks.length} attacks\n`)
  
  return attacks
}

// ─── Category Tag Detection ───────────────────────────────────────────────────

interface CategoryTags {
  isTemp?: boolean
  isRare?: boolean
  isSeasonal?: boolean
  isSpecialOffer?: boolean
  retired?: boolean
}

function detectCategoryTags(html: string): CategoryTags {
  const DEBUG = process.env.DEBUG_TAGS === '1'
  const tags: CategoryTags = {}
  
  if (DEBUG) console.log(`\n[DEBUG] Detecting category tags`)
  
  if (/<img[^>]+src=["'][^"']*\/tags\/Temp\.png["']/i.test(html)) {
    tags.isTemp = true
    if (DEBUG) console.log(`  Found: Temp`)
  }
  
  if (/<img[^>]+src=["'][^"']*\/tags\/Rare\.jpg["']/i.test(html)) {
    tags.isRare = true
    if (DEBUG) console.log(`  Found: Rare`)
  }
  
  if (/<img[^>]+src=["'][^"']*\/tags\/Seasonal\.jpg["']/i.test(html)) {
    tags.isSeasonal = true
    if (DEBUG) console.log(`  Found: Seasonal`)
  }
  
  if (/<img[^>]+src=["'][^"']*\/tags\/SpecialOffer\.png["']/i.test(html)) {
    tags.isSpecialOffer = true
    if (DEBUG) console.log(`  Found: SpecialOffer`)
  }
  
  if (/<img[^>]+src=["'][^"']*\/tags\/Retired\.png["']/i.test(html)) {
    tags.retired = true
    if (DEBUG) console.log(`  Found: Retired`)
  }
  
  if (DEBUG) console.log(`[DEBUG] Found ${Object.keys(tags).length} category tags\n`)
  
  return tags
}

// ─── Image Extraction ─────────────────────────────────────────────────────────

function extractGuestImages(html: string, guestName: string): { imageUrl?: string; alternativeImages: Array<{ url: string; caption?: string }> } {
  const DEBUG = process.env.DEBUG_IMAGES === '1'
  
  if (DEBUG) console.log(`\n[DEBUG] Extracting images for ${guestName}`)
  
  // Extract images BEFORE "Appearance" section (skills come after)
  const appearanceMatch = html.match(/<b><u>Appearance<\/u><\/b>/i)
  const htmlBeforeAppearance = appearanceMatch ? html.slice(0, appearanceMatch.index) : html
  
  // Skip patterns for UI/tag/button/attack images
  const skipPatterns = [
    /\/f\/image\//i,
    /forumheader/i,
    /quantserve/i,
    /artix\.com\/shared/i,
    /artixgamelaunch/i,
    /\/tags\//i,
    /clear\.gif/i,
    /blank\.gif/i,
    /button/i,
    /-button/i,
    /attack\.png/i,
    /attack\.jpg/i,
  ]
  
  // Extract image URLs from <img> tags
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
  let imgMatch: RegExpExecArray | null
  const candidates: string[] = []
  
  while ((imgMatch = imgRegex.exec(htmlBeforeAppearance)) !== null) {
    const src = imgMatch[1]
    
    // Skip if matches any skip pattern
    if (skipPatterns.some(p => p.test(src))) continue
    
    // Collect valid image sources
    if (src.includes('imgur.com') || 
        src.includes('i.imgur.com') ||
        src.includes('battleon.com/encyc') ||
        src.includes('artix.com/encyc') ||
        src.includes('github.com') ||
        src.includes('githubusercontent.com') ||
        (src.includes('/f/upfiles/') && src.length > 60)) {
      candidates.push(src)
    }
  }
  
  // Also extract bare image URLs from text (not wrapped in <img> tags)
  const bareUrlRegex = /https?:\/\/(?:[^\s<>"]+?)\.(?:jpg|jpeg|png|gif)/gi
  let urlMatch: RegExpExecArray | null
  
  while ((urlMatch = bareUrlRegex.exec(htmlBeforeAppearance)) !== null) {
    const url = urlMatch[0]
    
    // Skip if matches any skip pattern
    if (skipPatterns.some(p => p.test(url))) continue
    
    // Only include valid sources
    if (url.includes('imgur.com') || 
        url.includes('i.imgur.com') ||
        url.includes('github.com') || 
        url.includes('githubusercontent.com') ||
        url.includes('artix.com/encyc') ||
        url.includes('battleon.com/encyc')) {
      // Avoid duplicates
      if (!candidates.includes(url)) {
        candidates.push(url)
      }
    }
  }
  
  if (DEBUG) {
    console.log(`  Found ${candidates.length} image candidates`)
    candidates.forEach((c, i) => console.log(`    [${i}] ${c}`))
  }
  
  // First image is main, rest are alternatives
  const imageUrl = candidates.length > 0 ? candidates[0] : undefined
  const alternativeImages: Array<{ url: string; caption?: string }> = []
  
  // Extract alternatives with captions
  for (let i = 1; i < candidates.length; i++) {
    const url = candidates[i]
    
    // Look for caption near this image
    const imgPos = htmlBeforeAppearance.indexOf(url)
    if (imgPos >= 0) {
      const beforeImg = htmlBeforeAppearance.slice(Math.max(0, imgPos - 200), imgPos)
      
      // Try to find caption patterns
      const boldMatch = beforeImg.match(/<b>([^<]+)<\/b>\s*$/i)
      if (boldMatch) {
        const caption = stripHtml(decodeHTML(boldMatch[1])).trim()
        alternativeImages.push({ url, caption })
        continue
      }
      
      // Plain text caption
      const plainMatch = beforeImg.match(/([A-Z][a-z\s]+)\s*$/i)
      if (plainMatch && plainMatch[1].length < 50) {
        const caption = plainMatch[1].trim()
        if (caption.length > 3 && /^[A-Z]/.test(caption)) {
          alternativeImages.push({ url, caption })
          continue
        }
      }
    }
    
    // No caption found - use generic
    alternativeImages.push({ url, caption: 'Alternative Image' })
  }
  
  if (DEBUG) {
    console.log(`  Main image: ${imageUrl || 'none'}`)
    console.log(`  Alternative images: ${alternativeImages.length}`)
    alternativeImages.forEach((alt, i) => console.log(`    [${i}] ${alt.url} (${alt.caption || 'no caption'})`))
  }
  
  return { imageUrl, alternativeImages }
}

// ─── Description Parsing ──────────────────────────────────────────────────────

function parseDescription(html: string, guestName: string): string {
  const DEBUG = process.env.DEBUG_DESC === '1'
  
  if (DEBUG) console.log(`\n[DEBUG] Parsing description for ${guestName}`)
  
  // Look for italic text right after the guest name header
  // Pattern: <b><font size='3'>GuestName</font></b> <br> <i>Description</i>
  // Use a more flexible pattern that handles special characters in guest names
  const escapedName = guestName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  
  // Try flexible pattern that allows whitespace variations and optional attributes
  const patterns = [
    // Exact format with size attribute
    new RegExp(`<b><font\\s+size=['"]3['"]>${escapedName}</font></b>\\s*<br>\\s*<i>([^<]+)</i>`, 'i'),
    // Without size attribute
    new RegExp(`<b><font[^>]*>${escapedName}</font></b>\\s*<br>\\s*<i>([^<]+)</i>`, 'i'),
    // Allow extra spaces
    new RegExp(`<b>\\s*<font[^>]*>\\s*${escapedName}\\s*</font>\\s*</b>\\s*<br>\\s*<i>([^<]+)</i>`, 'i'),
  ]
  
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match) {
      const desc = decodeHTML(match[1]).trim()
      if (desc && desc.length > 2 && !desc.toLowerCase().includes('edit:')) {
        if (DEBUG) console.log(`  Found italic description: ${desc}`)
        return desc
      }
    }
  }
  
  if (DEBUG) console.log(`  No description found, using default`)
  const isTemp = /<img[^>]+src=["'][^"']*\/tags\/Temp\.png["']/i.test(html)
  return isTemp ? `A temporary guest companion.` : `A guest companion in DragonFable.`
}

// ─── Obtain Methods Parsing ───────────────────────────────────────────────────

function parseObtainMethods(html: string, guestName: string): ObtainMethod[] {
  const DEBUG = process.env.DEBUG_OBTAIN === '1'
  
  if (DEBUG) console.log(`\n[DEBUG] Parsing obtain methods for ${guestName}`)
  
  const obtainMethods: ObtainMethod[] = []
  
  // Parse Location - capture everything up to the next <br> or field
  const locationMatch = html.match(/<b>Location:<\/b>\s*([^<]+(?:<a[^>]*>[^<]*<\/a>[^<]*)*?)(?=\s*<br>\s*<b>)/i)
  const location = locationMatch ? stripHtml(decodeHTML(locationMatch[1])).trim() : undefined
  
  // Parse Requirements - capture only up to first <br> to avoid capturing stats blocks
  // Pattern: match text up to a line break OR next <b> tag
  const requirementsMatch = html.match(/<b>Requirements:<\/b>\s*([^<\n]+?)(?=\s*<br|\s*<b>)/i)
  const requirements = requirementsMatch ? decodeHTML(requirementsMatch[1]).trim() : undefined
  
  // Parse Price (optional - many guests are Temp and don't have prices)
  const priceMatch = html.match(/<b>Price:<\/b>\s*([^<\n]+)/i)
  const price = priceMatch ? decodeHTML(priceMatch[1]).trim() : undefined
  
  // Parse Sellback (optional)
  const sellbackMatch = html.match(/<b>Sellback:<\/b>\s*([^<\n]+)/i)
  const sellback = sellbackMatch ? decodeHTML(sellbackMatch[1]).trim() : undefined
  
  // Parse Required Items (for merge shops)
  const requiredMatch = html.match(/<b>(?:Required|Requires):<\/b>\s*([^<\n]+)/i)
  const requiredItems = requiredMatch ? decodeHTML(requiredMatch[1]).trim() : undefined
  
  // Guests must have at least a location to be valid
  if (location) {
    // Determine price type
    let priceType: ObtainMethod['priceType'] = 'free'
    if (price) {
      priceType = computePriceType(price, requiredItems)
    } else if (requiredItems) {
      priceType = 'merge'
    }
    
    // Check for DA requirement near the location/price
    // Look within 300 chars before and after the Location field
    const locationIndex = html.search(/<b>Location:<\/b>/i)
    const contextStart = Math.max(0, locationIndex - 300)
    const contextEnd = Math.min(html.length, locationIndex + 600)
    const context = html.slice(contextStart, contextEnd)
    
    const daRequired = /<img[^>]+src=["'][^"']*\/tags\/DA\.png["']/i.test(context)
    const dcRequired = priceType === 'dc' || /<img[^>]+src=["'][^"']*\/tags\/DC\.png["']/i.test(context)
    const dmRequired = priceType === 'dm' || /<img[^>]+src=["'][^"']*\/tags\/DM\.png["']/i.test(context)
    
    const method: ObtainMethod = {
      location,
      priceType,
    }
    
    if (requirements) method.requirements = requirements
    if (price) method.price = price
    if (sellback) method.sellback = sellback
    if (requiredItems) method.requiredItems = requiredItems
    if (daRequired) method.daRequired = daRequired
    if (dcRequired) method.dcRequired = dcRequired
    if (dmRequired) method.dmRequired = dmRequired
    
    obtainMethods.push(method)
    
    if (DEBUG) {
      console.log(`  Location: ${location}`)
      if (requirements) console.log(`  Requirements: ${requirements}`)
      if (price) console.log(`  Price: ${price} (${priceType})`)
      if (sellback) console.log(`  Sellback: ${sellback}`)
      if (requiredItems) console.log(`  Required Items: ${requiredItems}`)
      console.log(`  DA: ${daRequired}, DC: ${dcRequired}, DM: ${dmRequired}`)
    }
  } else {
    if (DEBUG) console.log(`  No location field found`)
  }
  
  if (DEBUG) console.log(`[DEBUG] Found ${obtainMethods.length} obtain methods\n`)
  
  return obtainMethods
}

// Helper: Compute price type from price string and required items
function computePriceType(price: string, requiredItems?: string): ObtainMethod['priceType'] {
  const p = price.toLowerCase()
  
  if (p.includes('dragon coin') || p.includes(' dc')) return 'dc'
  if (p.includes("defender's medal") || p.includes('defender medal') || p.includes(' dm')) return 'dm'
  if (p === '0 gold' || p === 'free' || p === 'n/a') {
    if (requiredItems && requiredItems.trim().length > 0) return 'merge'
    return 'free'
  }
  if (p.includes('gold')) return 'gold'
  
  // Default: if has required items, it's merge; otherwise gold
  return requiredItems && requiredItems.trim().length > 0 ? 'merge' : 'gold'
}

// ─── Notes Parsing ────────────────────────────────────────────────────────────

function parseNotes(html: string, guestName: string): string | undefined {
  const DEBUG = process.env.DEBUG_NOTES === '1'
  
  if (DEBUG) console.log(`\n[DEBUG] Parsing notes for ${guestName}`)
  
  const noteLines: string[] = []
  
  // Look for "Other information" or "Other Information" section
  const otherInfoMatch = html.match(/<b><u>Other [Ii]nformation<\/u><\/b>([\s\S]*?)(?=<b><u>|Thanks to|Also See|$)/i)
  
  if (otherInfoMatch) {
    if (DEBUG) console.log(`  Found Other Information section`)
    
    const text = stripHtml(decodeHTML(otherInfoMatch[1]))
    const lines = text.split('\n').filter(l => l.trim().length > 0)
    
    for (const line of lines) {
      const trimmed = line.trim()
      
      // Skip edit timestamps
      if (/\w+\s+--\s+\d+\/\d+\/\d+\s+\d+:\d+:\d+/.test(trimmed)) continue
      
      // Skip attribution lines
      if (/^[A-Z][\w'-]+(?:\s+[A-Z][\w'-]+){0,3}\s+for\s+(image|attack|information|entry|corrections)/i.test(trimmed)) continue
      
      // Strip "Note:" prefix
      let processedLine = trimmed.replace(/^Note:\s*/i, '').trim()
      
      if (processedLine.length > 0) {
        noteLines.push(processedLine)
      }
    }
  }
  
  if (noteLines.length > 0) {
    const notes = noteLines.join(' • ')
    if (DEBUG) console.log(`  Found ${noteLines.length} note lines`)
    return notes
  }
  
  if (DEBUG) console.log(`  No notes found`)
  return undefined
}

// ─── Also See Parsing ─────────────────────────────────────────────────────────

function parseAlsoSee(html: string, nameToSlug: Map<string, { slug: string; type: EntryType }>, guestName: string): AlsoSeeRef[] {
  const DEBUG = process.env.DEBUG_ALSOSEE === '1'
  
  if (DEBUG) console.log(`\n[DEBUG] Parsing Also See for ${guestName}`)
  
  const alsoSee: AlsoSeeRef[] = []
  
  // Look for "Also See:" section
  const alsoSeeMatch = html.match(/Also See:\s*([\s\S]*?)(?=<br><br>|Thanks to|$)/i)
  
  if (alsoSeeMatch) {
    if (DEBUG) console.log(`  Found Also See section`)
    
    const text = stripHtml(decodeHTML(alsoSeeMatch[1]))
    const lines = text.split('\n').filter(l => l.trim().length > 0)
    
    for (const line of lines) {
      const trimmed = line.trim().replace(/^[•\-\*]\s*/, '')
      
      // Try to resolve name to slug
      const key = trimmed.toLowerCase()
      const resolved = nameToSlug.get(key)
      
      if (resolved) {
        alsoSee.push({
          name: trimmed,
          slug: resolved.slug,
          type: resolved.type,
        })
        
        if (DEBUG) console.log(`  Resolved: ${trimmed} → ${resolved.slug} (${resolved.type})`)
      } else {
        if (DEBUG) console.log(`  Unresolved: ${trimmed}`)
      }
    }
  }
  
  if (DEBUG) console.log(`[DEBUG] Found ${alsoSee.length} also see references\n`)
  
  return alsoSee
}

// ─── Generate Search Tags ─────────────────────────────────────────────────────

function generateTags(name: string, description: string, elements: string[]): string[] {
  // Simple tag generation: lowercase words from name + elements
  const nameParts = name.toLowerCase().split(/\s+/).filter(w => w.length > 2)
  const descParts = description.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 5)
  const elementTags = elements.map(e => e.toLowerCase())
  
  const tags = [...new Set([...nameParts, ...descParts, ...elementTags])]
  return tags
}

// ─── Chronology parsing ───────────────────────────────────────────────────────

function parseChronology(html: string): Map<string, string> {
  const DEBUG = process.env.DEBUG_CHRONO === '1'
  const dates = new Map<string, string>()
  const lines = stripHtml(decodeHTML(html)).split('\n')
  
  if (DEBUG) {
    console.log(`\n[DEBUG] Parsing Chronology (${lines.length} lines)`)
    console.log(`  First 20 lines:`)
    lines.slice(0, 20).forEach((line, i) => {
      console.log(`    ${i}: ${line.slice(0, 80)}`)
    })
  }
  
  let currentDate = ''
  
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    
    // Check if this is a date line: "Month DDth, YYYY" or "Month DD, YYYY"
    const dateMatch = trimmed.match(/^([A-Z][a-z]+\s+\d+(?:st|nd|rd|th)?,\s+\d{4})$/)
    if (dateMatch) {
      currentDate = dateMatch[1]
      if (DEBUG) console.log(`  Found date: ${currentDate}`)
      continue
    }
    
    // Check if this is a guest entry line: "[G] Guest Name"
    const guestMatch = trimmed.match(/^\[G\]\s+(.+)$/)
    if (guestMatch && currentDate) {
      let name = guestMatch[1].trim()
      
      // Strip trailing parentheticals like "(2)" or "(Normal; D-Coins)"
      name = name.replace(/\s*\([^)]+\)\s*$/, '').trim()
      
      dates.set(name.toLowerCase(), currentDate)
      
      if (DEBUG) console.log(`  Found guest: ${name} (${currentDate})`)
    }
  }
  
  if (DEBUG) console.log(`[DEBUG] Chronology parsing found ${dates.size} guests\n`)
  
  return dates
}

// ─── A-Z page parsing ─────────────────────────────────────────────────────────

function parseAZPage(html: string, guestNames: Set<string>): GuestStub[] {
  const stubs: GuestStub[] = []
  const seen = new Set<string>()
  const chunks = html.split(/<br\s*\/?>/)
  let currentLetter = '#'
  let skippedCount = 0

  for (const chunk of chunks) {
    const text = stripHtml(decodeHTML(chunk)).trim()

    // Detect letter headings
    if (/^[A-Z#]$/.test(text)) {
      currentLetter = text
      continue
    }

    // Match links
    const linkMatch = /href=["']?(?:https?:\/\/forums2\.battleon\.com\/f\/)?tm\.asp\?m=(\d+)["'\s>]/i.exec(chunk)
    if (!linkMatch) continue
    const msgId = linkMatch[1]
    if (seen.has(msgId)) {
      skippedCount++
      continue
    }
    seen.add(msgId)

    // Elements/traits appear BEFORE the <a> tag
    const { elements, traits } = parseBracketCodes(chunk)

    // Extract anchor text
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
    
    // Skip navigation/meta links
    if (name.toLowerCase().includes('chronology') || 
        name.toLowerCase().includes('a-z') ||
        name.toLowerCase() === 'pets' ||
        name.toLowerCase() === 'guests') {
      skippedCount++
      continue
    }

    // Filter: only include guests (determined by Chronology)
    const key = name.toLowerCase()
    const baseKey = name.replace(/\s*\([^)]+\)\s*$/, '').trim().toLowerCase()
    if (!guestNames.has(key) && !guestNames.has(baseKey)) {
      continue  // Not a guest, skip silently
    }

    stubs.push({
      name,
      slug: prefixedSlug(name, 'guest'),
      type: 'guest',
      forumUrl: `${FORUM_BASE}/tm.asp?m=${msgId}`,
      messageId: msgId,
      elements,
      traits,
      letter: currentLetter,
    })
  }
  
  if (skippedCount > 0) {
    console.log(`   ⚠️  Skipped ${skippedCount} entries (duplicates, navigation links, or invalid names)`)
  }

  return stubs
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('🎯 DragonFable Guests Scraper\n')

  const cookie = loadCookie()
  const startTime = Date.now()

  // ── Step 1: Fetch Chronology ──────────────────────────────────────────────

  console.log('📅 Fetching Chronology page...')
  let chronoHtml = ''
  try {
    chronoHtml = await fetchPage(CHRONOLOGY_URL, cookie)
  } catch (err) {
    console.warn(`⚠️  Chronology fetch failed: ${err}`)
    console.warn('   Continuing without release dates...')
  }

  const chronoDates = parseChronology(chronoHtml)
  const guestNames = new Set(chronoDates.keys())
  console.log(`✅ Found ${guestNames.size} guests in Chronology\n`)

  // ── Step 2: Fetch A-Z page ─────────────────────────────────────────────────

  console.log('📄 Fetching A-Z Pets & Guests page (filtering for guests)...')
  let azHtml = ''
  try {
    azHtml = await fetchPage(AZ_PETS_URL, cookie)
  } catch (err) {
    console.error(`❌ A-Z page fetch failed: ${err}`)
    process.exit(1)
  }

  let allStubs = parseAZPage(azHtml, guestNames)
  if (allStubs.length === 0) {
    console.error('❌ No guests found in A-Z page')
    const preview = stripHtml(decodeHTML(azHtml)).slice(0, 200)
    console.error('   Page preview:', preview)
    process.exit(1)
  }
  console.log(`✅ Found ${allStubs.length} guests in A-Z listing`)

  // Apply letter filters
  let stubs = allStubs
  if (lettersArg && lettersArg.length > 0) {
    // Filter by multiple letters: --letters=A,B
    stubs = allStubs.filter(s => lettersArg.includes(s.letter))
    console.log(`   Filtered to letters ${lettersArg.join(', ')}: ${stubs.length} entries`)
  } else if (letterArg) {
    // Filter by single letter: --letter=A
    stubs = allStubs.filter(s => s.letter === letterArg)
    console.log(`   Filtered to letter ${letterArg}: ${stubs.length} entries`)
  } else if (startArg) {
    // Resume from letter: --start=C
    let past = false
    stubs = allStubs.filter(s => {
      if (s.letter === startArg) past = true
      return past
    })
    console.log(`   Resuming from ${startArg}: ${stubs.length} entries remaining`)
  }
  console.log()

  // Build name→slug map for ALL guests (needed for cross-reference resolution)
  const nameToSlug = new Map<string, { slug: string; type: EntryType }>()
  for (const stub of allStubs) {
    nameToSlug.set(stub.name.toLowerCase(), { slug: stub.slug, type: stub.type })
    // Also index without trailing parentheticals
    const base = stub.name.replace(/\s*\([^)]+\)\s*$/, '').trim().toLowerCase()
    if (base !== stub.name.toLowerCase()) nameToSlug.set(base, { slug: stub.slug, type: stub.type })
  }

  // ── Step 3: Load existing progress ─────────────────────────────────────────

  const progressMap = new Map<string, Guest | ItemFamily>()
  if (fs.existsSync(PROGRESS_PATH)) {
    try {
      const existing: (Guest | ItemFamily)[] = JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf-8'))
      for (const entry of existing) {
        progressMap.set(entry.slug, entry)
      }
      console.log(`📂 Loaded ${progressMap.size} guests from progress file\n`)
    } catch (err) {
      console.warn(`⚠️  Could not parse progress file: ${err}`)
      console.warn('   Starting with empty progress state...\n')
    }
  }

  // ── Step 4: Scrape guests ──────────────────────────────────────────────────

  console.log(`🔄 Scraping ${stubs.length} guests...\n`)
  
  let scraped = 0
  let fromCache = 0
  let skipped = 0

  for (let i = 0; i < stubs.length; i++) {
    const stub = stubs[i]
    process.stdout.write(`[${i + 1}/${stubs.length}] ${stub.name}... `)

    // Check if already in progress
    if (progressMap.has(stub.slug)) {
      console.log('✓ [cached]')
      fromCache++
      continue
    }

    try {
      const html = await fetchPage(stub.forumUrl, cookie)
      
      // Parse all guest data
      const description = parseDescription(html, stub.name)
      const guestStats = parseGuestStats(html, stub.name)
      const attacks = parseGuestAttacks(html, stub.name)
      const categoryTags = detectCategoryTags(html)
      const { imageUrl, alternativeImages } = extractGuestImages(html, stub.name)
      const obtainMethods = parseObtainMethods(html, stub.name)
      const notes = parseNotes(html, stub.name)
      const alsoSee = parseAlsoSee(html, nameToSlug, stub.name)
      const tags = generateTags(stub.name, description, stub.elements)
      
      // Detect DA/DC/DM requirements at thread level
      const daRequired = /<img[^>]+src=["'][^"']*\/tags\/DA\.png["']/i.test(html)
      const dcRequired = /<img[^>]+src=["'][^"']*\/tags\/DC\.png["']/i.test(html)
      const dmRequired = /<img[^>]+src=["'][^"']*\/tags\/DM\.png["']/i.test(html)
      
      // Parse rarity if present
      const rarityMatch = html.match(/<b>Rarity:<\/b>\s*([^<\n]+)/i)
      const rarity = rarityMatch ? rarityMatch[1].trim() : 'Unknown'
      
      const guest: Guest = {
        id: stub.slug,
        name: stub.name,
        slug: stub.slug,
        type: 'guest',
        description,
        daRequired,
        dcRequired: dcRequired || undefined,
        dmRequired: dmRequired || undefined,
        ...categoryTags,
        elements: stub.elements,
        traits: stub.traits,
        level: guestStats.level || 'Unknown',
        damage: guestStats.damage || 'Unknown',
        stats: guestStats.characterStats ? 'See guestStats' : 'None',
        resists: guestStats.resistances ? 'See guestStats' : 'None',
        obtainMethods,
        attacks,
        rarity,
        evolutions: [],  // Guests typically don't evolve
        releaseDate: chronoDates.get(stub.name.toLowerCase()) || chronoDates.get(stub.name.replace(/\s*\([^)]+\)\s*$/, '').trim().toLowerCase()) || 'Unknown',
        imageUrl,
        forumUrl: stub.forumUrl,
        notes,
        alsoSee,
        tags,
        guestStats,
        alternativeImages: alternativeImages.length > 0 ? alternativeImages : undefined,
      }

      progressMap.set(guest.slug, guest)
      console.log(' ✓')
      scraped++

      // Save progress after every entry
      const progress = Array.from(progressMap.values())
      fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2) + '\n', 'utf-8')

      // Progress update every 10 guests
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

  const finalGuests = Array.from(progressMap.values())
    .sort((a, b) => {
      const aName: string = 'familyName' in a ? a.familyName : a.name
      const bName: string = 'familyName' in b ? b.familyName : b.name
      return aName.localeCompare(bName)
    })

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(finalGuests, null, 2) + '\n', 'utf-8')

  console.log(`\n📁 Written ${finalGuests.length} guests to guests.json`)
  console.log(`📁 Progress file (${progressMap.size} total) saved to guests-progress.json`)
  console.log('\n🎉 Done!')
  console.log('\n📊 Summary:')
  console.log(`   Total stubs:   ${allStubs.length}`)
  console.log(`   In progress:   ${progressMap.size}`)
  console.log(`   Guests:        ${finalGuests.filter(g => g.type === 'guest').length}`)
  console.log(`   With dates:    ${finalGuests.filter(g => 'releaseDate' in g && g.releaseDate !== 'Unknown').length}`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
