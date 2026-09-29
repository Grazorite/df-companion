/**
 * Generates the compact global search index (`src/data/search-index.json`) that powers the command
 * palette. The palette loads only this small file on first open, so it never pulls full category
 * datasets just to search.
 *
 * Drift-proofing: this reads the raw `src/data/*.json` and applies the SAME fetch-free normalization
 * the runtime loaders apply (`src/utils/dataNormalization.ts`), then feeds `buildSearchIndex`
 * (`src/utils/searchIndex.ts`) — the exact function the app uses. The output is the compact record
 * form via `toCompactIndex`. `scripts/validate-search-index.mjs` fails the build if the committed
 * file drifts from what this regenerates.
 *
 * Run: `npm run generate:search-index`
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AccessoryEntry, AccessorySubtype } from '../src/types/accessory'
import type { Badge } from '../src/types/badge'
import type { ItemFamily } from '../src/types/item'
import type { Pet } from '../src/types/pet'
import type { WeaponEntry, WeaponSubtype } from '../src/types/weapon'
import type { HousingEntry, HousingSubtype } from '../src/types/housing'
import type { ClassAbilityEntry, ClassAbilitySubtype } from '../src/types/classAbility'
import { normalizeHousingEntries } from '../src/utils/housingNormalization'
import {
  dedupeClassAbilityEntries,
  isLoadedFamily,
  normalizeLoadedClassAbility,
  normalizeLoadedFamily,
  normalizeLoadedPet,
  repairLoadedSingleObtainMethods,
} from '../src/utils/dataNormalization'
import { buildSearchIndex, toCompactIndex } from '../src/utils/searchIndex'

const DATA_DIR = fileURLToPath(new URL('../src/data', import.meta.url))
const OUTPUT = path.resolve(DATA_DIR, 'search-index.json')

function readArray<T>(file: string): T[] {
  const filePath = path.resolve(DATA_DIR, file)
  if (!fs.existsSync(filePath)) return []
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as unknown
  return Array.isArray(data) ? (data as T[]) : []
}

// Mirror the loaders' file → subtype mapping exactly (src/utils/dataLoaders.ts).
const ACCESSORY_FILES: Record<AccessorySubtype, string[]> = {
  artifact: ['artifacts.json'],
  belt: ['belts.json'],
  bracer: ['bracers.json'],
  'cape-wing': ['capes-wings-a-l.json', 'capes-wings-m-z.json'],
  helm: ['helms-a-l.json', 'helms-m-z.json'],
  necklace: ['necklaces.json'],
  ring: ['rings.json'],
  trinket: ['trinkets.json'],
}

const WEAPON_FILES: Record<WeaponSubtype, string[]> = {
  'sword-axe-mace': [
    'weapons-swords-axes-maces-a-g.json',
    'weapons-swords-axes-maces-h-n.json',
    'weapons-swords-axes-maces-o-z.json',
  ],
  'staff-wand': [
    'weapons-staves-wands-a-g.json',
    'weapons-staves-wands-h-n.json',
    'weapons-staves-wands-o-z.json',
  ],
  dagger: ['weapons-daggers-a-g.json', 'weapons-daggers-h-n.json', 'weapons-daggers-o-z.json'],
  scythe: ['weapons-scythes-a-j.json', 'weapons-scythes-k-z.json'],
}

const HOUSING_FILES: Record<HousingSubtype, string[]> = {
  house: ['housing-houses.json'],
  background: ['housing-backgrounds.json'],
  floor: ['housing-floors.json'],
  rug: ['housing-rugs.json'],
  shrub: ['housing-shrubs.json'],
  stuff: ['housing-stuff.json'],
  'wall-item': ['housing-wall-items.json'],
}

const CLASS_FILES: Record<ClassAbilitySubtype, string[]> = {
  class: ['class-armors.json', 'class-regular.json', 'class-miscellaneous.json'],
  consumable: ['class-consumables.json'],
}



function loadAccessories(): Record<AccessorySubtype, AccessoryEntry[]> {
  const out = {} as Record<AccessorySubtype, AccessoryEntry[]>
  for (const [subtype, files] of Object.entries(ACCESSORY_FILES) as [AccessorySubtype, string[]][]) {
    out[subtype] = files
      .flatMap((file) => readArray<AccessoryEntry>(file))
      .map((entry) =>
        isLoadedFamily(entry) ? normalizeLoadedFamily(entry) : repairLoadedSingleObtainMethods(entry)
      )
  }
  return out
}

function loadWeapons(): Record<WeaponSubtype, WeaponEntry[]> {
  const out = {} as Record<WeaponSubtype, WeaponEntry[]>
  for (const [subtype, files] of Object.entries(WEAPON_FILES) as [WeaponSubtype, string[]][]) {
    out[subtype] = files
      .flatMap((file) => readArray<WeaponEntry>(file))
      .map((entry) =>
        isLoadedFamily(entry) ? normalizeLoadedFamily(entry) : repairLoadedSingleObtainMethods(entry)
      )
  }
  return out
}

function loadHousing(): Record<HousingSubtype, HousingEntry[]> {
  const out = {} as Record<HousingSubtype, HousingEntry[]>
  for (const [subtype, files] of Object.entries(HOUSING_FILES) as [HousingSubtype, string[]][]) {
    out[subtype] = normalizeHousingEntries(
      files
        .flatMap((file) => readArray<HousingEntry>(file))
        .map((entry) => (isLoadedFamily(entry) ? normalizeLoadedFamily(entry) : entry))
    )
  }
  return out
}

function loadClasses(): Record<ClassAbilitySubtype, ClassAbilityEntry[]> {
  const out = {} as Record<ClassAbilitySubtype, ClassAbilityEntry[]>
  for (const [subtype, files] of Object.entries(CLASS_FILES) as [ClassAbilitySubtype, string[]][]) {
    out[subtype] = dedupeClassAbilityEntries(
      files.flatMap((file) => readArray<ClassAbilityEntry>(file)).map(normalizeLoadedClassAbility)
    )
  }
  return out
}

function loadPetsGuests(): Array<Pet | ItemFamily> {
  const pets = readArray<Pet | ItemFamily>('pets.json').map((entry) =>
    isLoadedFamily(entry) ? normalizeLoadedFamily(entry) : normalizeLoadedPet(entry as never)
  )
  const guests = readArray<Pet | ItemFamily>('guests.json').map((entry) =>
    isLoadedFamily(entry) ? normalizeLoadedFamily(entry) : normalizeLoadedPet(entry as never)
  )
  return [...pets, ...guests] as Array<Pet | ItemFamily>
}

export function buildCompactIndex() {
  const hits = buildSearchIndex({
    badges: readArray<Badge>('badges.json'),
    petsGuests: loadPetsGuests(),
    accessories: loadAccessories(),
    weapons: loadWeapons(),
    housing: loadHousing(),
    classes: loadClasses(),
  })
  return toCompactIndex(hits)
}

function serialize(compact: ReturnType<typeof buildCompactIndex>): string {
  return `${JSON.stringify(compact)}\n`
}

function main() {
  const compact = buildCompactIndex()
  const serialized = serialize(compact)
  // `--check` mode (used by validate-search-index.mjs) prints the freshly generated content to stdout
  // instead of writing, so the validator can diff it against the committed file without clobbering.
  if (process.argv.includes('--check')) {
    process.stdout.write(serialized)
    return
  }
  fs.writeFileSync(OUTPUT, serialized, 'utf-8')
  const bytes = Buffer.byteLength(serialized, 'utf-8')
  console.log(
    `✅ search-index.json: ${compact.length} records, ${(bytes / 1024).toFixed(0)} KiB ` +
      `(${((bytes / (1.5 * 1024 * 1024)) * 100).toFixed(1)}% of 1.5 MiB budget)`
  )
}

main()
