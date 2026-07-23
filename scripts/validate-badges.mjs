/**
 * Build-time validation for badges.json
 * Checks required fields, valid categories, forum links, etc.
 * Exits with code 1 if invalid — will block builds/deploys.
 *
 * Run: node scripts/validate-badges.mjs
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BADGES_PATH = resolve(__dirname, '../src/data/badges.json')
const MANIFEST_PATH = resolve(__dirname, '../src/data/badges-manifest.json')

const VALID_CATEGORIES = ['quest-completion', 'combat', 'collection', 'seasonal', 'misc']

let badges
try {
  badges = JSON.parse(readFileSync(BADGES_PATH, 'utf-8'))
} catch (e) {
  console.error('❌ Failed to parse badges.json:', e.message)
  process.exit(1)
}

if (!Array.isArray(badges)) {
  console.error('❌ badges.json must be an array')
  process.exit(1)
}

try {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'))
  if (manifest.total !== badges.length) {
    console.error(`❌ badges-manifest.json total must be ${badges.length}, got ${manifest.total}`)
    process.exit(1)
  }
} catch (e) {
  console.error('❌ Failed to parse badges-manifest.json:', e.message)
  process.exit(1)
}

const errors = []
const slugs = new Set()

for (let i = 0; i < badges.length; i++) {
  const b = badges[i]
  const prefix = `Badge #${i} ("${b.name || 'unnamed'}")`

  // Required string fields
  for (const field of ['id', 'name', 'slug', 'description', 'category', 'requirements']) {
    if (typeof b[field] !== 'string' || b[field].trim().length === 0) {
      errors.push(`${prefix}: missing or empty field "${field}"`)
    }
  }

  // Valid category
  if (!VALID_CATEGORIES.includes(b.category)) {
    errors.push(
      `${prefix}: invalid category "${b.category}" (valid: ${VALID_CATEGORIES.join(', ')})`
    )
  }

  // Boolean fields
  if (typeof b.daRequired !== 'boolean') {
    errors.push(`${prefix}: "daRequired" must be boolean`)
  }
  if (typeof b.retired !== 'boolean') {
    errors.push(`${prefix}: "retired" must be boolean`)
  }

  // Forum links
  if (!Array.isArray(b.forumLinks) || b.forumLinks.length === 0) {
    errors.push(`${prefix}: must have at least 1 forum link`)
  } else {
    for (const link of b.forumLinks) {
      if (!link.url || !link.url.startsWith('http')) {
        errors.push(`${prefix}: forum link has invalid URL "${link.url}"`)
      }
      if (!link.title) {
        errors.push(`${prefix}: forum link missing title`)
      }
    }
  }

  // howToObtain
  if (!Array.isArray(b.howToObtain) || b.howToObtain.length === 0) {
    errors.push(`${prefix}: must have at least 1 howToObtain step`)
  } else {
    for (const [stepIndex, step] of b.howToObtain.entries()) {
      if (typeof step.instruction !== 'string' || step.instruction.trim().length === 0) {
        errors.push(`${prefix}: howToObtain[${stepIndex}] missing instruction`)
      }
      if (step.daRequired !== undefined && typeof step.daRequired !== 'boolean') {
        errors.push(`${prefix}: howToObtain[${stepIndex}].daRequired must be boolean when present`)
      }
    }
  }

  // Slug uniqueness
  if (slugs.has(b.slug)) {
    errors.push(`${prefix}: duplicate slug "${b.slug}"`)
  }
  slugs.add(b.slug)
}

if (errors.length > 0) {
  console.error(`❌ badges.json validation failed with ${errors.length} error(s):\n`)
  errors.forEach((e) => console.error(`  • ${e}`))
  process.exit(1)
} else {
  console.log(`✅ badges.json valid: ${badges.length} badges, all fields correct`)
}
