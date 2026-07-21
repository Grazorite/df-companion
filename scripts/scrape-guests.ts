/**
 * Guests Scraper — A-Z Master List Strategy (Resumable)
 *
 * This scraper reads the Guests section from the A-Z Pets & Guests master page
 * to build source stubs, then uses Chronology for release-date enrichment.
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
import type {
  Guest,
  GuestAttack,
  GuestCharacterStats,
  GuestDamageMultipliers,
  GuestDamageReduction,
  GuestDefenseStats,
  GuestOffenseStats,
  GuestStats,
  ObtainMethod,
  AlsoSeeRef,
  EntryType,
} from '../src/types/pet.ts'
import type {
  AlternativeImage,
  ItemFamily,
  LevelVariant,
  ObtainVariant,
} from '../src/types/item.ts'
import {
  convertImageTags,
  extractThreadPostContents,
  fetchPrintable,
  fetchThreadPages,
  getPostContent,
  type ThreadPostContent,
} from './lib/printable-parser.ts'
import {
  computeFamilyFlags,
  computePriceType,
  normalizeLevel,
} from '../src/utils/variantHelpers.ts'
import {
  canonicalizePromotedRelationships,
  promoteCrossPostFamilies,
} from './lib/cross-post-family.ts'
import { rephraseTimedSellback } from './lib/obtain-formatting.ts'
import { repairAccessFlags } from './lib/access-flag-repair.ts'
import { compareTitles } from '../src/utils/displayText.ts'

const FORUM_BASE = 'https://forums2.battleon.com/f'
const AZ_PETS_URL = `${FORUM_BASE}/tm.asp?m=22349620&mpage=1` // A-Z Pets & Guests master page
const CHRONOLOGY_URL = `${FORUM_BASE}/tm.asp?m=10738071`
const DELAY_MS = 1000
const OUTPUT_PATH = path.resolve(import.meta.dirname, '../src/data/guests.json')
const PROGRESS_PATH = path.resolve(import.meta.dirname, '../src/data/guests-progress.json')

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const startArg = args
  .find((a) => a.startsWith('--start='))
  ?.split('=')[1]
  ?.toUpperCase()
const letterArg = args
  .find((a) => a.startsWith('--letter='))
  ?.split('=')[1]
  ?.toUpperCase()
const lettersArg = args
  .find((a) => a.startsWith('--letters='))
  ?.split('=')[1]
  ?.toUpperCase()
  .split(',') // Support multiple: --letters=A,B

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchPage(url: string, cookie: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 45000) // 45s timeout
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Cookie: cookie,
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`)
    return res.text()
  } finally {
    clearTimeout(timer)
  }
}

function extractReplyPostContent(html: string, messageId: string): string {
  if (html.includes('This message has been deleted or moved')) {
    return ''
  }

  const anchorRegex = new RegExp(`<a\\s+name=${messageId}\\b[^>]*><\\/a>`, 'i')
  const anchorMatch = anchorRegex.exec(html)
  if (!anchorMatch || anchorMatch.index === undefined) {
    throw new Error(`Could not find reply anchor for message ${messageId}`)
  }

  const slice = html.slice(anchorMatch.index)
  const cellMatch = slice.match(/<td\b[^>]*class=["']?msg["']?[^>]*>([\s\S]*?)<\/td>/i)
  if (!cellMatch) {
    throw new Error(`Could not find reply content block for message ${messageId}`)
  }

  return convertImageTags(cellMatch[1])
}

async function fetchGuestPostContent(messageId: string, cookie: string): Promise<string> {
  try {
    return getPostContent(await fetchPrintable(messageId, cookie))
  } catch (error) {
    if (!(error instanceof Error) || !/HTTP 500/i.test(error.message)) {
      throw error
    }

    const forumHtml = await fetchPage(`${FORUM_BASE}/fb.asp?m=${messageId}`, cookie)
    return extractReplyPostContent(forumHtml, messageId)
  }
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

function directForumPostUrl(_linkPath: string, messageId: string): string {
  return `${FORUM_BASE}/fb.asp?m=${messageId}`
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
      if (/^<[a-zA-Z!/]/.test(nextChars)) {
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

type GuestFamilyVariant = Guest & {
  sourceName: string
  damage: string
  stats: string
  rarity: string
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
  const levelMatch = html.match(/(?:<b>)?Level:(?:<\/b>)?\s*([^<\n]+)/i)
  if (levelMatch) {
    stats.level = levelMatch[1].trim()
    if (DEBUG) console.log(`  Level: ${stats.level}`)
  }

  const damageMatch = html.match(/(?:<b>)?Damage:(?:<\/b>)?\s*([^<\n]+)/i)
  if (damageMatch) {
    stats.damage = damageMatch[1].trim()
    if (DEBUG) console.log(`  Damage: ${stats.damage}`)
  }

  const damageTypeMatch = html.match(/(?:<b>)?Damage Type:(?:<\/b>)?\s*(Melee|Magic|Pierce)/i)
  if (damageTypeMatch) {
    stats.damageType = damageTypeMatch[1] as 'Melee' | 'Magic' | 'Pierce'
    if (DEBUG) console.log(`  Damage Type: ${stats.damageType}`)
  }

  const elementMatch = html.match(/(?:<b>)?Element:(?:<\/b>)?\s*([^<\n]+)/i)
  if (elementMatch) {
    stats.element = elementMatch[1].trim()
    if (DEBUG) console.log(`  Element: ${stats.element}`)
  }

  const hpMatch = html.match(/(?:<b>)?HP:(?:<\/b>)?\s*([^<\n]+)/i)
  if (hpMatch) {
    stats.hp = hpMatch[1].trim()
    if (DEBUG) console.log(`  HP: ${stats.hp}`)
  }

  const mpMatch = html.match(/(?:<b>)?MP:(?:<\/b>)?\s*([^<\n]+)/i)
  if (mpMatch) {
    stats.mp = mpMatch[1].trim()
    if (DEBUG) console.log(`  MP: ${stats.mp}`)
  }

  // Parse Stats section (STR, DEX, INT, CHA, LUK, END, WIS) - may or may not have <b> tags
  const statsSection = html.match(/(?:<b>)?<u>Stats<\/u>(?:<\/b>)?([\s\S]*?)(?=<u>|<hr>|$)/i)
  if (statsSection) {
    if (DEBUG) console.log(`  Found Stats section`)
    const characterStats: GuestCharacterStats = {}

    // Stats are plain text: "STR: 0" not "<b>STR:</b> 0"
    const strMatch = statsSection[1].match(/STR:\s*([^<\n]+)/i)
    if (strMatch) characterStats.str = strMatch[1].trim()

    const dexMatch = statsSection[1].match(/DEX:\s*([^<\n]+)/i)
    if (dexMatch) characterStats.dex = dexMatch[1].trim()

    const intMatch = statsSection[1].match(/INT:\s*([^<\n]+)/i)
    if (intMatch) characterStats.int = intMatch[1].trim()

    const chaMatch = statsSection[1].match(/CHA:\s*([^<\n]+)/i)
    if (chaMatch) characterStats.cha = chaMatch[1].trim()

    const lukMatch = statsSection[1].match(/LUK:\s*([^<\n]+)/i)
    if (lukMatch) characterStats.luk = lukMatch[1].trim()

    const endMatch = statsSection[1].match(/END:\s*([^<\n]+)/i)
    if (endMatch) characterStats.end = endMatch[1].trim()

    const wisMatch = statsSection[1].match(/WIS:\s*([^<\n]+)/i)
    if (wisMatch) characterStats.wis = wisMatch[1].trim()

    if (Object.keys(characterStats).length > 0) {
      stats.characterStats = characterStats
      if (DEBUG) console.log(`    Found ${Object.keys(characterStats).length} character stats`)
    }
  }

  if (!stats.characterStats) {
    const legacyStatsLine = html.match(/Stats:\s*([^<\n]+)/i)
    if (legacyStatsLine) {
      const characterStats: GuestCharacterStats = {}
      const sectionText = legacyStatsLine[1]
      const strMatch = sectionText.match(/\bSTR:\s*([^,<\n]+)/i)
      if (strMatch) characterStats.str = strMatch[1].trim()
      const dexMatch = sectionText.match(/\bDEX:\s*([^,<\n]+)/i)
      if (dexMatch) characterStats.dex = dexMatch[1].trim()
      const intMatch = sectionText.match(/\bINT:\s*([^,<\n]+)/i)
      if (intMatch) characterStats.int = intMatch[1].trim()
      const chaMatch = sectionText.match(/\bCHA:\s*([^,<\n]+)/i)
      if (chaMatch) characterStats.cha = chaMatch[1].trim()
      const lukMatch = sectionText.match(/\bLUK:\s*([^,<\n]+)/i)
      if (lukMatch) characterStats.luk = lukMatch[1].trim()
      const endMatch = sectionText.match(/\bEND:\s*([^,<\n]+)/i)
      if (endMatch) characterStats.end = endMatch[1].trim()
      const wisMatch = sectionText.match(/\bWIS:\s*([^,<\n]+)/i)
      if (wisMatch) characterStats.wis = wisMatch[1].trim()
      if (Object.keys(characterStats).length > 0) {
        stats.characterStats = characterStats
      }
    }
  }

  // Parse Offense section (may or may not have <b> tags)
  const offenseSection = html.match(/(?:<b>)?<u>Offense<\/u>(?:<\/b>)?([\s\S]*?)(?=<u>|<hr>|$)/i)
  if (offenseSection) {
    if (DEBUG) console.log(`  Found Offense section`)
    const offense: GuestOffenseStats = {}

    // Stats are plain text: "Boost: 0%" not "<b>Boost:</b> 0%"
    const boostMatch = offenseSection[1].match(/\bBoost:\s*([^<\n]+)/i)
    if (boostMatch) offense.boost = boostMatch[1].trim()

    const bonusMatch = offenseSection[1].match(/\bBonus:\s*([^<\n]+)/i)
    if (bonusMatch) offense.bonus = bonusMatch[1].trim()

    const critMatch = offenseSection[1].match(/\bCrit:\s*([^<\n]+)/i)
    if (critMatch) offense.crit = critMatch[1].trim()

    if (Object.keys(offense).length > 0) {
      stats.offense = offense
      if (DEBUG) console.log(`    Found ${Object.keys(offense).length} offense stats`)
    }
  }

  if (!stats.offense) {
    const legacyOffenseLine = html.match(/Offenses?:\s*([^<\n]+)/i)
    if (legacyOffenseLine) {
      const offense: GuestOffenseStats = {}
      const sectionText = legacyOffenseLine[1]
      const boostMatch = sectionText.match(/\bBoost:\s*([^,<\n]+)/i)
      if (boostMatch) offense.boost = boostMatch[1].trim()
      const bonusMatch = sectionText.match(/\bBonus:\s*([^,<\n]+)/i)
      if (bonusMatch) offense.bonus = bonusMatch[1].trim()
      const critMatch = sectionText.match(/\bCrit:\s*([^,<\n]+)/i)
      if (critMatch) offense.crit = critMatch[1].trim()
      if (Object.keys(offense).length > 0) {
        stats.offense = offense
      }
    }
  }

  // Parse Damage Multipliers section (may not have <b> tags)
  const dmgMultSection = html.match(
    /(?:<b>)?<u>Damage Multipliers<\/u>(?:<\/b>)?([\s\S]*?)(?=(?:<b>)?<u>|<hr>|$)/i
  )
  if (dmgMultSection) {
    if (DEBUG) console.log(`  Found Damage Multipliers section`)
    const sectionText = dmgMultSection[1]
    const damageMultipliers: GuestDamageMultipliers = {}

    const nonCritMatch = sectionText.match(/Non-Crit:\s*([^<\n]+)/i)
    if (nonCritMatch) damageMultipliers.nonCrit = nonCritMatch[1].trim()

    const dexMatch = sectionText.match(/\bDex:\s*([^<\n]+)/i)
    if (dexMatch) damageMultipliers.dex = dexMatch[1].trim()

    const dotMatch = sectionText.match(/\bDoT:\s*([^<\n]+)/i)
    if (dotMatch) damageMultipliers.dot = dotMatch[1].trim()

    // Match "Crit:" but NOT "Non-Crit:" - use word boundary or negative lookbehind
    const critMatch = sectionText.match(/(?<!Non-)Crit:\s*([^<\n]+)/i)
    if (critMatch) damageMultipliers.crit = critMatch[1].trim()

    if (Object.keys(damageMultipliers).length > 0) {
      stats.damageMultipliers = damageMultipliers
      if (DEBUG)
        console.log(`    Found ${Object.keys(damageMultipliers).length} damage multipliers`)
    }
  }

  // Parse Defense section
  const defenseSection = html.match(
    /(?:<b>)?<u>(?:Avoidance and )?Defense<\/u>(?:<\/b>)?([\s\S]*?)(?=<u>|<hr>|$)/i
  )
  if (defenseSection) {
    if (DEBUG) console.log(`  Found Defense section`)
    const defense: GuestDefenseStats = {}

    const meleeMatch = defenseSection[1].match(/Melee:\s*([^<\n]+)/i)
    if (meleeMatch) defense.melee = meleeMatch[1].trim()

    const pierceMatch = defenseSection[1].match(/Pierce:\s*([^<\n]+)/i)
    if (pierceMatch) defense.pierce = pierceMatch[1].trim()

    const magicMatch = defenseSection[1].match(/Magic:\s*([^<\n]+)/i)
    if (magicMatch) defense.magic = magicMatch[1].trim()

    const blockMatch = defenseSection[1].match(/Block:\s*([^<\n]+)/i)
    if (blockMatch) defense.block = blockMatch[1].trim()

    const parryMatch = defenseSection[1].match(/Parry:\s*([^<\n]+)/i)
    if (parryMatch) defense.parry = parryMatch[1].trim()

    const dodgeMatch = defenseSection[1].match(/Dodge:\s*([^<\n]+)/i)
    if (dodgeMatch) defense.dodge = dodgeMatch[1].trim()

    if (Object.keys(defense).length > 0) {
      stats.defense = defense
      if (DEBUG) console.log(`    Found ${Object.keys(defense).length} defense stats`)
    }
  }

  if (!stats.defense) {
    const legacyDefenseLine = html.match(/Defenses?:\s*([^<\n]+)/i)
    if (legacyDefenseLine) {
      const defense: GuestDefenseStats = {}
      const sectionText = legacyDefenseLine[1]
      const meleeMatch = sectionText.match(/\bMelee:\s*([^,<\n]+)/i)
      if (meleeMatch) defense.melee = meleeMatch[1].trim()
      const pierceMatch = sectionText.match(/\bPierce:\s*([^,<\n]+)/i)
      if (pierceMatch) defense.pierce = pierceMatch[1].trim()
      const magicMatch = sectionText.match(/\bMagic:\s*([^,<\n]+)/i)
      if (magicMatch) defense.magic = magicMatch[1].trim()
      const blockMatch = sectionText.match(/\bBlock:\s*([^,<\n]+)/i)
      if (blockMatch) defense.block = blockMatch[1].trim()
      const parryMatch = sectionText.match(/\bParry:\s*([^,<\n]+)/i)
      if (parryMatch) defense.parry = parryMatch[1].trim()
      const dodgeMatch = sectionText.match(/\bDodge:\s*([^,<\n]+)/i)
      if (dodgeMatch) defense.dodge = dodgeMatch[1].trim()
      if (Object.keys(defense).length > 0) {
        stats.defense = defense
      }
    }
  }

  // Parse Damage Reduction section
  const dmgRedSection = html.match(
    /(?:<b>)?<u>Damage Reduction<\/u>(?:<\/b>)?([\s\S]*?)(?=<u>|<hr>|$)/i
  )
  if (dmgRedSection) {
    if (DEBUG) console.log(`  Found Damage Reduction section`)
    const damageReduction: GuestDamageReduction = {}

    const nonCritMatch = dmgRedSection[1].match(/Non-Crit:\s*([^<\n]+)/i)
    if (nonCritMatch) damageReduction.nonCrit = nonCritMatch[1].trim()

    const dotMatch = dmgRedSection[1].match(/\bDoT:\s*([^<\n]+)/i)
    if (dotMatch) damageReduction.dot = dotMatch[1].trim()

    // Match "Crit:" but NOT "Non-Crit:" - use negative lookbehind
    const critMatch = dmgRedSection[1].match(/(?<!Non-)Crit:\s*([^<\n]+)/i)
    if (critMatch) damageReduction.crit = critMatch[1].trim()

    if (Object.keys(damageReduction).length > 0) {
      stats.damageReduction = damageReduction
      if (DEBUG)
        console.log(`    Found ${Object.keys(damageReduction).length} damage reduction stats`)
    }
  }

  // Parse Resistances section
  const resistSection = html.match(/(?:<b>)?<u>Resistances<\/u>(?:<\/b>)?([\s\S]*?)(?=<u>|<hr>|$)/i)
  if (resistSection) {
    if (DEBUG) console.log(`  Found Resistances section`)
    const text = stripHtml(decodeHTML(resistSection[1]))

    // If just "None", skip it
    if (!/^none$/i.test(text.trim())) {
      const resistances: Record<string, string> = {}

      // Parse lines like "Fire: +10" or "Ice +5"
      const lines = text.split('\n').filter((l) => l.trim().length > 0)
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

function normalizeStructuredText(html: string): string {
  let depth = 0
  let output = ''
  let i = 0
  let inTag = false
  let tagStart = -1

  while (i < html.length) {
    const char = html[i]

    if (char === '<' && !inTag) {
      const nextChars = html.slice(i, i + 12)
      if (/^<[a-zA-Z!/]/.test(nextChars)) {
        inTag = true
        tagStart = i
      } else {
        output += char
      }
      i++
      continue
    }

    if (char === '>' && inTag) {
      inTag = false
      const tagContent = html.slice(tagStart, i + 1)

      if (/<ul|<ol/i.test(tagContent)) {
        depth++
        output += '\n'
      } else if (/<\/ul|<\/ol/i.test(tagContent)) {
        depth = Math.max(0, depth - 1)
        output += '\n'
      } else if (/<li/i.test(tagContent)) {
        const indent = '  '.repeat(Math.max(0, depth))
        output += `\n${indent}• `
      } else if (/<br/i.test(tagContent) || /<\/p/i.test(tagContent) || /<hr/i.test(tagContent)) {
        output += '\n'
      }

      i++
      continue
    }

    if (inTag) {
      i++
      continue
    }

    output += char
    i++
  }

  return decodeHTML(output)
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function findLastSection(html: string, sectionRegex: RegExp): string | undefined {
  const matches = [...html.matchAll(sectionRegex)]
  const last = matches.at(-1)
  if (!last || last.index === undefined) return undefined
  return html.slice(last.index + last[0].length)
}

function stripTrailingVariantNumber(name: string): string {
  return name.replace(/\s*\((\d+)\)\s*$/, '').trim()
}

function tokenizeGuestTitle(name: string): string[] {
  return stripTrailingVariantNumber(name)
    .toLowerCase()
    .replace(/[^\w\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
}

function getLongestCommonSuffix(tokensList: string[][]): string[] {
  if (tokensList.length === 0) return []
  const reversed = tokensList.map((tokens) => [...tokens].reverse())
  const result: string[] = []
  let index = 0

  while (true) {
    const candidate = reversed[0][index]
    if (!candidate) break
    if (reversed.every((tokens) => tokens[index] === candidate)) {
      result.unshift(candidate)
      index += 1
      continue
    }
    break
  }

  return result
}

function toTitleCase(tokens: string[]): string {
  return tokens.map((token) => token.replace(/\b\w/g, (char) => char.toUpperCase())).join(' ')
}

function deriveGuestFamilyName(sectionNames: string[]): string {
  const stripped = sectionNames.map(stripTrailingVariantNumber)
  if (stripped.every((name) => name.toLowerCase() === stripped[0].toLowerCase())) {
    return stripped[0]
  }

  const tokenSets = stripped.map(tokenizeGuestTitle)
  const suffix = getLongestCommonSuffix(tokenSets)
  if (suffix.length > 0) return toTitleCase(suffix)

  return stripped.slice().sort((a, b) => a.length - b.length || compareTitles(a, b))[0]
}

function deriveGuestVariantLabel(sectionName: string, familyName: string): string | undefined {
  const numberMatch = sectionName.match(/\((\d+)\)\s*$/)
  const stripped = stripTrailingVariantNumber(sectionName)

  if (stripped.toLowerCase() === familyName.toLowerCase()) {
    return numberMatch?.[1]
  }

  return numberMatch ? `${stripped} (${numberMatch[1]})` : stripped
}

interface GuestVariantSection {
  name: string
  html: string
  sourceUrl?: string
}

function collapseGuestSections(sections: GuestVariantSection[]): GuestVariantSection[] {
  const collapsed: GuestVariantSection[] = []

  for (const section of sections) {
    const previous = collapsed.at(-1)
    if (previous && previous.name.trim().toLowerCase() === section.name.trim().toLowerCase()) {
      previous.html = `${previous.html}<br>${section.html}`
      continue
    }

    collapsed.push({ ...section })
  }

  return collapsed
}

function extractGuestHeaderSuffix(html: string, headerEndIndex: number): string {
  const suffixSlice = html.slice(headerEndIndex, headerEndIndex + 80)
  const suffixMatch = suffixSlice.match(/^\s*(\([^<)]{1,40}\))/)
  if (!suffixMatch) return ''
  return stripHtml(decodeHTML(suffixMatch[1])).trim()
}

function hasRetiredGuestSignal(...values: Array<string | undefined>): boolean {
  return values.some((value) =>
    value
      ? /previously attainable[\s\S]*retired|retired (?:access point|da access point|quest|version|location|entry)|previously attainable in the retired/i.test(
          value
        )
      : false
  )
}

function extractGuestVariantSections(
  html: string,
  sourcePosts: ThreadPostContent[] = []
): GuestVariantSection[] {
  const sections: GuestVariantSection[] = []
  const headerRegex =
    /((?:<img[^>]+src=["'][^"']*\/tags\/(?:DA|DC|DM|Temp|Rare|Seasonal|SpecialOffer|Retired)\.(?:png|jpg)["'][^>]*>\s*)*)(?:<b>\s*<font[^>]*size=['"]3['"][^>]*>\s*([^<]+?)\s*<\/font>\s*<\/b>|<font[^>]*size=['"]3['"][^>]*>\s*<b>\s*([^<]+?)\s*<\/b>\s*<\/font>)/gi
  const matches = [...html.matchAll(headerRegex)]

  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i]
    const nextMatch = matches[i + 1]
    const start = match.index ?? 0
    const end = nextMatch?.index ?? html.length
    const baseName = decodeHTML((match[2] ?? match[3] ?? '').trim())
    const suffix = extractGuestHeaderSuffix(html, start + match[0].length)
    const name = suffix ? `${baseName} ${suffix}` : baseName
    const sectionHtml = html.slice(start, end)
    const sourceUrl = sourcePosts.find(
      (post) => post.html.includes(sectionHtml) || sectionHtml.includes(post.html)
    )?.sourceUrl

    if (!name) continue
    if (
      !/(?:Location:|Level:|<u>Stats<\/u>|<u>Offense<\/u>|<u>Avoidance and Defense<\/u>|<u>Defense<\/u>)/i.test(
        sectionHtml
      )
    ) {
      continue
    }

    sections.push({ name, html: sectionHtml, ...(sourceUrl ? { sourceUrl } : {}) })
  }

  return collapseGuestSections(sections)
}

// ─── Attack Parsing with Button Image URLs ───────────────────────────────────

function parseGuestAttacks(html: string, guestName: string): GuestAttack[] {
  const DEBUG = process.env.DEBUG_ATTACKS === '1'
  const attacks: GuestAttack[] = []

  if (DEBUG) console.log(`\n[DEBUG] Parsing attacks for ${guestName}`)

  // Attacks are marked with <font size='2'><b>Attack Name</b></font> and separated by <hr>
  // Find the section between Resistances and Other information (or end of post)
  const sectionEndMatch = html.match(/Thanks to|<font color='#eeeeee'>/i)
  const attacksStartMatch = html.match(
    /(?:<b><u>Resistances<\/u><\/b>|(?:<b>)?<u>Resistances<\/u>(?:<\/b>)?|Resistances:\s*[^<\n]+)(?:[\s\S]*?)<hr>/i
  )

  if (!attacksStartMatch || attacksStartMatch.index === undefined) {
    if (DEBUG) console.log(`  No attacks section found`)
    return attacks
  }

  const sectionStart = attacksStartMatch.index + attacksStartMatch[0].length
  const sectionEnd = sectionEndMatch?.index ?? html.length
  const retiredIndex = html
    .slice(sectionStart, sectionEnd)
    .search(/<img[^>]+src=["'][^"']*\/tags\/Retired\.png["'][^>]*>/i)
  const section =
    retiredIndex >= 0
      ? html.slice(sectionStart, sectionStart + retiredIndex)
      : html.slice(sectionStart, sectionEnd)

  // Split by <hr> to get individual attack blocks
  const blocks = section.split(/<hr>/i)

  for (const block of blocks) {
    if (!block.trim()) continue

    // Look for attack name in <font size='2'><b>Name</b></font> format
    const nameMatch =
      block.match(/<font\s+size=['"]2['"]>\s*<b>([^<]+)<\/b>\s*<\/font>/i) ??
      block.match(/<b>\s*<font\s+size=['"]2['"]>([^<]+)<\/font>\s*<\/b>/i)
    if (!nameMatch) {
      if (DEBUG) console.log(`  Skipped block (no attack name)`)
      continue
    }

    const name = decodeHTML(nameMatch[1]).trim()

    // Skip "Skip" attack entirely
    if (name.toLowerCase() === 'skip') {
      if (DEBUG) console.log(`  Skipped attack: ${name}`)
      continue
    }

    // Skip blocks that look like forum metadata
    if (
      name.toLowerCase().includes('logged in') ||
      name.toLowerCase().includes('post #') ||
      (/^[a-z0-9_]+$/i.test(name) && name.length > 15)
    ) {
      continue
    }

    // Extract italic description (may be multiline, stop at first non-italic)
    const italicMatch = block.match(/<i>([\s\S]*?)<\/i>/i)
    let description: string | undefined
    if (italicMatch) {
      description = normalizeStructuredText(italicMatch[1]).trim()
      if (description.length === 0) description = undefined
    }

    // Extract Requirements
    const reqMatch = block.match(
      /(?:Requirements|Level\/Quest\/Items required):\s*([\s\S]*?)(?=\s*<br>\s*(?:<br>\s*)?(?:Effect:|Mana Cost:|Cooldown:|(?:Damage|Attack) Type:|Element:|<img|<b><u>Other [Ii]nformation<\/u><\/b>|$))/i
    )
    let requirements: string | undefined
    if (reqMatch) {
      requirements = stripHtml(decodeHTML(reqMatch[1])).trim()
      // Hide if "None"
      if (requirements.toLowerCase() === 'none') requirements = undefined
    }

    // Extract Effect - handle multiline with nested bullets, stop before Mana Cost
    const effectMatch = block.match(/Effect:\s*([\s\S]*?)(?=\s*Mana Cost:)/i)
    let effect = 'Unknown effect'
    if (effectMatch) {
      effect = normalizeStructuredText(effectMatch[1])
        .split('\n')
        .map((line) => line.trimEnd())
        .filter((line) => {
          const trimmed = line.trim()
          // Filter out field labels that shouldn't be in effect
          return (
            trimmed.length > 0 &&
            !/^Mana Cost:/i.test(trimmed) &&
            !/^Cooldown:/i.test(trimmed) &&
            !/^Damage Type:/i.test(trimmed) &&
            !/^Element:/i.test(trimmed)
          )
        })
        .join('\n')
        .trim()
    }

    const inlineOtherInfoMatch = block.match(
      /<b><u>Other [Ii]nformation<\/u><\/b>\s*([\s\S]*?)(?=\s*(?:<img|<a[^>]+href="[^"]+\.(?:png|jpg|jpeg|gif|bmp)|$))/i
    )
    if (inlineOtherInfoMatch) {
      const inlineOtherInfo = normalizeStructuredText(inlineOtherInfoMatch[1])
        .split('\n')
        .map((line) => line.trimEnd())
        .filter((line) => line.trim().length > 0)
        .join('\n')
        .trim()
      if (inlineOtherInfo) {
        effect = effect === 'Unknown effect' ? inlineOtherInfo : `${effect}\n${inlineOtherInfo}`
      }
    }

    // Extract Mana Cost
    const manaMatch = block.match(/Mana Cost:\s*([^<\n]+)/i)
    const manaCost = manaMatch ? decodeHTML(manaMatch[1]).trim() : '—'

    // Extract Cooldown
    const cdMatch = block.match(/Cooldown:\s*([^<\n]+)/i)
    const cooldown = cdMatch ? decodeHTML(cdMatch[1]).trim() : '—'

    // Extract Damage Type
    const dmgTypeMatch = block.match(/(?:Damage|Attack) Type:\s*([^<\n]+)/i)
    const damageType = dmgTypeMatch ? decodeHTML(dmgTypeMatch[1]).trim() : '—'

    // Extract Element
    const elemMatch = block.match(/Element:\s*([^<\n]+)/i)
    const element = elemMatch ? decodeHTML(elemMatch[1]).trim() : '—'

    // Extract button image URL - look for DF-Pedia image with "Button" in URL
    let buttonImageUrl: string | undefined
    const buttonImgMatch = block.match(
      /<img[^>]+src="([^"]*(?:github\.com\/DF-Pedia|githubusercontent\.com)[^"]*(?:Button|button|Attack\.png)[^"]*)"[^>]*>/i
    )
    if (buttonImgMatch) {
      buttonImageUrl = buttonImgMatch[1]
    } else {
      // Fallback: look for any DF-Pedia image in the attack block
      const dfPediaImgMatch = block.match(
        /<img[^>]+src="([^"]*(?:github\.com\/DF-Pedia|githubusercontent\.com)[^"]*)"[^>]*>/i
      )
      if (dfPediaImgMatch) {
        buttonImageUrl = dfPediaImgMatch[1]
      } else {
        // Try imgur as last resort
        const imgurMatch = block.match(/<img[^>]+src="([^"]*imgur\.com[^"]*)"[^>]*>/i)
        if (imgurMatch) {
          buttonImageUrl = imgurMatch[1]
        }
      }
    }

    // Extract appearance URL from hyperlinked "Appearance" text
    let appearanceUrl: string | undefined
    const appearanceMatch = block.match(/<a[^>]+href="([^"]+)"[^>]*>([^<]*Appearance[^<]*)<\/a>/i)
    if (appearanceMatch) {
      appearanceUrl = appearanceMatch[1]
    }

    if (DEBUG) {
      console.log(`  Attack: ${name}`)
      console.log(`    Description: ${description?.slice(0, 50) || 'none'}...`)
      console.log(`    Requirements: ${requirements || 'None'}`)
      console.log(`    Effect: ${effect.slice(0, 50)}...`)
      console.log(`    Mana: ${manaCost}, CD: ${cooldown}, Type: ${damageType}, Elem: ${element}`)
      console.log(`    Button URL: ${buttonImageUrl || 'none'}`)
      console.log(`    Appearance URL: ${appearanceUrl || 'none'}`)
    }

    attacks.push({
      name,
      description,
      requirements,
      effect,
      manaCost,
      cooldown,
      damageType,
      element,
      buttonImageUrl,
      appearanceUrl,
    })
  }

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

function extractGuestImages(
  html: string,
  guestName: string
): { imageUrl?: string; alternativeImages: AlternativeImage[] } {
  const DEBUG = process.env.DEBUG_IMAGES === '1'

  if (DEBUG) console.log(`\n[DEBUG] Extracting images for ${guestName}`)

  // Skip patterns for UI/tag/button/attack/appearance images
  const skipPatterns = [
    /\/f\/image\//i, // Forum UI images
    /^image\//i,
    /^micons\//i,
    /forumheader/i,
    /quantserve/i,
    /artix\.com\/shared/i,
    /artixgamelaunch/i,
    /\/tags\//i, // Tag images (DA, DC, etc.)
    /clear\.gif/i,
    /blank\.gif/i,
    /-button/i, // Skill button images
    /-Button/i,
    /Button\d+/i, // Button01, Button02 etc
    /PetAttack/i,
    /AttackType/i,
    /-Attack\./i,
    /\/classes_abilities\//i, // Skip Attack.png and class ability images
  ]

  const isCandidateMainImage = (src: string) => {
    if (skipPatterns.some((p) => p.test(src))) return false
    if (/button/i.test(src)) return false
    return (
      src.includes('github.com/DF-Pedia') ||
      src.includes('raw.githubusercontent.com') ||
      src.includes('githubusercontent.com') ||
      src.includes('imgur.com') ||
      src.includes('i.imgur.com') ||
      (src.includes('/f/upfiles/') && src.length > 60)
    )
  }

  // Find main image in "Other information" section - this is the character portrait
  // Pattern: <img src="...pets_guests/GuestName.png" after "Other information"
  const otherInfoHtml = findLastSection(html, /<b><u>Other [Ii]nformation<\/u><\/b>/gi) ?? html
  const escapedName = guestName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const mainImagePattern = new RegExp(
    `<img[^>]+src="([^"]*(?:github\\.com\\/DF-Pedia|raw\\.githubusercontent\\.com|githubusercontent\\.com)[^"]*\\/pets_guests\\/${escapedName}(?:\\.(?:png|jpg|jpeg|gif|bmp)|%20pic\\.bmp)[^"]*)"[^>]*>`,
    'i'
  )
  const mainImageMatch = otherInfoHtml.match(mainImagePattern)
  let imageUrl = mainImageMatch ? mainImageMatch[1] : undefined

  if (DEBUG && imageUrl) console.log(`  Found main image: ${imageUrl}`)

  // Find alternative images - look for hyperlinked image captions AFTER main image
  // Pattern: <a href="url">Caption Text</a> where URL is an image
  const alternativeImages: AlternativeImage[] = []

  if (mainImageMatch) {
    // Start searching after the main image position
    const mainImagePos = otherInfoHtml.indexOf(mainImageMatch[0])
    const afterMainImage = otherInfoHtml.slice(mainImagePos + mainImageMatch[0].length)

    // Look for hyperlinked images with captions before the attribution line or end marker
    // Pattern: <a href="image_url.png">Caption Text</a>
    const hyperlinkPattern =
      /<a[^>]+href="([^"]+\.(?:png|jpg|jpeg|gif|bmp))"[^>]*>([\s\S]*?)<\/a>/gi
    let match: RegExpExecArray | null

    while ((match = hyperlinkPattern.exec(afterMainImage)) !== null) {
      const url = match[1]
      const caption = stripHtml(decodeHTML(match[2])).trim()

      // Stop at attribution lines
      if (/thanks to|also see:/i.test(caption)) break

      // Skip if URL matches skip patterns
      if (!isCandidateMainImage(url)) continue

      // Add as alternative image with caption
      if (
        url.includes('github.com/DF-Pedia') ||
        url.includes('raw.githubusercontent.com') ||
        url.includes('githubusercontent.com') ||
        url.includes('imgur.com')
      ) {
        alternativeImages.push({ url, caption })
        if (DEBUG) console.log(`  Found alt image: ${caption} -> ${url.slice(0, 60)}...`)
      }
    }
  }

  // If no main image found, fall back to the last valid image in Other Information,
  // then the last valid image in the entire post.
  if (!imageUrl) {
    const sectionImages: string[] = []
    const imgRegex = /<img[^>]+src=(["'])(.*?)\1[^>]*>/gi
    let imgMatch: RegExpExecArray | null

    while ((imgMatch = imgRegex.exec(otherInfoHtml)) !== null) {
      const src = imgMatch[2]
      if (isCandidateMainImage(src)) sectionImages.push(src)
    }

    // Find the simple name pattern as fallback
    const simpleNamePattern = new RegExp(
      `/pets_guests/${escapedName}(?:\\.(?:png|jpg|jpeg|gif|bmp)|%20pic\\.bmp)$`,
      'i'
    )
    const fallbackMain =
      sectionImages.find((u) => simpleNamePattern.test(u)) ?? sectionImages.at(-1)

    if (fallbackMain) {
      const fallbackPos = otherInfoHtml.lastIndexOf(fallbackMain)
      if (fallbackPos >= 0) {
        const afterMainImage = otherInfoHtml.slice(fallbackPos + fallbackMain.length)
        const hyperlinkPattern =
          /<a[^>]+href=(["'])(.*?\.(?:png|jpg|jpeg|gif|bmp))\1[^>]*>([\s\S]*?)<\/a>/gi
        let match: RegExpExecArray | null
        while ((match = hyperlinkPattern.exec(afterMainImage)) !== null) {
          const url = match[2]
          const caption = stripHtml(decodeHTML(match[3])).trim()
          if (!caption || !isCandidateMainImage(url)) continue
          alternativeImages.push({ url, caption })
        }
      }
    }

    if (DEBUG && fallbackMain) console.log(`  Fallback main image: ${fallbackMain}`)

    return {
      imageUrl: fallbackMain,
      alternativeImages,
    }
  }

  if (DEBUG) {
    console.log(`  Main image: ${imageUrl || 'none'}`)
    console.log(`  Alternative images: ${alternativeImages.length}`)
  }

  return { imageUrl, alternativeImages }
}

function hasRequiredGuestImage(item: Guest | ItemFamily): boolean {
  if ('levelVariants' in item) {
    return Boolean(
      item.shared.imageUrl ||
      item.shared.alternativeImages?.length ||
      item.levelVariants.some((level) => level.imageUrl || level.alternativeImages?.length)
    )
  }

  return Boolean(item.imageUrl || item.alternativeImages?.length)
}

function sanitizeGuestMedia<
  T extends { imageUrl?: string; alternativeImages?: AlternativeImage[]; attacks?: GuestAttack[] },
>(entry: T): T {
  const attackMediaUrls = new Set(
    (entry.attacks ?? [])
      .flatMap((attack) => [attack.buttonImageUrl, attack.appearanceUrl])
      .filter(Boolean)
  )
  const alternativeImages = entry.alternativeImages?.filter((image) => {
    if (!attackMediaUrls.has(image.url)) return true
    const caption = image.caption?.trim().toLowerCase() ?? ''
    return caption.length > 0 && !/^(appearance(?:\s+\d+(?:\.\d+)?)?|[0-9.]+)$/.test(caption)
  })

  const sanitized = { ...entry }

  if (sanitized.imageUrl && attackMediaUrls.has(sanitized.imageUrl)) {
    delete sanitized.imageUrl
  }
  if (alternativeImages && alternativeImages.length > 0) {
    sanitized.alternativeImages = alternativeImages
  } else {
    delete sanitized.alternativeImages
  }

  return sanitized
}

function sanitizeGuestFamilyLevelVariants(family: ItemFamily): ItemFamily {
  if (family.type !== 'guest') return family

  const sanitizedLevels = family.levelVariants.map((level) => {
    const attackMediaUrls = new Set(
      (level.attacks ?? [])
        .flatMap((attack) => {
          const typedAttack = attack as GuestAttack
          return [typedAttack.buttonImageUrl, typedAttack.appearanceUrl]
        })
        .filter(Boolean)
    )

    const imageUrl =
      family.shared.imageUrl && level.imageUrl && attackMediaUrls.has(level.imageUrl)
        ? undefined
        : level.imageUrl

    const alternativeImages = level.alternativeImages?.filter((image) => {
      if (!attackMediaUrls.has(image.url)) return true
      const caption = image.caption?.trim().toLowerCase() ?? ''
      return caption.length > 0 && !/^(appearance(?:\s+\d+(?:\.\d+)?)?|[0-9.]+)$/.test(caption)
    })

    const {
      imageUrl: _ignoredImageUrl,
      alternativeImages: _ignoredAlternativeImages,
      ...rest
    } = level

    return {
      ...rest,
      ...(imageUrl ? { imageUrl } : {}),
      ...(alternativeImages && alternativeImages.length > 0 ? { alternativeImages } : {}),
    }
  })

  return {
    ...family,
    levelVariants: sanitizedLevels,
  }
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
    new RegExp(
      `<b><font\\s+size=['"]3['"]>${escapedName}</font></b>\\s*<br>\\s*<i>([^<]+)</i>`,
      'i'
    ),
    // Without size attribute
    new RegExp(`<b><font[^>]*>${escapedName}</font></b>\\s*<br>\\s*<i>([^<]+)</i>`, 'i'),
    // Allow extra spaces
    new RegExp(
      `<b>\\s*<font[^>]*>\\s*${escapedName}\\s*</font>\\s*</b>\\s*<br>\\s*<i>([^<]+)</i>`,
      'i'
    ),
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

  const firstFieldIndex =
    [
      '<b>Location:</b>',
      '<b>Level:</b>',
      '<u>Stats</u>',
      '<u>Offense</u>',
      '<u>Avoidance and Defense</u>',
      '<u>Defense</u>',
      '<u>Resistances</u>',
    ]
      .map((marker) => html.indexOf(marker))
      .filter((index) => index >= 0)
      .sort((a, b) => a - b)[0] ?? html.length
  const introSlice = html.slice(0, firstFieldIndex)
  const fallbackItalic = introSlice.match(/<i>([\s\S]*?)<\/i>/i)
  if (fallbackItalic) {
    const desc = normalizeStructuredText(fallbackItalic[1]).trim()
    if (desc && desc.length > 2 && !/^(appearance|other information)$/i.test(desc)) {
      if (DEBUG) console.log(`  Found fallback italic description: ${desc}`)
      return desc
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

  const normalizeRequirements = (requirements?: string): string | undefined => {
    if (!requirements) return undefined
    const normalized = requirements.trim().replace(/\s*;\s*None\s*$/i, '')
    if (!normalized || /^none$/i.test(normalized)) return undefined
    if (/^dragon amulet$/i.test(normalized)) return undefined
    return normalized
  }

  const firstFieldIndex =
    [
      /(?:<b>)?Level:(?:<\/b>)?/i,
      /<u>Stats<\/u>/i,
      /<u>Offense<\/u>/i,
      /<u>Avoidance and Defense<\/u>/i,
      /<u>Defense<\/u>/i,
      /<u>Defenses<\/u>/i,
      /<u>Resistances<\/u>/i,
    ]
      .map((pattern) => html.search(pattern))
      .filter((index) => index >= 0)
      .sort((a, b) => a - b)[0] ?? html.length

  const introHtml = html
    .slice(0, firstFieldIndex)
    .replace(/<b>\s*<font[^>]*>\s*Location:\s*<\/font>\s*<\/b>/gi, '<b>Location:</b>')
    .replace(
      /<b>\s*<font[^>]*>\s*(Requirements|Level\/Quest\/Items to unlock|Required Items?):\s*<\/font>\s*<\/b>/gi,
      '<b>$1:</b>'
    )
    .replace(
      /(?:^|\s)(Location|Requirements|Level\/Quest\/Items to unlock|Price|Sellback|Required Items?|Required|Requires):/gi,
      ' <b>$1:</b>'
    )

  const blocks: Array<{
    locations: string[]
    requirements?: string
    price?: string
    sellback?: string
    requiredItems?: string
    hasDA: boolean
    hasDC: boolean
    hasDM: boolean
  }> = []

  let currentBlock: (typeof blocks)[number] | undefined
  let pendingDA = false
  let pendingDC = false
  let pendingDM = false

  const rawLines = introHtml
    .split(/<br\s*\/?>/i)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  for (const rawLine of rawLines) {
    pendingDA = pendingDA || /<img[^>]+src=["'][^"']*\/tags\/DA\.png["']/i.test(rawLine)
    pendingDC = pendingDC || /<img[^>]+src=["'][^"']*\/tags\/DC\.png["']/i.test(rawLine)
    pendingDM = pendingDM || /<img[^>]+src=["'][^"']*\/tags\/DM\.png["']/i.test(rawLine)

    const fieldMatch = rawLine.match(
      /<b>(Location|Requirements|Level\/Quest\/Items to unlock|Price|Sellback|Required Items?|Required|Requires):<\/b>\s*([\s\S]*)/i
    )
    if (!fieldMatch) continue

    const fieldName = fieldMatch[1].toLowerCase()
    const rawValue = fieldMatch[2]
    const value = normalizeStructuredText(decodeHTML(rawValue))
      .replace(/\n+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()

    if (!value) continue

    if (fieldName === 'location') {
      if (
        !currentBlock ||
        currentBlock.requirements ||
        currentBlock.price ||
        currentBlock.sellback ||
        currentBlock.requiredItems
      ) {
        currentBlock = {
          locations: [],
          hasDA: pendingDA,
          hasDC: pendingDC,
          hasDM: pendingDM,
        }
        blocks.push(currentBlock)
      }

      currentBlock.locations.push(value)
      currentBlock.hasDA = currentBlock.hasDA || pendingDA
      currentBlock.hasDC = currentBlock.hasDC || pendingDC
      currentBlock.hasDM = currentBlock.hasDM || pendingDM
      continue
    }

    if (!currentBlock) {
      currentBlock = {
        locations: [],
        hasDA: pendingDA,
        hasDC: pendingDC,
        hasDM: pendingDM,
      }
      blocks.push(currentBlock)
    }

    if (fieldName === 'requirements' || fieldName === 'level/quest/items to unlock') {
      currentBlock.requirements = value
    } else if (fieldName === 'price') {
      currentBlock.price = value
    } else if (fieldName === 'sellback') {
      currentBlock.sellback = value
    } else if (
      fieldName === 'required item' ||
      fieldName === 'required items' ||
      fieldName === 'required' ||
      fieldName === 'requires'
    ) {
      currentBlock.requiredItems = value
    }
  }

  for (const block of blocks) {
    if (block.locations.length === 0) continue

    let priceType: ObtainMethod['priceType'] = 'free'
    if (block.price) {
      priceType = computePriceType(block.price, block.requiredItems)
    } else if (block.requiredItems) {
      priceType = 'merge'
    }

    const dcRequired = block.hasDC || priceType === 'dc'
    const dmRequired = block.hasDM || priceType === 'dm'

    for (const location of block.locations) {
      const method: ObtainMethod = {
        location,
        priceType,
      }

      const normalizedRequirements = normalizeRequirements(block.requirements)
      if (normalizedRequirements) method.requirements = normalizedRequirements
      if (block.price) method.price = block.price
      if (block.sellback) method.sellback = rephraseTimedSellback(block.sellback)
      if (block.requiredItems) method.requiredItems = block.requiredItems
      if (block.hasDA) method.daRequired = true
      if (dcRequired) method.dcRequired = true
      if (dmRequired) method.dmRequired = true

      obtainMethods.push(method)

      if (DEBUG) {
        console.log(`  Location: ${location}`)
        if (normalizedRequirements) console.log(`  Requirements: ${normalizedRequirements}`)
        if (block.price) console.log(`  Price: ${block.price} (${priceType})`)
        if (block.sellback) console.log(`  Sellback: ${block.sellback}`)
        if (block.requiredItems) console.log(`  Required Items: ${block.requiredItems}`)
        console.log(`  DA: ${block.hasDA}, DC: ${dcRequired}, DM: ${dmRequired}`)
      }
    }
  }

  if (obtainMethods.length <= 1) {
    const fallbackMethods: ObtainMethod[] = []
    const introText = normalizeStructuredText(introHtml)
    const textLines = introText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    let current: { location?: string; requirements?: string } | null = null

    const pushCurrent = () => {
      if (!current?.location) return
      fallbackMethods.push({
        location: current.location,
        priceType: 'free',
        ...(current.requirements ? { requirements: current.requirements } : {}),
      })
      current = null
    }

    for (const line of textLines) {
      if (/^Location:/i.test(line)) {
        pushCurrent()
        current = { location: line.replace(/^Location:\s*/i, '').trim() }
        continue
      }

      if (/^(Requirements|Level\/Quest\/Items to unlock):/i.test(line)) {
        if (!current) current = {}
        current.requirements = normalizeRequirements(
          line.replace(/^(Requirements|Level\/Quest\/Items to unlock):\s*/i, '').trim()
        )
      }
    }

    pushCurrent()

    if (fallbackMethods.length > obtainMethods.length) {
      return fallbackMethods
    }
  }

  if (obtainMethods.length === 0 && DEBUG) console.log(`  No location field found`)

  if (DEBUG) console.log(`[DEBUG] Found ${obtainMethods.length} obtain methods\n`)

  return obtainMethods
}

