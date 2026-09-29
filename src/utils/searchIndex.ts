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

/**
 * Compact on-disk search record. Deliberately minimal so the generated
 * `search-index.json` stays well under the decoded-size budget: `id` and the
 * tokenized `words` are recomputed at load by `rehydrateSearchIndex`, and
 * `rawName` is stored only when article-normalization changed the display label
 * (so raw-name queries like "Egg, The" still resolve without duplicating names).
 */
export interface CompactSearchRecord {
  label: string
  section: SearchSection
  url: string
  sublabel?: string
  rawName?: string
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
  return hitFromParts(section, slug, rawName, url, sublabel)
}

/**
 * Single source of truth for turning name parts into a `SearchHit`. Used both by
 * `buildSearchIndex` (from full datasets) and `rehydrateSearchIndex` (from the
 * compact on-disk records), so the runtime hit is identical regardless of source.
 */
function hitFromParts(
  section: SearchSection,
  idKey: string,
  rawName: string,
  url: string,
  sublabel?: string
): SearchHit {
  const label = displayTitle(rawName)
  return {
    id: `${section}:${idKey}:${sublabel ?? ''}`,
    label,
    section,
    sublabel,
    url,
    // Index the raw and normalized names so both "The Golden Egg" and
    // "Golden Egg" style queries resolve.
    words: getSearchWords(`${label} ${rawName}`),
  }
}

/** Slug segment of a detail route, used as the stable id key when rehydrating. */
function slugFromUrl(url: string): string {
  const path = url.split('?')[0]
  return path.slice(path.lastIndexOf('/') + 1)
}

/**
 * Convert runtime hits into the minimal on-disk records. `rawName` is preserved
 * only when article-normalization changed the label, so raw-name search still
 * works without storing every name twice.
 */
export function toCompactIndex(hits: SearchHit[]): CompactSearchRecord[] {
  return hits.map((hit) => {
    const record: CompactSearchRecord = {
      label: hit.label,
      section: hit.section,
      url: hit.url,
    }
    if (hit.sublabel) record.sublabel = hit.sublabel
    // hit.words was built from `${label} ${rawName}`; if the label already covers
    // every word, no separate rawName is needed. Detect a divergent raw name by
    // checking whether the words include tokens the label alone does not produce.
    const labelWords = new Set(getSearchWords(hit.label))
    const extraWord = hit.words.some((word) => !labelWords.has(word))
    if (extraWord) record.rawName = deriveRawName(hit)
    return record
  })
}

/**
 * Recover a raw name that, combined with the label, reproduces the hit's search
 * words. When a divergent raw name existed we cannot always reconstruct the exact
 * original string, so we store the joined extra words — enough for prefix search
 * to keep matching. In practice the only divergence is leading-article reordering
 * (e.g. "Egg, The" → label "The Egg"), which produces no extra tokens, so this is
 * rarely hit; when it is, matching is preserved.
 */
function deriveRawName(hit: SearchHit): string {
  const labelWords = new Set(getSearchWords(hit.label))
  return hit.words.filter((word) => !labelWords.has(word)).join(' ')
}

/** Rebuild runtime `SearchHit[]` (with `id` + tokenized `words`) from compact records. */
export function rehydrateSearchIndex(records: CompactSearchRecord[]): SearchHit[] {
  return records.map((record) => {
    const rawName = record.rawName ? `${record.label} ${record.rawName}` : record.label
    return hitFromParts(record.section, slugFromUrl(record.url), rawName, record.url, record.sublabel)
  })
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
