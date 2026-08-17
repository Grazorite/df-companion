import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const files = [
  'housing-houses.json',
  'housing-backgrounds.json',
  'housing-floors.json',
  'housing-rugs.json',
  'housing-shrubs.json',
  'housing-stuff.json',
  'housing-wall-items.json',
]

let total = 0
const bySubtype = {
  house: 0,
  background: 0,
  floor: 0,
  rug: 0,
  shrub: 0,
  stuff: 0,
  'wall-item': 0,
}

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'src/data', file), 'utf8'))
  if (!Array.isArray(data)) throw new Error(`${file} must contain an array`)
  for (const entry of data) {
    const isFamily = Array.isArray(entry.levelVariants)
    const requiredKeys = isFamily
      ? ['id', 'familyName', 'slug', 'type', 'subtype', 'forumUrl', 'shared']
      : ['id', 'name', 'slug', 'type', 'subtype', 'description', 'forumUrl']
    for (const key of requiredKeys) {
      if (!entry[key]) throw new Error(`${file}: missing ${key}`)
    }
    const entryName = isFamily ? entry.familyName : entry.name
    if (entry.type !== 'housing') throw new Error(`${file}: ${entryName} has invalid type`)
    if (!(entry.subtype in bySubtype)) throw new Error(`${file}: invalid subtype ${entry.subtype}`)
    if (isFamily) {
      if (!entry.shared.description) throw new Error(`${file}: ${entryName} missing description`)
      if (!entry.hasDA) throw new Error(`${file}: ${entryName} should be DA required`)
      if (entry.levelVariants.length === 0) throw new Error(`${file}: ${entryName} has no variants`)
      for (const variant of entry.levelVariants) {
        if (!variant.name) throw new Error(`${file}: ${entryName} variant missing name`)
        if (!Array.isArray(variant.obtainVariants) || variant.obtainVariants.length === 0) {
          throw new Error(`${file}: ${entryName} variant ${variant.name} missing obtain methods`)
        }
      }
    } else if (entry.daRequired !== true) {
      throw new Error(`${file}: ${entryName} should be DA required`)
    }
    bySubtype[entry.subtype] += 1
    total += 1
  }
}

const manifest = JSON.parse(
  fs.readFileSync(path.join(root, 'src/data/housing-manifest.json'), 'utf8')
)
if (manifest.total !== total) throw new Error(`housing manifest total ${manifest.total} != ${total}`)
for (const [subtype, count] of Object.entries(bySubtype)) {
  if (manifest.bySubtype[subtype] !== count) {
    throw new Error(`housing manifest ${subtype} ${manifest.bySubtype[subtype]} != ${count}`)
  }
}

console.log(`✅ housing valid: ${total} entries across ${files.length} subtypes`)
