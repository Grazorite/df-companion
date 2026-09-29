import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DATA_DIR = resolve(ROOT, 'src/data')
const INDEX_PATH = resolve(DATA_DIR, 'search-index.json')
const BUDGET_BYTES = 1.5 * 1024 * 1024

function fail(message) {
  console.error(`❌ ${message}`)
  process.exit(1)
}

// 1. The committed index must parse as an array.
let committedRaw
try {
  committedRaw = readFileSync(INDEX_PATH, 'utf-8')
} catch (error) {
  fail(`Failed to read search-index.json: ${error.message}`)
}

let committed
try {
  committed = JSON.parse(committedRaw)
} catch (error) {
  fail(`search-index.json is not valid JSON: ${error.message}`)
}
if (!Array.isArray(committed)) fail('search-index.json must be an array')

// 2. Size budget.
const bytes = Buffer.byteLength(committedRaw, 'utf-8')
if (bytes > BUDGET_BYTES) {
  fail(`search-index.json is ${(bytes / 1024).toFixed(0)} KiB, over the 1.5 MiB decoded budget`)
}

// 3. Drift check: regenerate in-memory (via the tsx generator's --check mode) and compare bytes.
let regenerated
try {
  regenerated = execFileSync('npx', ['tsx', 'scripts/generate-search-index.ts', '--check'], {
    cwd: ROOT,
    encoding: 'utf-8',
    maxBuffer: 32 * 1024 * 1024,
  })
} catch (error) {
  fail(`Could not regenerate the search index for the drift check: ${error.message}`)
}
if (regenerated !== committedRaw) {
  fail(
    'search-index.json is stale — it does not match a fresh generation. ' +
      'Run `npm run generate:search-index` and commit the result.'
  )
}

// 4. Route resolution: every index route must point at a real entry slug in the datasets.
//    Build the set of known slugs (canonical + aliases) per section base, mirroring the loaders'
//    file → section mapping, then confirm each index url's slug is present.
const SECTION_FILES = {
  '/badges/': ['badges.json'],
  '/pets/': ['pets.json', 'guests.json'],
  '/guests/': ['pets.json', 'guests.json'],
  '/accessories/': [
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
  '/weapons/': [
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
  '/housing/': [
    'housing-houses.json',
    'housing-backgrounds.json',
    'housing-floors.json',
    'housing-rugs.json',
    'housing-shrubs.json',
    'housing-stuff.json',
    'housing-wall-items.json',
  ],
  '/classes/': [
    'class-armors.json',
    'class-regular.json',
    'class-miscellaneous.json',
    'class-consumables.json',
  ],
}

function readSlugs(files) {
  const slugs = new Set()
  for (const file of files) {
    let entries
    try {
      entries = JSON.parse(readFileSync(resolve(DATA_DIR, file), 'utf-8'))
    } catch {
      continue
    }
    if (!Array.isArray(entries)) continue
    for (const entry of entries) {
      if (typeof entry.slug === 'string') slugs.add(entry.slug)
      // Families expose alias slugs that resolve to the canonical detail page.
      if (Array.isArray(entry.aliasSlugs)) {
        for (const alias of entry.aliasSlugs) slugs.add(alias)
      }
    }
  }
  return slugs
}

const slugsByBase = new Map()
for (const [base, files] of Object.entries(SECTION_FILES)) {
  slugsByBase.set(base, readSlugs(files))
}

const unresolved = []
for (const record of committed) {
  const url = record.url ?? ''
  const base = Object.keys(SECTION_FILES).find((prefix) => url.startsWith(prefix))
  if (!base) {
    unresolved.push(`${url} (unknown section base)`)
    continue
  }
  const slug = url.slice(base.length).split('?')[0]
  if (!slugsByBase.get(base).has(slug)) {
    unresolved.push(`${url} (slug "${slug}" not found)`)
  }
}

if (unresolved.length > 0) {
  console.error(`❌ ${unresolved.length} search-index route(s) do not resolve to a real entry:`)
  unresolved.slice(0, 20).forEach((line) => console.error(`  • ${line}`))
  process.exit(1)
}

console.log(
  `✅ search-index.json valid: ${committed.length} records, ${(bytes / 1024).toFixed(0)} KiB ` +
    `(${((bytes / BUDGET_BYTES) * 100).toFixed(1)}% of budget), all routes resolve, no drift`
)
