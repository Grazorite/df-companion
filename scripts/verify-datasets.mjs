import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Cross-post-family invariant checks for family-capable datasets.
 *
 * These checks guard the failure modes that the cross-post-family promotion
 * pipeline can silently introduce. They are intentionally cheap (pure data
 * inspection, no network) and complement the per-file validate-*.mjs scripts.
 *
 * Findings are split by severity:
 *
 *   ERRORS (fail the build) — unambiguous corruption that breaks navigation or
 *   de-duplication:
 *     - duplicate canonical slugs across a category
 *     - Also See / evolution refs that point at an alias slug instead of the
 *       canonical family slug (promotion rewrite missed them)
 *     - Also See refs that link back to the entry itself
 *     - Also See refs with no local target and no url
 *
 *   WARNINGS (reported, non-fatal) — data smells that need a scraper-side fix
 *   plus a re-scrape to resolve, and cannot be corrected safely by hand:
 *     - one alias slug claimed by two different families (e.g. same base name
 *       across different release years)
 *     - an alias slug also emitted as a standalone entry (promotion did not
 *       absorb the duplicate)
 *
 * A family listing its own slug in aliasSlugs is an intentional same-thread
 * convention (self-canonicalizing) and is ignored.
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = resolve(__dirname, '../src/data')

const categories = [
  {
    label: 'accessories',
    files: [
      'artifacts.json',
      'belts.json',
      'bracers.json',
      'capes-wings-a-l.json',
      'capes-wings-m-z.json',
      'helms-a-l.json',
      'helms-m-z.json',
      'necklaces.json',
      'rings.json',
      'trinkets.json',
    ],
  },
  {
    label: 'weapons',
    files: [
      'weapons-swords-axes-maces-a-g.json',
      'weapons-swords-axes-maces-h-n.json',
      'weapons-swords-axes-maces-o-z.json',
      'weapons-staves-wands-a-g.json',
      'weapons-staves-wands-h-n.json',
      'weapons-staves-wands-o-z.json',
      'weapons-daggers-a-g.json',
      'weapons-daggers-h-n.json',
      'weapons-daggers-o-z.json',
      'weapons-scythes-a-j.json',
      'weapons-scythes-k-z.json',
    ],
  },
  {
    label: 'pets/guests',
    files: ['pets.json', 'guests.json'],
  },
]

function isFamily(entry) {
  return Array.isArray(entry.levelVariants) && typeof entry.familyName === 'string'
}

function displayName(entry) {
  return isFamily(entry) ? entry.familyName : entry.name
}

function getRefs(entry) {
  const refs = isFamily(entry) ? entry.shared?.alsoSee : entry.alsoSee
  return Array.isArray(refs) ? refs : []
}

function loadEntries(files) {
  const loaded = []
  for (const file of files) {
    const filePath = resolve(DATA_DIR, file)
    if (!existsSync(filePath)) continue
    let parsed
    try {
      parsed = JSON.parse(readFileSync(filePath, 'utf-8'))
    } catch (error) {
      throw new Error(`Failed to parse ${file}: ${error.message}`)
    }
    if (!Array.isArray(parsed)) {
      throw new Error(`${file}: dataset must be an array`)
    }
    for (const entry of parsed) loaded.push({ file, entry })
  }
  return loaded
}

