/**
 * Build-time validation for pets.json
 * Checks required fields, element codes, slug uniqueness, Also See integrity.
 * Exits with code 1 if invalid — blocks builds/deploys.
 *
 * Run: node scripts/validate-pets.mjs
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PETS_PATH = resolve(__dirname, '../src/data/pets.json')
const GUESTS_PATH = resolve(__dirname, '../src/data/guests.json')
const ELEMENTS_PATH = resolve(__dirname, '../src/data/elements.json')
const MANIFEST_PATH = resolve(__dirname, '../src/data/pets-guests-manifest.json')

// Load elements reference
let validElementCodes = new Set()
let validMarkerCodes = new Set()
try {
  const elemData = JSON.parse(readFileSync(ELEMENTS_PATH, 'utf-8'))
  validElementCodes = new Set(elemData.elements.map((e) => e.code))
  const markerList = Array.isArray(elemData.markers) ? elemData.markers : elemData.traits
  if (!Array.isArray(markerList)) {
    throw new Error('elements.json must include a "traits" or "markers" array')
  }
  validMarkerCodes = new Set(markerList.map((m) => m.code))
} catch (e) {
  console.error('❌ Failed to parse elements.json:', e.message)
  process.exit(1)
}

// Load pets
let pets
try {
  pets = JSON.parse(readFileSync(PETS_PATH, 'utf-8'))
} catch {
  // pets.json may not exist yet — that's OK, validation is skipped
  console.log('⏭️  pets.json not found — skipping pet validation')
  process.exit(0)
}

if (!Array.isArray(pets)) {
  console.error('❌ pets.json must be an array')
  process.exit(1)
}

try {
  const guests = JSON.parse(readFileSync(GUESTS_PATH, 'utf-8'))
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'))
  const guestCount = Array.isArray(guests) ? guests.length : 0

  if (manifest.byType?.pet !== pets.length) {
    console.error(
      `❌ pets-guests-manifest.json byType.pet must be ${pets.length}, got ${manifest.byType?.pet}`
    )
    process.exit(1)
  }
  if (manifest.byType?.guest !== guestCount) {
    console.error(
      `❌ pets-guests-manifest.json byType.guest must be ${guestCount}, got ${manifest.byType?.guest}`
    )
    process.exit(1)
  }
  if (manifest.total !== pets.length + guestCount) {
    console.error(
      `❌ pets-guests-manifest.json total must be ${pets.length + guestCount}, got ${manifest.total}`
    )
    process.exit(1)
  }
} catch (e) {
  console.error('❌ Failed to parse pets-guests-manifest.json or guests.json:', e.message)
  process.exit(1)
}

const markerField = pets.some((p) => Array.isArray(p.specialMarkers)) ? 'specialMarkers' : 'traits'
const errors = []
const slugs = new Set()
const allSlugs = new Set(pets.map((p) => p.slug))

for (let i = 0; i < pets.length; i++) {
  const p = pets[i]

  // Check if this is an ItemFamily (multi-variant)
  const isFamily = p.levelVariants && Array.isArray(p.levelVariants)

  if (isFamily) {
    // ItemFamily validation
    const familyName = p.familyName || 'unnamed'
    const prefix = `Pet #${i + 1} ("${familyName}") [ItemFamily]`

    // Required fields for ItemFamily
    for (const field of ['id', 'familyName', 'slug', 'type', 'forumUrl']) {
      if (typeof p[field] !== 'string' || p[field].trim().length === 0) {
        errors.push(`${prefix}: missing or empty field "${field}"`)
      }
    }

    // Type must be pet or guest
    if (!['pet', 'guest'].includes(p.type)) {
      errors.push(`${prefix}: "type" must be "pet" or "guest", got "${p.type}"`)
    }

    // Slug must be type-prefixed
    if (p.slug && !/^(pet|guest)-[a-z0-9-]+$/.test(p.slug)) {
      errors.push(
        `${prefix}: slug "${p.slug}" must be prefixed with "pet-" or "guest-" and contain only [a-z0-9-]`
      )
    }

    // Slug uniqueness
    if (slugs.has(p.slug)) {
      errors.push(`${prefix}: duplicate slug "${p.slug}"`)
    }
    slugs.add(p.slug)

    // Shared data must exist
    if (!p.shared || typeof p.shared !== 'object') {
      errors.push(`${prefix}: missing "shared" object`)
    } else {
      if (typeof p.shared.description !== 'string') {
        errors.push(`${prefix}: shared.description must be a string`)
      }
    }

    // Level variants must be non-empty array
    if (!Array.isArray(p.levelVariants) || p.levelVariants.length === 0) {
      errors.push(`${prefix}: "levelVariants" must be a non-empty array`)
    }

    // Elements array
    if (!Array.isArray(p.elements)) {
      errors.push(`${prefix}: "elements" must be an array`)
    } else {
      for (const code of p.elements) {
        if (!validElementCodes.has(code)) {
          errors.push(`${prefix}: unknown element code "${code}"`)
        }
      }
    }

    // Boolean flags
    for (const flag of ['hasDA', 'hasDC', 'hasDM', 'hasFree', 'hasMerge']) {
      if (typeof p[flag] !== 'boolean') {
        errors.push(`${prefix}: "${flag}" must be boolean`)
      }
    }
  } else {
    // Regular Pet validation
    const prefix = `Pet #${i + 1} ("${p.name || 'unnamed'}")`

    // Required string fields
    for (const field of ['id', 'name', 'slug', 'type', 'forumUrl', 'releaseDate']) {
      if (typeof p[field] !== 'string' || p[field].trim().length === 0) {
        errors.push(`${prefix}: missing or empty field "${field}"`)
      }
    }

    if (typeof p.description !== 'string') {
      errors.push(`${prefix}: "description" must be a string`)
    }

    // Type must be pet or guest
    if (!['pet', 'guest'].includes(p.type)) {
      errors.push(`${prefix}: "type" must be "pet" or "guest", got "${p.type}"`)
    }

    // Slug must be type-prefixed and URL-safe
    if (p.slug && !/^(pet|guest)-[a-z0-9-]+$/.test(p.slug)) {
      errors.push(
        `${prefix}: slug "${p.slug}" must be prefixed with "pet-" or "guest-" and contain only [a-z0-9-]`
      )
    }

    // Slug uniqueness
    if (slugs.has(p.slug)) {
      errors.push(`${prefix}: duplicate slug "${p.slug}"`)
    }
    slugs.add(p.slug)

    // Boolean fields
    if (typeof p.daRequired !== 'boolean') {
      errors.push(`${prefix}: "daRequired" must be boolean`)
    }

    // Elements array
    if (!Array.isArray(p.elements)) {
      errors.push(`${prefix}: "elements" must be an array`)
    } else {
      for (const code of p.elements) {
        if (!validElementCodes.has(code)) {
          errors.push(`${prefix}: unknown element code "${code}"`)
        }
      }
    }

    // Special markers array
    if (!Array.isArray(p[markerField])) {
      errors.push(`${prefix}: "${markerField}" must be an array`)
    } else {
      for (const code of p[markerField]) {
        if (!validMarkerCodes.has(code)) {
          errors.push(`${prefix}: unknown marker code "${code}"`)
        }
      }
    }

    // Also See — verify slugs exist in dataset
    if (Array.isArray(p.alsoSee)) {
      for (const ref of p.alsoSee) {
        if (!allSlugs.has(ref.slug)) {
          // Warn but don't fail — may be resolved in a future scrape
          console.warn(
            `  ⚠️  ${prefix}: alsoSee ref "${ref.name}" (${ref.slug}) not found in dataset`
          )
        }
      }
    }

    // ForumUrl must be valid
    if (p.forumUrl && !p.forumUrl.startsWith('http')) {
      errors.push(`${prefix}: "forumUrl" is not a valid URL`)
    }
  }
}

if (errors.length > 0) {
  console.error(`❌ pets.json validation failed with ${errors.length} error(s):\n`)
  errors.forEach((e) => console.error(`  • ${e}`))
  process.exit(1)
} else {
  console.log(`✅ pets.json valid: ${pets.length} entries, all fields correct`)
}