// ─── Notes Parsing ────────────────────────────────────────────────────────────

function parseNotes(html: string, guestName: string): string | undefined {
  const DEBUG = process.env.DEBUG_NOTES === '1'

  if (DEBUG) console.log(`\n[DEBUG] Parsing notes for ${guestName}`)

  const noteLines: string[] = []
  const otherInfoHtml = findLastSection(html, /<b><u>Other [Ii]nformation<\/u><\/b>/gi)

  if (otherInfoHtml) {
    if (DEBUG) console.log(`  Found Other Information section`)

    const trimmedSection = otherInfoHtml
      .split(/<i>Thanks to|Also See:|<font color='#eeeeee'>/i)[0]
      .replace(
        /<img[^>]+src="[^"]*(?:github\.com\/DF-Pedia|githubusercontent\.com)[^"]*\/pets_guests\/[^"]*\.(?:png|jpg|jpeg|gif|bmp)"[^>]*>/gi,
        ''
      )

    for (const line of normalizeStructuredText(trimmedSection).split('\n')) {
      if (!line.trim()) continue
      if (/\w+\s+--\s+\d+\/\d+\/\d+\s+\d+:\d+:\d+/.test(line)) continue
      if (
        /^[•\s]*[A-Za-z0-9&/'().,-]+(?:\s+[A-Za-z0-9&/'().,-]+)*\s+Appearance(?:\s+\d+(?:\.\d+)?)?\s*$/i.test(
          line
        )
      )
        continue
      noteLines.push(line)
    }
  }

  const seenNotes = new Set(noteLines.map((line) => line.trim()))
  const rawNoteMatches = html.matchAll(/<li>\s*<i>\s*Note:\s*([\s\S]*?)<\/i>/gi)
  for (const match of rawNoteMatches) {
    const note = normalizeStructuredText(match[1]).trim()
    if (!note || seenNotes.has(note)) continue
    seenNotes.add(note)
    noteLines.push(note)
  }

  for (const line of normalizeStructuredText(html).split('\n')) {
    const trimmed = line.trim()
    if (!/^Note:/i.test(trimmed)) continue
    const note = trimmed.replace(/^Note:\s*/i, '').trim()
    if (!note || seenNotes.has(note)) continue
    seenNotes.add(note)
    noteLines.push(note)
  }

  if (noteLines.length > 0) {
    const notes = noteLines.join('\n')
    if (DEBUG) console.log(`  Found ${noteLines.length} note lines`)
    return notes
  }

  if (DEBUG) console.log(`  No notes found`)
  return undefined
}

