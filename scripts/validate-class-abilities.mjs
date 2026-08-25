import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const files = [
  ['class', 'classes.json'],
  ['consumable', 'class-consumables.json'],
]

let total = 0
const bySubtype = {
  class: 0,
  consumable: 0,
}
const CONSUMABLE_KIND_EXCEPTIONS = new Set(['Health Potion', 'Mana Potion'])

for (const [subtype, file] of files) {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'src/data', file), 'utf8'))
  if (!Array.isArray(data)) throw new Error(`${file} must contain an array`)
  const subtypeHasConsumableKinds =
    subtype === 'consumable' &&
    data.some((entry) =>
      Array.isArray(entry.levelVariants)
        ? entry.consumableKind || entry.levelVariants.some((variant) => variant.classAbilitySubtype)
        : entry.consumableKind
    )
  for (const entry of data) {
    const isFamily = Array.isArray(entry.levelVariants)
    const requiredKeys = isFamily
      ? ['id', 'familyName', 'slug', 'type', 'subtype', 'forumUrl', 'shared']
      : ['id', 'name', 'slug', 'type', 'subtype', 'forumUrl']
    for (const key of requiredKeys) {
      if (!entry[key]) throw new Error(`${file}: missing ${key}`)
    }
    const entryName = isFamily ? entry.familyName : entry.name
    if (/^(?:Alphabetical Consumables Listing|Consumables Sorted by Effects)$/i.test(entryName)) {
      throw new Error(`${file}: heading row was scraped as an entry: ${entryName}`)
    }
    if (entry.type !== 'class-ability') {
      throw new Error(`${file}: ${entryName} has invalid type`)
    }
    if (entry.subtype !== subtype) {
      throw new Error(`${file}: ${entryName} has invalid subtype ${entry.subtype}`)
    }
    if (isFamily) {
      if (subtype === 'consumable' && !entry.shared.description) {
        throw new Error(`${file}: ${entryName} missing description`)
      }
      if (entry.levelVariants.length === 0) throw new Error(`${file}: ${entryName} has no variants`)
      if (
        subtype === 'class' &&
        entry.classSubcategory === 'armor' &&
        !entry.shared.equipsClass &&
        !entry.levelVariants.some((variant) => variant.equipsClass)
      ) {
        throw new Error(`${file}: ${entryName} armor family missing equipsClass`)
      }
      for (const variant of entry.levelVariants) {
        if (!variant.name) throw new Error(`${file}: ${entryName} variant missing name`)
        if (
          subtypeHasConsumableKinds &&
          subtype === 'consumable' &&
          !variant.classAbilitySubtype &&
          !entry.consumableKind
        ) {
          throw new Error(`${file}: ${entryName} variant ${variant.name} missing consumable kind`)
        }
        if (!Array.isArray(variant.obtainVariants) || variant.obtainVariants.length === 0) {
          throw new Error(`${file}: ${entryName} variant ${variant.name} missing obtain methods`)
        }
      }
    } else if (subtype === 'consumable') {
      if (!entry.description) throw new Error(`${file}: ${entryName} missing description`)
      if (subtypeHasConsumableKinds && !entry.consumableKind && !CONSUMABLE_KIND_EXCEPTIONS.has(entryName)) {
        throw new Error(`${file}: ${entryName} missing consumable kind`)
      }
    } else if (subtype === 'class' && entry.classSubcategory === 'armor' && !entry.equipsClass) {
      throw new Error(`${file}: ${entryName} armor missing equipsClass`)
    }
    bySubtype[subtype] += 1
    total += 1
  }
}

const manifest = JSON.parse(
  fs.readFileSync(path.join(root, 'src/data/class-abilities-manifest.json'), 'utf8')
)
if (manifest.total !== total) {
  throw new Error(`class abilities manifest total ${manifest.total} != ${total}`)
}
for (const [subtype, count] of Object.entries(bySubtype)) {
  if (manifest.bySubtype[subtype] !== count) {
    throw new Error(`class abilities manifest ${subtype} ${manifest.bySubtype[subtype]} != ${count}`)
  }
}

console.log(`✅ class abilities valid: ${total} entries across ${files.length} subtypes`)
