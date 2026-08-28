import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const DATA_DIR = path.resolve(import.meta.dirname, '../src/data')
const OUTPUT_PATH = path.join(DATA_DIR, 'badge-relations.json')

const BADGE_AWARD_PATTERN =
  /\bOwn\s+(?:this|any)\s+(?:item|armor|weapon|house style|house|pet|guest)\s+to\s+obtain\s+(?:the\s+)?([^.\n;]+?)\s+badges?\b/gi

const dataFiles = [
  { file: 'pets.json', type: 'pet-guest' },
  { file: 'guests.json', type: 'pet-guest' },
  { file: 'artifacts.json', type: 'accessory' },
  { file: 'belts.json', type: 'accessory' },
  { file: 'bracers.json', type: 'accessory' },
  { file: 'capes-wings-a-l.json', type: 'accessory' },
  { file: 'capes-wings-m-z.json', type: 'accessory' },
  { file: 'helms-a-l.json', type: 'accessory' },
  { file: 'helms-m-z.json', type: 'accessory' },
  { file: 'necklaces.json', type: 'accessory' },
  { file: 'rings.json', type: 'accessory' },
  { file: 'trinkets.json', type: 'accessory' },
  { file: 'weapons-swords-axes-maces-a-g.json', type: 'weapon' },
  { file: 'weapons-swords-axes-maces-h-n.json', type: 'weapon' },
  { file: 'weapons-swords-axes-maces-o-z.json', type: 'weapon' },
  { file: 'weapons-staves-wands-a-g.json', type: 'weapon' },
  { file: 'weapons-staves-wands-h-n.json', type: 'weapon' },
  { file: 'weapons-staves-wands-o-z.json', type: 'weapon' },
  { file: 'weapons-daggers-a-g.json', type: 'weapon' },
  { file: 'weapons-daggers-h-n.json', type: 'weapon' },
  { file: 'weapons-daggers-o-z.json', type: 'weapon' },
  { file: 'weapons-scythes-a-j.json', type: 'weapon' },
  { file: 'weapons-scythes-k-z.json', type: 'weapon' },
  { file: 'housing-houses.json', type: 'housing' },
  { file: 'housing-backgrounds.json', type: 'housing' },
  { file: 'housing-floors.json', type: 'housing' },
  { file: 'housing-rugs.json', type: 'housing' },
  { file: 'housing-shrubs.json', type: 'housing' },
  { file: 'housing-stuff.json', type: 'housing' },
  { file: 'housing-wall-items.json', type: 'housing' },
  { file: 'classes.json', type: 'class-ability' },
  { file: 'class-consumables.json', type: 'class-ability' },
]

const accessoryLabels = {
  artifact: 'Artifact',
  belt: 'Belt',
  bracer: 'Bracer',
  'cape-wing': 'Cape & Wing',
  helm: 'Helm',
  necklace: 'Necklace',
  ring: 'Ring',
  trinket: 'Trinket',
}

const weaponLabels = {
  'sword-axe-mace': 'Sword / Axe / Mace',
  'staff-wand': 'Staff / Wand',
  dagger: 'Dagger',
  scythe: 'Scythe',
}

const housingLabels = {
  house: 'House',
  background: 'Background',
  floor: 'Floor',
  rug: 'Rug',
  shrub: 'Shrub',
  stuff: 'Stuff',
  'wall-item': 'Wall Item',
}

const classLabels = {
  armor: 'Armor',
  regular: 'Regular Class',
  miscellaneous: 'Miscellaneous Class',
}

function readJson(file) {
  return JSON.parse(readFileSync(path.join(DATA_DIR, file), 'utf8'))
}

function normalizeBadgeName(name) {
  return name
    .replace(/\([^)]*\)/g, ' ')
    .replace(/^the\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeBadgeLookupKey(value) {
  return normalizeBadgeName(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function splitBadgeList(value) {
  return value
    .split(/\s*(?:,|&|\band\b)\s*/i)
    .map(normalizeBadgeName)
    .filter(Boolean)
}

function extractAwardedBadgeNames(texts) {
  const names = []
  for (const text of texts) {
    if (!text) continue
    for (const match of text.matchAll(BADGE_AWARD_PATTERN)) {
      names.push(...splitBadgeList(match[1] ?? ''))
    }
  }
  return [...new Set(names)]
}

function collectStrings(value, strings = []) {
  if (typeof value === 'string') strings.push(value)
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, strings))
  else if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectStrings(item, strings))
  }
  return strings
}