// ─── Also See Parsing ─────────────────────────────────────────────────────────

function parseAlsoSee(
  html: string,
  nameToSlug: Map<string, { slug: string; type: EntryType }>,
  guestName: string
): AlsoSeeRef[] {
  const DEBUG = process.env.DEBUG_ALSOSEE === '1'

  if (DEBUG) console.log(`\n[DEBUG] Parsing Also See for ${guestName}`)

  const alsoSee: AlsoSeeRef[] = []

  // Look for "Also See:" section
  const alsoSeeMatch = html.match(/Also See:\s*([\s\S]*?)(?=<br><br>|Thanks to|$)/i)

  if (alsoSeeMatch) {
    if (DEBUG) console.log(`  Found Also See section`)

    const text = stripHtml(decodeHTML(alsoSeeMatch[1]))
    const lines = text.split('\n').filter((l) => l.trim().length > 0)

    for (const line of lines) {
      const trimmed = line.trim().replace(/^[•*-]\s*/, '')

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
  const nameParts = name
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2)
  const descParts = description
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 5)
  const elementTags = elements.map((e) => e.toLowerCase())

  const tags = [...new Set([...nameParts, ...descParts, ...elementTags])]
  return tags
}

// ─── Chronology parsing ───────────────────────────────────────────────────────

