/**
 * Global search index for the Command palette.
 *
 * The `*-manifest.json` files only carry counts, so they cannot power search.
 * Instead we build a flat in-memory index from the already-cached per-section
 * loaders (see `useGlobalSearch`). Each hit knows how to build its own detail
 * route, mirroring the per-section card link builders.
 */
import type { Badge } from '../types/badge'
import type { ItemFamily } from '../types/item'
import type { Pet } from '../types/pet'
import type { AccessoryEntry, AccessorySubtype } from '../types/accessory'
import type { WeaponEntry, WeaponSubtype } from '../types/weapon'
import type { HousingEntry, HousingSubtype } from '../types/housing'
import type { ClassAbilityEntry, ClassAbilitySubtype } from '../types/classAbility'
import { ACCESSORY_SUBTYPES } from '../types/accessory'
import { WEAPON_SUBTYPES } from '../types/weapon'
import { HOUSING_SUBTYPES } from '../types/housing'
import { CLASS_ABILITY_SUBTYPES } from '../types/classAbility'
import { compareTitles, displayTitle } from './displayText'
import { getSearchWords } from './search'

export type SearchSection =
  | 'Badges'
  | 'Pets'
  | 'Guests'
  | 'Accessories'
  | 'Weapons'
  | 'Housing'
  | 'Classes & Abilities'

export interface SearchHit {
  /** Unique React key: section + slug + subtype. */
  id: string
  /** Display title, article-normalized. */
  label: string
  section: SearchSection
  /** Small qualifier shown next to the label (e.g. subtype). */
  sublabel?: string
  /** App route to the entry's detail page. */
  url: string
  /** Precomputed lowercased search words for fast prefix matching. */
  words: string[]
}

export interface GlobalSearchData {
  badges: Badge[]
  petsGuests: Array<Pet | ItemFamily>
  accessories: Record<AccessorySubtype, AccessoryEntry[]>
  weapons: Record<WeaponSubtype, WeaponEntry[]>
  housing: Record<HousingSubtype, HousingEntry[]>
  classes: Record<ClassAbilitySubtype, ClassAbilityEntry[]>
}

const accessorySubtypeLabel = new Map(ACCESSORY_SUBTYPES.map((m) => [m.subtype, m.label]))
const weaponSubtypeLabel = new Map(WEAPON_SUBTYPES.map((m) => [m.subtype, m.label]))
const housingSubtypeLabel = new Map(HOUSING_SUBTYPES.map((m) => [m.subtype, m.label]))
const classSubtypeLabel = new Map(CLASS_ABILITY_SUBTYPES.map((m) => [m.subtype, m.label]))

function entryName(entry: { name: string } | { familyName: string }): string {
  return 'familyName' in entry ? entry.familyName : entry.name
}

function makeHit(
  section: SearchSection,
  slug: string,
  rawName: string,
  url: string,
  sublabel?: string
): SearchHit {
  const label = displayTitle(rawName)
  return {
    id: `${section}:${slug}:${sublabel ?? ''}`,
    label,
    section,
    sublabel,
    url,
    // Index the raw and normalized names so both "The Golden Egg" and
    // "Golden Egg" style queries resolve.
    words: getSearchWords(`${label} ${rawName}`),
  }
}

/** Build the full flat search index from all loaded section datasets. */
export function buildSearchIndex(data: GlobalSearchData): SearchHit[] {
  const hits: SearchHit[] = []

  for (const badge of data.badges) {
    hits.push(makeHit('Badges', badge.slug, badge.name, `/badges/${badge.slug}`))
  }

  for (const entry of data.petsGuests) {
    const isGuest = entry.type === 'guest'
    const section: SearchSection = isGuest ? 'Guests' : 'Pets'
    const base = isGuest ? 'guests' : 'pets'
    hits.push(makeHit(section, entry.slug, entryName(entry), `/${base}/${entry.slug}`))
  }

  const subtypeSections: Array<{
    section: SearchSection
    base: string
    groups: Record<string, Array<{ slug: string; name: string; subtype: string }>>
    labels: Map<string, string>
  }> = [
    {
      section: 'Accessories',
      base: 'accessories',
      labels: accessorySubtypeLabel,
      groups: toNamedEntries(data.accessories),
    },
    {
      section: 'Weapons',
      base: 'weapons',
      labels: weaponSubtypeLabel,
      groups: toNamedEntries(data.weapons),
    },
    {
      section: 'Housing',
      base: 'housing',
      labels: housingSubtypeLabel,
      groups: toNamedEntries(data.housing),
    },
    {
      section: 'Classes & Abilities',
      base: 'classes',
      labels: classSubtypeLabel,
      groups: toNamedEntries(data.classes),
    },
  ]

  for (const { section, base, groups, labels } of subtypeSections) {
    for (const entries of Object.values(groups)) {
      for (const item of entries) {
        const url = `/${base}/${item.slug}?type=${encodeURIComponent(item.subtype)}`
        hits.push(makeHit(section, item.slug, item.name, url, labels.get(item.subtype)))
      }
    }
  }

  return hits
}

/** Normalize a `Record<subtype, entry[]>` into name/slug/subtype tuples. */
function toNamedEntries<T extends { slug: string; subtype: string }>(
  bySubtype: Record<string, T[]>
): Record<string, Array<{ slug: string; name: string; subtype: string }>> {
  const out: Record<string, Array<{ slug: string; name: string; subtype: string }>> = {}
  for (const [subtype, entries] of Object.entries(bySubtype)) {
    out[subtype] = entries.map((entry) => ({
      slug: entry.slug,
      name: entryName(entry as unknown as { name: string } | { familyName: string }),
      subtype,
    }))
  }
  return out
}

/**
 * Word-prefix search across the index, reusing the app's `getSearchWords`
 * tokenizer so palette matching behaves like in-page search. Name matches are
 * ranked before other matches, then alphabetically.
 */
export function searchHits(hits: SearchHit[], query: string, limit = 40): SearchHit[] {
  const queryWords = getSearchWords(query)
  if (queryWords.length === 0) return []

  const matches = hits.filter((hit) =>
    queryWords.every((qWord) => hit.words.some((word) => word.startsWith(qWord)))
  )

  matches.sort((a, b) => compareTitles(a.label, b.label))
  return matches.slice(0, limit)
}
