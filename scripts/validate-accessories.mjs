import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = resolve(__dirname, '../src/data')
const ELEMENTS_PATH = resolve(DATA_DIR, 'elements.json')

const subtypeFiles = [
  ['artifact', 'artifacts.json'],
  ['belt', 'belts.json'],
  ['bracer', 'bracers.json'],
  ['cape-wing', 'capes-wings.json'],
  ['helm', 'helms.json'],
  ['necklace', 'necklaces.json'],
  ['ring', 'rings.json'],
  ['trinket', 'trinkets.json'],
]

let validElementCodes = new Set()
try {
  const elementData = JSON.parse(readFileSync(ELEMENTS_PATH, 'utf-8'))
  validElementCodes = new Set(elementData.elements.map(element => element.code))
} catch (error) {
  console.error('❌ Failed to parse elements.json:', error.message)
  process.exit(1)
}

const errors = []
const slugSet = new Set()
let totalEntries = 0

for (const [expectedSubtype, filename] of subtypeFiles) {
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

  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index]
    const isFamily = Array.isArray(entry.levelVariants)
    const name = isFamily ? entry.familyName : entry.name
    const prefix = `${filename} #${index + 1} ("${name || 'unnamed'}")`

    if (entry.type !== 'accessory') {
      errors.push(`${prefix}: type must be "accessory"`)
    }

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
        if (!validElementCodes.has(code)) {
          errors.push(`${prefix}: unknown element code "${code}"`)
        }
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
        if (typeof entry[flag] !== 'boolean') {
          errors.push(`${prefix}: ${flag} must be boolean`)
        }
      }
      continue
    }

    for (const field of ['id', 'name', 'description', 'releaseDate']) {
      if (typeof entry[field] !== 'string') {
        errors.push(`${prefix}: ${field} must be a string`)
      }
    }

    if (!Array.isArray(entry.obtainMethods)) {
      errors.push(`${prefix}: obtainMethods must be an array`)
    }
  }
}

if (errors.length > 0) {
  console.error(`❌ accessory validation failed with ${errors.length} error(s):\n`)
  errors.forEach(error => console.error(`  • ${error}`))
  process.exit(1)
}

console.log(`✅ accessories valid: ${totalEntries} entries across ${subtypeFiles.length} subtype files`)