function verifyCategory({ label, files }) {
  const errors = []
  const warnings = []

  let loaded
  try {
    loaded = loadEntries(files)
  } catch (error) {
    errors.push(error.message)
    return { label, count: 0, errors, warnings }
  }

  // Category not yet populated (e.g. weapons before first scrape) — nothing to check.
  if (loaded.length === 0) return { label, count: 0, errors, warnings }

  const canonicalSlugs = new Set()
  const aliasToFamily = new Map() // aliasSlug -> family slug that owns it

  // Pass 1: canonical slugs.
  for (const { file, entry } of loaded) {
    const prefix = `${label} · ${file} · "${displayName(entry) || 'unnamed'}"`
    if (typeof entry.slug !== 'string' || entry.slug.length === 0) {
      errors.push(`${prefix}: entry is missing a slug`)
      continue
    }
    if (canonicalSlugs.has(entry.slug)) {
      errors.push(`${prefix}: duplicate canonical slug "${entry.slug}"`)
    }
    canonicalSlugs.add(entry.slug)
  }

  // Pass 2: alias ownership.
  for (const { file, entry } of loaded) {
    if (!isFamily(entry)) continue
    const prefix = `${label} · ${file} · "${displayName(entry)}"`
    const aliasSlugs = Array.isArray(entry.aliasSlugs) ? entry.aliasSlugs : []

    for (const alias of aliasSlugs) {
      // A family listing its own slug as an alias is intentional (self-canonicalizing).
      if (alias === entry.slug) continue
      const owner = aliasToFamily.get(alias)
      if (owner && owner !== entry.slug) {
        warnings.push(
          `${prefix}: aliasSlug "${alias}" is also claimed by family "${owner}" (ambiguous canonicalization — likely same base name across releases)`
        )
        continue
      }
      aliasToFamily.set(alias, entry.slug)
    }
  }

  // An alias slug must never surface as a standalone entry's canonical slug.
  for (const [alias, owner] of aliasToFamily) {
    if (canonicalSlugs.has(alias)) {
      warnings.push(
        `${label}: aliasSlug "${alias}" (owned by family "${owner}") is also emitted as a standalone entry — promotion did not absorb the duplicate`
      )
    }
  }

  // Pass 3: Also See + evolution canonicalization.
  for (const { file, entry } of loaded) {
    const prefix = `${label} · ${file} · "${displayName(entry)}"`
    const selfSlugs = new Set([
      entry.slug,
      ...(Array.isArray(entry.aliasSlugs) ? entry.aliasSlugs : []),
    ])

    for (const ref of getRefs(entry)) {
      const refName = ref?.name ?? 'unnamed'
      if (typeof ref?.slug !== 'string' || ref.slug.length === 0) {
        errors.push(`${prefix}: alsoSee ref "${refName}" is missing a slug`)
        continue
      }
      if (selfSlugs.has(ref.slug)) {
        errors.push(`${prefix}: alsoSee ref "${refName}" links back to itself`)
        continue
      }
      if (aliasToFamily.has(ref.slug)) {
        errors.push(
          `${prefix}: alsoSee ref "${refName}" points to alias slug "${ref.slug}" — it should point to canonical family slug "${aliasToFamily.get(ref.slug)}"`
        )
        continue
      }
      if (!canonicalSlugs.has(ref.slug) && typeof ref.url !== 'string') {
        errors.push(
          `${prefix}: alsoSee ref "${refName}" ("${ref.slug}") has no local target and no url`
        )
      }
    }

    if (Array.isArray(entry.evolutions)) {
      for (const evolution of entry.evolutions) {
        const slug = evolution?.resultSlug
        if (typeof slug !== 'string' || slug.length === 0) continue
        if (aliasToFamily.has(slug)) {
          errors.push(
            `${prefix}: evolution "${evolution.resultName ?? slug}" points to alias slug "${slug}" — it should point to canonical family slug "${aliasToFamily.get(slug)}"`
          )
        }
      }
    }
  }

  return { label, count: loaded.length, errors, warnings }
}

const results = categories.map(verifyCategory)
const allErrors = results.flatMap((result) => result.errors)
const allWarnings = results.flatMap((result) => result.warnings)

for (const result of results) {
  const status = result.errors.length > 0 ? '❌' : result.warnings.length > 0 ? '⚠️ ' : '✅'
  const notes = []
  if (result.errors.length > 0) notes.push(`${result.errors.length} error(s)`)
  if (result.warnings.length > 0) notes.push(`${result.warnings.length} warning(s)`)
  const suffix = notes.length > 0 ? ` — ${notes.join(', ')}` : ''
  console.log(`${status} ${result.label}: ${result.count} entries${suffix}`)
}

if (allWarnings.length > 0) {
  console.warn(`\n⚠️  ${allWarnings.length} warning(s) (non-fatal, need a scraper-side fix):\n`)
  allWarnings.forEach((warning) => console.warn(`  • ${warning}`))
}

if (allErrors.length > 0) {
  console.error(`\n❌ Dataset verification failed with ${allErrors.length} error(s):\n`)
  allErrors.forEach((error) => console.error(`  • ${error}`))
  process.exit(1)
}

console.log('\n✅ All family-capable datasets pass cross-post-family error invariants.')