function displayName(entry) {
  return entry.familyName ?? entry.name ?? entry.slug
}

function itemAliases(entry) {
  const aliases = new Set()
  for (const source of entry.familySources ?? []) {
    if (source.title) aliases.add(source.title)
    if (source.variantLabel) aliases.add(source.variantLabel)
  }
  for (const source of entry.sourceLinks ?? []) {
    if (source.title) aliases.add(source.title)
    if (source.variantLabel) aliases.add(source.variantLabel)
  }
  if (entry.name) aliases.add(entry.name)
  for (const variant of entry.levelVariants ?? []) {
    if (variant.name) aliases.add(variant.name)
  }
  aliases.delete(displayName(entry))
  return [...aliases].sort()
}

function routeFor(entry, sourceType) {
  if (sourceType === 'pet-guest') {
    const type = entry.type === 'guest' ? 'guest' : 'pet'
    return `/${type === 'guest' ? 'guests' : 'pets'}/${entry.slug}`
  }
  if (sourceType === 'accessory') {
    return `/accessories/${entry.slug}?type=${encodeURIComponent(entry.subtype)}`
  }
  if (sourceType === 'weapon') {
    return `/weapons/${entry.slug}?type=${encodeURIComponent(entry.subtype)}`
  }
  if (sourceType === 'housing') {
    return `/housing/${entry.slug}?type=${encodeURIComponent(entry.subtype)}`
  }
  return `/classes/${entry.slug}?type=${encodeURIComponent(entry.subtype)}`
}

function itemTypeFor(entry, sourceType) {
  if (sourceType === 'pet-guest') return entry.type === 'guest' ? 'guest' : 'pet'
  if (sourceType === 'accessory') return 'accessory'
  if (sourceType === 'weapon') return 'weapon'
  if (sourceType === 'housing') return 'housing'
  return 'class-ability'
}

function categoryLabelFor(entry, sourceType) {
  if (sourceType === 'pet-guest') return entry.type === 'guest' ? 'Guest' : 'Pet'
  if (sourceType === 'accessory') return accessoryLabels[entry.subtype] ?? 'Accessory'
  if (sourceType === 'weapon') return weaponLabels[entry.subtype] ?? 'Weapon'
  if (sourceType === 'housing') return housingLabels[entry.subtype] ?? 'Housing'
  if (entry.subtype === 'consumable') return 'Consumable'
  return classLabels[entry.classSubcategory] ?? 'Class'
}

const badges = readJson('badges.json')
const badgesByKey = new Map(badges.map((badge) => [normalizeBadgeLookupKey(badge.name), badge]))
const relations = []
const missingBadgeNames = new Set()
const seen = new Set()

for (const { file, type } of dataFiles) {
  const entries = readJson(file)
  for (const entry of entries) {
    const badgeNames = extractAwardedBadgeNames(collectStrings(entry))
    for (const badgeName of badgeNames) {
      const badge = badgesByKey.get(normalizeBadgeLookupKey(badgeName))
      if (!badge) {
        missingBadgeNames.add(badgeName)
        continue
      }
      const route = routeFor(entry, type)
      const key = `${badge.slug}|${route}`
      if (seen.has(key)) continue
      seen.add(key)
      relations.push({
        badgeName: badge.name,
        badgeSlug: badge.slug,
        itemName: displayName(entry),
        itemAliases: itemAliases(entry),
        itemSlug: entry.slug,
        itemType: itemTypeFor(entry, type),
        categoryLabel: categoryLabelFor(entry, type),
        route,
      })
    }
  }
}

relations.sort(
  (first, second) =>
    first.badgeName.localeCompare(second.badgeName) ||
    first.categoryLabel.localeCompare(second.categoryLabel) ||
    first.itemName.localeCompare(second.itemName)
)

writeFileSync(OUTPUT_PATH, `${JSON.stringify(relations, null, 2)}\n`)
console.log(`✅ badge-relations.json written: ${relations.length} relation(s)`)
if (missingBadgeNames.size > 0) {
  console.warn(`⚠️  Missing badge target(s): ${[...missingBadgeNames].sort().join(', ')}`)
}
