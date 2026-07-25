import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = resolve(__dirname, '../src/data')
const ELEMENTS_PATH = resolve(DATA_DIR, 'elements.json')
const MANIFEST_PATH = resolve(DATA_DIR, 'weapon-manifest.json')

const subtypeFiles = [
  [
    'sword-axe-mace',
    [
      'weapons-swords-axes-maces-a-g.json',
      'weapons-swords-axes-maces-h-n.json',
      'weapons-swords-axes-maces-o-z.json',
    ],
  ],
  [
    'staff-wand',
    [
      'weapons-staves-wands-a-g.json',
      'weapons-staves-wands-h-n.json',
      'weapons-staves-wands-o-z.json',
    ],
  ],
  ['dagger', ['weapons-daggers-a-g.json', 'weapons-daggers-h-n.json', 'weapons-daggers-o-z.json']],
  ['scythe', ['weapons-scythes-a-j.json', 'weapons-scythes-k-z.json']],
]

let validElementCodes = new Set()
try {
  const elementData = JSON.parse(readFileSync(ELEMENTS_PATH, 'utf-8'))
  validElementCodes = new Set(elementData.elements.map((element) => element.code))
} catch (error) {
  console.error('❌ Failed to parse elements.json:', error.message)
  process.exit(1)
}

const errors = []
const slugSet = new Set()
const entriesBySubtype = Object.fromEntries(subtypeFiles.map(([subtype]) => [subtype, 0]))
let totalEntries = 0

for (const [expectedSubtype, filenames] of subtypeFiles) {
  for (const filename of filenames) {
    const path = resolve(DATA_DIR, filename)
    let entries = []

    try {
      entries = JSON.parse(readFileSync(path, 'utf-8'))
    } catch (error) {
      console.error(`❌ Failed to parse ${filename}:`, error.message)
      process.exit(1)
    }

    if (!Array.isArray(entries)) {
      errors.push(`${filename}: dataset must be an array`)
      continue
    }

    totalEntries += entries.length
    entriesBySubtype[expectedSubtype] += entries.length

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index]
      const isFamily = Array.isArray(entry.levelVariants)
      const name = isFamily ? entry.familyName : entry.name
      const prefix = `${filename} #${index + 1} ("${name || 'unnamed'}")`

      if (entry.type !== 'weapon') errors.push(`${prefix}: type must be "weapon"`)
      if (entry.subtype !== expectedSubtype) {
        errors.push(`${prefix}: subtype must be "${expectedSubtype}", got "${entry.subtype}"`)
      }
      if (typeof entry.slug !== 'string' || entry.slug.trim().length === 0) {
        errors.push(`${prefix}: missing slug`)
      } else if (slugSet.has(entry.slug)) {
        errors.push(`${prefix}: duplicate slug "${entry.slug}"`)
      } else {
        slugSet.add(entry.slug)
      }
      if (typeof entry.forumUrl !== 'string' || !entry.forumUrl.startsWith('http')) {
        errors.push(`${prefix}: invalid forumUrl`)
      }
      if (!Array.isArray(entry.elements)) {
        errors.push(`${prefix}: elements must be an array`)
      } else {
        for (const code of entry.elements) {
          if (!validElementCodes.has(code)) errors.push(`${prefix}: unknown element code "${code}"`)
        }
      }

      if (isFamily) {
        if (!entry.shared || typeof entry.shared.description !== 'string') {
          errors.push(`${prefix}: family shared.description must be present`)
        }
        if (!Array.isArray(entry.levelVariants) || entry.levelVariants.length === 0) {
          errors.push(`${prefix}: family must have at least one level variant`)
        }
        for (const flag of ['hasDA', 'hasDC', 'hasDM', 'hasFree', 'hasMerge']) {
          if (typeof entry[flag] !== 'boolean') errors.push(`${prefix}: ${flag} must be boolean`)
        }
        continue
      }

      for (const field of ['id', 'name', 'description', 'releaseDate']) {
        if (typeof entry[field] !== 'string') errors.push(`${prefix}: ${field} must be a string`)
      }
      if (!Array.isArray(entry.obtainMethods)) {
        errors.push(`${prefix}: obtainMethods must be an array`)
      }
    }
  }
}

try {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'))
  if (manifest.total !== totalEntries) {
    errors.push(`weapon-manifest.json: total must be ${totalEntries}, got ${manifest.total}`)
  }
  for (const [subtype] of subtypeFiles) {
    const expectedCount = entriesBySubtype[subtype]
    const manifestCount = manifest.bySubtype?.[subtype]
    if (manifestCount !== expectedCount) {
      errors.push(
        `weapon-manifest.json: bySubtype.${subtype} must be ${expectedCount}, got ${manifestCount}`
      )
    }
  }
} catch (error) {
  console.error('❌ Failed to parse weapon-manifest.json:', error.message)
  process.exit(1)
}

if (errors.length > 0) {
  console.error(`❌ weapon validation failed with ${errors.length} error(s):\n`)
  errors.forEach((error) => console.error(`  • ${error}`))
  process.exit(1)
}

console.log(
  `✅ weapons valid: ${totalEntries} entries across ${subtypeFiles.length} subtypes / ${subtypeFiles.reduce(
    (count, [, filenames]) => count + filenames.length,
    0
  )} data files`
)