interface ChronologyData {
  datesByName: Map<string, string>
  datesByMessageId: Map<string, string>
  guestNames: Set<string>
  guestMessageIds: Set<string>
}

function normalizeGuestLookupName(name: string): string {
  return decodeHTML(name)
    .toLowerCase()
    .replace(/\s*\(all versions\)\s*$/, '')
    .replace(/\s*\(guest\)\s*$/, '')
    .replace(/\s*\(\d+\)\s*$/, '')
    .replace(/[^\w\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseChronology(html: string): ChronologyData {
  const DEBUG = process.env.DEBUG_CHRONO === '1'
  const datesByName = new Map<string, string>()
  const datesByMessageId = new Map<string, string>()
  const guestNames = new Set<string>()
  const guestMessageIds = new Set<string>()
  const chunks = html.split(/<br\s*\/?>/i)

  if (DEBUG) {
    console.log(`\n[DEBUG] Parsing Chronology (${chunks.length} chunks)`)
    console.log(`  First 20 lines:`)
    chunks.slice(0, 20).forEach((line, i) => {
      console.log(`    ${i}: ${line.slice(0, 80)}`)
    })
  }

  let currentDate = ''

  for (const chunk of chunks) {
    const trimmed = stripHtml(decodeHTML(chunk)).trim()
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

      datesByName.set(name.toLowerCase(), currentDate)
      guestNames.add(name.toLowerCase())
      guestNames.add(normalizeGuestLookupName(name))
      const idMatch = chunk.match(/tm\.asp\?m=(\d+)|fb\.asp\?m=(\d+)/i)
      const messageId = idMatch?.[1] ?? idMatch?.[2]
      if (messageId) {
        guestMessageIds.add(messageId)
        datesByMessageId.set(messageId, currentDate)
      }

      if (DEBUG) console.log(`  Found guest: ${name} (${currentDate})`)
    }
  }

  if (DEBUG) console.log(`[DEBUG] Chronology parsing found ${guestNames.size} guests\n`)

  return { datesByName, datesByMessageId, guestNames, guestMessageIds }
}

// ─── A-Z page parsing ─────────────────────────────────────────────────────────

function extractAZListBlock(html: string, section: 'pet' | 'guest'): string {
  const blocks = [...html.matchAll(/<td\b[^>]*class=["']?msg["']?[^>]*>([\s\S]*?)<\/td>/gi)].map(
    (match) => match[1]
  )
  const index = section === 'pet' ? 1 : 2
  const block = blocks[index]
  return block ?? html
}

function parseAZPage(html: string, chronology: ChronologyData): GuestStub[] {
  const stubsByKey = new Map<string, GuestStub>()
  const seen = new Set<string>()
  const listHtml = extractAZListBlock(html, 'guest')
  const chunks = listHtml.split(/<br\s*\/?>/)
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
    const linkMatch =
      /href=["']?(?:https?:\/\/forums2\.battleon\.com\/f\/)?((tm|fb)\.asp\?m=(\d+))["'\s>]/i.exec(
        chunk
      )
    if (!linkMatch) continue
    const linkPath = linkMatch[1]
    const msgId = linkMatch[3]

    // Keep same-thread variants as distinct stubs while still ignoring repeated list rows.
    const seenKey = `${msgId}:${stripHtml(decodeHTML(chunk)).trim().toLowerCase()}`
    if (seen.has(seenKey)) {
      skippedCount++
      continue
    }
    seen.add(seenKey)

    // Elements/traits appear BEFORE the <a> tag
    const { elements, traits } = parseBracketCodes(chunk)

    // Extract anchor text
    const anchorText = decodeHTML((chunk.match(/<a[^>]+>([^<]+)<\/a>/i)?.[1] ?? '').trim())
    if (!anchorText || anchorText.length < 2) {
      if (anchorText) skippedCount++
      continue
    }

    // Name is anchor text with any remaining bracket codes stripped
    const name = anchorText
      .replace(/\[[A-Z?/]+\]/g, '')
      .replace(/\s*\(Guest\)\s*$/i, '')
      .replace(/\s*\(All Versions\)\s*$/i, '')
      .trim()
    if (!name) {
      skippedCount++
      continue
    }

    // Skip navigation/meta links
    if (
      name.toLowerCase().includes('chronology') ||
      name.toLowerCase().includes('a-z') ||
      name.toLowerCase() === 'pets' ||
      name.toLowerCase() === 'guests'
    ) {
      skippedCount++
      continue
    }

    const stub: GuestStub = {
      name,
      slug: prefixedSlug(name, 'guest'),
      type: 'guest',
      forumUrl: directForumPostUrl(linkPath, msgId),
      messageId: msgId,
      elements,
      traits,
      letter: currentLetter,
    }

    const normalizedKey = normalizeGuestLookupName(name)
    const existing = stubsByKey.get(normalizedKey)
    const candidateIsChronologyMatch = chronology.guestMessageIds.has(msgId)
    const existingIsChronologyMatch = existing
      ? chronology.guestMessageIds.has(existing.messageId)
      : false

    if (!existing || (candidateIsChronologyMatch && !existingIsChronologyMatch)) {
      stubsByKey.set(normalizedKey, stub)
    }
  }

  if (skippedCount > 0) {
    console.log(
      `   ⚠️  Skipped ${skippedCount} entries (duplicates, navigation links, or invalid names)`
    )
  }

  return Array.from(stubsByKey.values())
}

function extractThreadMessageBlocks(html: string): string[] {
  return [...html.matchAll(/<td\b[^>]*class=["']?msg["']?[^>]*>([\s\S]*?)<\/td>/gi)].map((match) =>
    convertImageTags(match[1])
  )
}

function mergeNotesText(...notes: Array<string | undefined>): string | undefined {
  const seen = new Set<string>()
  const ordered: string[] = []

  for (const noteText of notes) {
    if (!noteText) continue
    const separator = noteText.includes('\n') ? '\n' : ' • '
    for (const rawPart of noteText.split(separator)) {
      const part = rawPart.trim()
      if (!part || seen.has(part)) continue
      seen.add(part)
      ordered.push(part)
    }
  }

  return ordered.length > 0 ? ordered.join('\n') : undefined
}

function extractSupplementalGuestThreadNotes(html: string): string | undefined {
  const blocks = extractThreadMessageBlocks(html)
  if (blocks.length <= 1) return undefined

  const supplemental: string[] = []
  for (const block of blocks.slice(1)) {
    if (!/<b><u>Other [Ii]nformation<\/u><\/b>/i.test(block)) continue
    if (/(?:<b>\s*<font[^>]*size=['"]3['"]|<font[^>]*size=['"]3['"][^>]*>\s*<b>)/i.test(block))
      continue
    const notes = parseNotes(block, 'shared')
    if (notes) supplemental.push(notes)
  }

  return mergeNotesText(...supplemental)
}

function extractSupplementalGuestThreadMedia(html: string): {
  imageUrl?: string
  alternativeImages?: AlternativeImage[]
} {
  const blocks = extractThreadMessageBlocks(html)
  if (blocks.length <= 1) return {}

  const skipPatterns = [
    /\/f\/image\//i,
    /^image\//i,
    /^micons\//i,
    /forumheader/i,
    /quantserve/i,
    /artix\.com\/shared/i,
    /artixgamelaunch/i,
    /\/tags\//i,
    /clear\.gif/i,
    /blank\.gif/i,
    /-button/i,
    /Button\d+/i,
    /PetAttack/i,
    /AttackType/i,
    /-Attack\./i,
    /\/classes_abilities\//i,
  ]

  const isCandidateImage = (url: string): boolean => {
    if (skipPatterns.some((pattern) => pattern.test(url))) return false
    return /github\.com|raw\.githubusercontent\.com|githubusercontent\.com|imgur\.com|\/f\/upfiles\//i.test(
      url
    )
  }

  let imageUrl: string | undefined
  const alternativeImages: AlternativeImage[] = []

  for (const block of blocks.slice(1)) {
    if (
      /<font[^>]*size=['"]3['"]/i.test(block) ||
      /<b>\s*(?:Location|Requirements|Level|Damage|Damage Type|Element|HP|MP):/i.test(block) ||
      /(?:Mana Cost|Cooldown|Damage Multipliers|Damage Reduction):/i.test(block)
    ) {
      continue
    }

    const candidateImages = [...block.matchAll(/<img[^>]+src=(["'])(.*?)\1[^>]*>/gi)]
      .map((match) => match[2])
      .filter(isCandidateImage)

    if (!imageUrl && candidateImages.length > 0) {
      imageUrl = candidateImages.at(-1)
    }

    const hyperlinkPattern =
      /<a[^>]+href=(["'])(.*?\.(?:png|jpg|jpeg|gif|bmp))\1[^>]*>([\s\S]*?)<\/a>/gi
    let match: RegExpExecArray | null
    while ((match = hyperlinkPattern.exec(block)) !== null) {
      const url = match[2]
      const caption = stripHtml(decodeHTML(match[3])).trim()
      if (!caption || !isCandidateImage(url) || /thanks to|also see:/i.test(caption)) continue
      alternativeImages.push({ url, caption })
    }
  }

  return {
    ...(imageUrl ? { imageUrl } : {}),
    ...(alternativeImages.length > 0 ? { alternativeImages } : {}),
  }
}

function buildGuestFamilyFromSections(
  stub: GuestStub,
  sections: GuestVariantSection[],
  chronology: ChronologyData,
  nameToSlug: Map<string, { slug: string; type: EntryType }>,
  sharedNotes?: string
): ItemFamily {
  const familyName = deriveGuestFamilyName(sections.map((section) => section.name))
  const variants: GuestFamilyVariant[] = sections.map((section) => {
    const description = parseDescription(section.html, section.name)
    const guestStats = parseGuestStats(section.html, section.name)
    const attacks = parseGuestAttacks(section.html, section.name)
    const categoryTags = detectCategoryTags(section.html)
    const { imageUrl, alternativeImages } = extractGuestImages(section.html, section.name)
    const obtainMethods = parseObtainMethods(section.html, section.name)
    const notes = parseNotes(section.html, section.name)
    const alsoSee = parseAlsoSee(section.html, nameToSlug, section.name)
    const tags = generateTags(section.name, description, stub.elements)
    const daRequired = /<img[^>]+src=["'][^"']*\/tags\/DA\.png["']/i.test(section.html)
    const dcRequired = /<img[^>]+src=["'][^"']*\/tags\/DC\.png["']/i.test(section.html)
    const dmRequired = /<img[^>]+src=["'][^"']*\/tags\/DM\.png["']/i.test(section.html)
    const rarityMatch = section.html.match(/<b>Rarity:<\/b>\s*([^<\n]+)/i)
    const rarity = rarityMatch ? rarityMatch[1].trim() : 'Unknown'

    return sanitizeGuestMedia({
      id: prefixedSlug(section.name, 'guest'),
      name: section.name,
      slug: prefixedSlug(section.name, 'guest'),
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
      evolutions: [],
      releaseDate:
        chronology.datesByMessageId.get(stub.messageId) ||
        chronology.datesByName.get(section.name.toLowerCase()) ||
        chronology.datesByName.get(stripTrailingVariantNumber(section.name).toLowerCase()) ||
        chronology.datesByName.get(stub.name.toLowerCase()) ||
        'Unknown',
      imageUrl,
      forumUrl: section.sourceUrl ?? stub.forumUrl,
      notes,
      alsoSee,
      tags,
      guestStats,
      alternativeImages: alternativeImages.length > 0 ? alternativeImages : undefined,
      retired: categoryTags.retired || hasRetiredGuestSignal(notes) || undefined,
      sourceName: section.name,
    })
  })

  const allInternalSlugs = new Set(variants.map((variant) => variant.slug))
  const levelVariants: LevelVariant[] = variants.map((variant, index) => {
    const levelInfo = normalizeLevel(variant.guestStats.level || variant.level || String(index + 1))
    const actualLevel = /^\d+$/.test((variant.guestStats.level || variant.level || '').trim())
      ? parseInt((variant.guestStats.level || variant.level).trim(), 10)
      : undefined

    const obtainVariants: ObtainVariant[] = variant.obtainMethods.map((method) => ({
      location: method.location,
      price: method.price ?? 'N/A',
      priceType: method.priceType,
      ...(method.sellback ? { sellback: method.sellback } : {}),
      ...(method.requirements ? { requirements: method.requirements } : {}),
      daRequired: method.daRequired ?? variant.daRequired,
      ...((method.dcRequired ?? variant.dcRequired)
        ? { dcRequired: method.dcRequired ?? variant.dcRequired }
        : {}),
      ...((method.dmRequired ?? variant.dmRequired)
        ? { dmRequired: method.dmRequired ?? variant.dmRequired }
        : {}),
      ...(method.requiredItems ? { requiredItems: method.requiredItems } : {}),
    }))

    return {
      levelNumber: index + 1,
      levelDisplay: levelInfo.display,
      ...(actualLevel !== undefined ? { actualLevel } : {}),
      ...(deriveGuestVariantLabel(variant.name, familyName)
        ? { variantName: deriveGuestVariantLabel(variant.name, familyName) }
        : {}),
      name: variant.name,
      damage: variant.damage,
      stats: variant.stats,
      sourceUrl: variant.forumUrl,
      description: variant.description,
      ...(variant.imageUrl ? { imageUrl: variant.imageUrl } : {}),
      ...(variant.alternativeImages ? { alternativeImages: variant.alternativeImages } : {}),
      obtainVariants,
      ...(variant.elements[0] ? { element: variant.elements[0] } : {}),
      ...(variant.rarity && variant.rarity !== 'Unknown' ? { rarity: variant.rarity } : {}),
      ...(variant.attacks.length > 0 ? { attacks: variant.attacks } : {}),
      guestStats: variant.guestStats,
      ...(variant.notes ? { notes: variant.notes } : {}),
    }
  })

  const mergedAlsoSee = Array.from(
    new Map(
      variants
        .flatMap((variant) => variant.alsoSee)
        .filter((ref) => !allInternalSlugs.has(ref.slug))
        .map((ref) => [`${ref.type}:${ref.slug}`, ref])
    ).values()
  )

  const family: ItemFamily = {
    id: prefixedSlug(familyName, 'guest'),
    familyName,
    slug: prefixedSlug(familyName, 'guest'),
    aliasSlugs: variants.map((variant) => variant.slug),
    type: 'guest',
    forumUrl: stub.forumUrl,
    familyOrigin: 'single-thread',
    isMultiPost: true,
    shared: {
      description: '',
      ...(() => {
        const trailingVariantWithImage = [...levelVariants]
          .reverse()
          .find(
            (level) =>
              level.imageUrl || (level.alternativeImages && level.alternativeImages.length > 0)
          )
        return trailingVariantWithImage
          ? {
              ...(trailingVariantWithImage.imageUrl
                ? { imageUrl: trailingVariantWithImage.imageUrl }
                : {}),
              ...(trailingVariantWithImage.alternativeImages
                ? { alternativeImages: trailingVariantWithImage.alternativeImages }
                : {}),
            }
          : {}
      })(),
      ...(sharedNotes ? { notes: sharedNotes } : {}),
      ...(mergedAlsoSee.length > 0 ? { alsoSee: mergedAlsoSee } : {}),
    },
    levelVariants,
    releaseDate:
      variants.map((variant) => variant.releaseDate).find((date) => date && date !== 'Unknown') ??
      'Unknown',
    tags: Array.from(new Set(variants.flatMap((variant) => variant.tags))).sort(),
    hasDA: false,
    hasDC: false,
    hasDM: false,
    hasFree: false,
    hasMerge: false,
    isTemp: variants.some((variant) => variant.isTemp === true) || undefined,
    isRare: variants.some((variant) => variant.isRare === true) || undefined,
    isSeasonal: variants.some((variant) => variant.isSeasonal === true) || undefined,
    isSpecialOffer: variants.some((variant) => variant.isSpecialOffer === true) || undefined,
    retired:
      variants.some(
        (variant) => variant.retired === true || hasRetiredGuestSignal(variant.notes)
      ) || undefined,
    levelRange: '',
    elements: Array.from(new Set(variants.flatMap((variant) => variant.elements))),
  }

  return computeFamilyFlags(family)
}

function applySupplementalGuestData(
  items: Array<Guest | ItemFamily>,
  supplementalNotesByForumUrl: Map<string, string>,
  supplementalMediaByForumUrl: Map<
    string,
    { imageUrl?: string; alternativeImages?: AlternativeImage[] }
  >
): Array<Guest | ItemFamily> {
  return items.map((item) => {
    const supplementalNotes = supplementalNotesByForumUrl.get(item.forumUrl)
    const supplementalMedia = supplementalMediaByForumUrl.get(item.forumUrl)
    if (!supplementalNotes && !supplementalMedia) return item

    if ('levelVariants' in item && item.type === 'guest') {
      return sanitizeGuestFamilyLevelVariants({
        ...item,
        shared: {
          ...item.shared,
          ...(supplementalNotes
            ? { notes: mergeNotesText(item.shared.notes, supplementalNotes) }
            : {}),
          ...((item.shared.imageUrl ?? supplementalMedia?.imageUrl)
            ? { imageUrl: item.shared.imageUrl ?? supplementalMedia?.imageUrl }
            : {}),
          ...((item.shared.alternativeImages ?? supplementalMedia?.alternativeImages)
            ? {
                alternativeImages:
                  item.shared.alternativeImages ?? supplementalMedia?.alternativeImages,
              }
            : {}),
        },
      })
    }

    if (!('levelVariants' in item)) {
      return sanitizeGuestMedia({
        ...item,
        ...(supplementalNotes ? { notes: mergeNotesText(item.notes, supplementalNotes) } : {}),
        ...((item.imageUrl ?? supplementalMedia?.imageUrl)
          ? { imageUrl: item.imageUrl ?? supplementalMedia?.imageUrl }
          : {}),
        ...((item.alternativeImages ?? supplementalMedia?.alternativeImages)
          ? { alternativeImages: item.alternativeImages ?? supplementalMedia?.alternativeImages }
          : {}),
      })
    }

    return item
  })
}

function sanitizePromotedGuestEntries(items: Array<Guest | ItemFamily>): Array<Guest | ItemFamily> {
  return items.map((item) => {
    if ('levelVariants' in item && item.type === 'guest') {
      return sanitizeGuestFamilyLevelVariants(item)
    }

    if (!('levelVariants' in item)) {
      return sanitizeGuestMedia(item)
    }

    return item
  })
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

  const chronology = parseChronology(chronoHtml)
  console.log(`✅ Found ${chronology.guestNames.size} guests in Chronology\n`)

  // ── Step 2: Fetch A-Z page ─────────────────────────────────────────────────

  console.log('📄 Fetching A-Z Pets & Guests master page...')
  let azHtml = ''
  try {
    azHtml = await fetchPage(AZ_PETS_URL, cookie)
  } catch (err) {
    console.error(`❌ A-Z page fetch failed: ${err}`)
    process.exit(1)
  }

  let allStubs = parseAZPage(azHtml, chronology)
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
    stubs = allStubs.filter((s) => lettersArg.includes(s.letter))
    console.log(`   Filtered to letters ${lettersArg.join(', ')}: ${stubs.length} entries`)
  } else if (letterArg) {
    // Filter by single letter: --letter=A
    stubs = allStubs.filter((s) => s.letter === letterArg)
    console.log(`   Filtered to letter ${letterArg}: ${stubs.length} entries`)
  } else if (startArg) {
    // Resume from letter: --start=C
    let past = false
    stubs = allStubs.filter((s) => {
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
    const base = stub.name
      .replace(/\s*\([^)]+\)\s*$/, '')
      .trim()
      .toLowerCase()
    if (base !== stub.name.toLowerCase()) nameToSlug.set(base, { slug: stub.slug, type: stub.type })
  }

  // ── Step 3: Load existing progress ─────────────────────────────────────────

  const progressMap = new Map<string, Guest | ItemFamily>()
  const supplementalNotesByForumUrl = new Map<string, string>()
  const supplementalMediaByForumUrl = new Map<
    string,
    { imageUrl?: string; alternativeImages?: AlternativeImage[] }
  >()
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
    const cachedEntry =
      progressMap.get(stub.slug) ??
      Array.from(progressMap.values()).find((entry) => entry.forumUrl === stub.forumUrl)
    if (cachedEntry) {
      console.log('✓ [cached]')
      fromCache++
      continue
    }

    try {
      let sourcePosts: ThreadPostContent[] = []
      let fullThreadHtml = ''
      try {
        fullThreadHtml = await fetchThreadPages(stub.messageId, cookie)
        sourcePosts = extractThreadPostContents(fullThreadHtml)
      } catch {
        sourcePosts = []
      }

      const html =
        sourcePosts.length > 0
          ? sourcePosts.map((post) => post.html).join('\n<hr>\n')
          : await fetchGuestPostContent(stub.messageId, cookie)
      if (!html) {
        console.log('⚠️  deleted — skipping')
        skipped++
        continue
      }

      if (!supplementalNotesByForumUrl.has(stub.forumUrl) && fullThreadHtml) {
        try {
          const supplementalNotes = extractSupplementalGuestThreadNotes(fullThreadHtml)
          if (supplementalNotes) {
            supplementalNotesByForumUrl.set(stub.forumUrl, supplementalNotes)
          }
          const supplementalMedia = extractSupplementalGuestThreadMedia(fullThreadHtml)
          if (supplementalMedia.imageUrl || supplementalMedia.alternativeImages?.length) {
            supplementalMediaByForumUrl.set(stub.forumUrl, supplementalMedia)
          }
        } catch {
          // Ignore supplemental note fetch failures and continue with printable data.
        }
      }

      const variantSections = extractGuestVariantSections(html, sourcePosts)
      const stubBaseName = normalizeGuestLookupName(stripTrailingVariantNumber(stub.name))
      const scopedVariantSections = variantSections.filter(
        (section) =>
          normalizeGuestLookupName(stripTrailingVariantNumber(section.name)) === stubBaseName
      )
      const candidateVariantSections =
        scopedVariantSections.length > 0 ? scopedVariantSections : variantSections
      if (candidateVariantSections.length > 1) {
        const family = buildGuestFamilyFromSections(
          stub,
          candidateVariantSections,
          chronology,
          nameToSlug,
          supplementalNotesByForumUrl.get(stub.forumUrl)
        )
        progressMap.set(family.slug, family)
        console.log(`✓ [ItemFamily: ${candidateVariantSections.length} variants]`)
        scraped++

        const progress = Array.from(progressMap.values())
        fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2) + '\n', 'utf-8')
        if (i < stubs.length - 1) await sleep(DELAY_MS)
        continue
      }

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

      const guest: Guest = sanitizeGuestMedia({
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
        evolutions: [], // Guests typically don't evolve
        releaseDate:
          chronology.datesByMessageId.get(stub.messageId) ||
          chronology.datesByName.get(stub.name.toLowerCase()) ||
          chronology.datesByName.get(
            stub.name
              .replace(/\s*\([^)]+\)\s*$/, '')
              .trim()
              .toLowerCase()
          ) ||
          'Unknown',
        imageUrl,
        forumUrl: stub.forumUrl,
        notes,
        alsoSee,
        tags,
        guestStats,
        retired: categoryTags.retired || hasRetiredGuestSignal(notes) || undefined,
        alternativeImages: alternativeImages.length > 0 ? alternativeImages : undefined,
      })

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
        console.log(
          `   ⏱️  Progress: ${scraped + fromCache}/${stubs.length} | ${elapsed}s elapsed | ETA ${eta}s`
        )
      }
    } catch (err) {
      console.log(` ❌ error: ${err} — skipping`)
      skipped++
    }

    if (i < stubs.length - 1) await sleep(DELAY_MS)
  }

  console.log(`\n✅ Scraped: ${scraped}  Cached: ${fromCache}  Skipped: ${skipped}`)

  // ── Step 5: Write final output ─────────────────────────────────────────────

  const hydratedGuests = applySupplementalGuestData(
    Array.from(progressMap.values()) as Array<Guest | ItemFamily>,
    supplementalNotesByForumUrl,
    supplementalMediaByForumUrl
  )
  const promotedGuests = applySupplementalGuestData(
    repairAccessFlags(
      sanitizePromotedGuestEntries(
        canonicalizePromotedRelationships(promoteCrossPostFamilies(hydratedGuests))
      )
    ),
    supplementalNotesByForumUrl,
    supplementalMediaByForumUrl
  )
  const finalGuests = promotedGuests.sort((a, b) => {
    const aName: string = 'familyName' in a ? a.familyName : a.name
    const bName: string = 'familyName' in b ? b.familyName : b.name
    return compareTitles(aName, bName)
  })

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(finalGuests, null, 2) + '\n', 'utf-8')

  console.log(`\n📁 Written ${finalGuests.length} guests to guests.json`)
  console.log(`📁 Progress file (${progressMap.size} total) saved to guests-progress.json`)
  console.log('\n🎉 Done!')
  console.log('\n📊 Summary:')
  console.log(`   Total stubs:   ${allStubs.length}`)
  console.log(`   In progress:   ${progressMap.size}`)
  console.log(`   Guests:        ${finalGuests.filter((g) => g.type === 'guest').length}`)
  console.log(`   With images:   ${finalGuests.filter(hasRequiredGuestImage).length}`)
  console.log(`   Missing images:${finalGuests.filter((g) => !hasRequiredGuestImage(g)).length}`)
  console.log(
    `   With dates:    ${finalGuests.filter((g) => 'releaseDate' in g && g.releaseDate !== 'Unknown').length}`
  )
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
