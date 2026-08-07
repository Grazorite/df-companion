import { useEffect, useMemo, useState } from 'react'
import type { ElementsData } from '../types/element'
import type { AlsoSeeRef } from '../types/item'
import type { WeaponEntry, WeaponFilters, WeaponSubtype } from '../types/weapon'
import { isWeaponFamily, WEAPON_SUBTYPES } from '../types/weapon'
import {
  loadElements,
  loadWeaponManifest,
  loadWeaponsBySubtype,
  loadWeaponsForSubtype,
} from '../utils/dataLoaders'
import { compareTitles, displayTitle } from '../utils/displayText'
import { obtainMethodInferenceFingerprint, relatedNameScore } from '../utils/relatedItems'
import { getSearchWords } from '../utils/search'
import {
  getDisplayFamilyName,
  getVersionSuffixRange,
  hasParentheticalVariantFamilyName,
  hasVersionSuffix,
  hasSameLevelVariants,
  stripVersionSuffix,
} from '../utils/variantHelpers'

const EMPTY_WEAPON_COUNTS = Object.fromEntries(
  WEAPON_SUBTYPES.map((meta) => [meta.subtype, 0])
) as Record<WeaponSubtype, number>

function useWeaponSubtypeDataset(subtype: WeaponSubtype) {
  const [weapons, setWeapons] = useState<WeaponEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    loadWeaponsForSubtype(subtype)
      .then((data) => {
        if (!active) return
        setWeapons(data)
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setWeapons([])
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [subtype])

  return { weapons, loading }
}

function useElementDataset() {
  const [elementMeta, setElementMeta] = useState<ElementsData>({ elements: [], traits: [] })

  useEffect(() => {
    let active = true
    loadElements()
      .then((data) => {
        if (active) setElementMeta(data)
      })
      .catch(() => {
        if (active) setElementMeta({ elements: [], traits: [] })
      })

    return () => {
      active = false
    }
  }, [])

  return elementMeta
}

function useWeaponCountsDataset() {
  const [counts, setCounts] = useState<Record<WeaponSubtype, number>>(EMPTY_WEAPON_COUNTS)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    loadWeaponManifest()
      .then((data) => {
        if (!active) return
        setCounts(data.bySubtype)
        setTotal(data.total)
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setCounts(EMPTY_WEAPON_COUNTS)
        setTotal(0)
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return { bySubtype: counts, total, loading }
}

export function getWeaponDisplayName(name: string): string {
  return displayTitle(stripVersionSuffix(name))
}

function searchWeapons(
  items: WeaponEntry[],
  subtype: WeaponSubtype,
  filters: WeaponFilters,
  elementMeta: ElementsData
): WeaponEntry[] {
  const queryWords = getSearchWords(filters.query ?? '')

  return items
    .filter((item) => {
      if (item.subtype !== subtype) return false

      const hasAccess = (flag: NonNullable<WeaponFilters['access']>[number]) => {
        if (flag === 'multi') {
          return isWeaponFamily(item) ? item.levelVariants.length > 1 : hasVersionSuffix(item.name)
        }
        if (flag === 'da') return isWeaponFamily(item) ? item.hasDA : item.daRequired
        if (flag === 'dc') return isWeaponFamily(item) ? item.hasDC : Boolean(item.dcRequired)
        if (flag === 'dm') return isWeaponFamily(item) ? item.hasDM : Boolean(item.dmRequired)
        if (flag === 'free') {
          return isWeaponFamily(item)
            ? item.hasFree
            : item.obtainMethods.some((method) => method.priceType === 'free')
        }
        return isWeaponFamily(item)
          ? item.hasMerge
          : item.obtainMethods.some((method) => method.priceType === 'merge')
      }

      if (filters.access && filters.access.some((flag) => !hasAccess(flag))) return false

      const itemRetired = item.retired === true
      if (filters.categories && filters.categories.length > 0) {
        const hasCategory = filters.categories.some((category) => {
          if (category === 'armor-customization') return item.hasArmorCustomization === true
          if (category === 'special') return item.hasSpecial === true
          if (category === 'cosmetic') return item.isCosmetic === true
          if (category === 'temp') return item.isTemp === true
          if (category === 'rare') return item.isRare === true
          if (category === 'seasonal') return item.isSeasonal === true
          if (category === 'special-offer') return item.isSpecialOffer === true
          if (category === 'retired') return itemRetired
          return false
        })

        if (filters.categories.includes('retired')) {
          if (!itemRetired) return false
        } else if (!hasCategory || itemRetired) {
          return false
        }
      } else if (itemRetired && queryWords.length === 0) {
        return false
      }

      if (filters.elements && filters.elements.length > 0) {
        if (!filters.elements.some((code) => item.elements.includes(code))) return false
      }

      if (queryWords.length > 0) {
        const itemName = isWeaponFamily(item) ? item.familyName : item.name
        const description = isWeaponFamily(item) ? item.shared.description : item.description
        const tags = item.tags ?? []
        const variantNames = isWeaponFamily(item)
          ? item.levelVariants.map((level) => level.name)
          : []
        const aliases = isWeaponFamily(item) ? (item.aliasSlugs ?? []) : []
        const searchableText = [
          itemName,
          displayTitle(itemName),
          description,
          ...variantNames,
          ...aliases,
          ...tags,
          ...item.elements.map(
            (code) =>
              elementMeta.elements.find((element) => element.code === code)?.shortName ?? code
          ),
        ]
          .join(' ')
          .toLowerCase()
        const words = getSearchWords(searchableText)
        if (!queryWords.every((queryWord) => words.some((word) => word.startsWith(queryWord)))) {
          return false
        }
      }

      return true
    })
    .sort((a, b) => {
      const aName = isWeaponFamily(a) ? a.familyName : a.name
      const bName = isWeaponFamily(b) ? b.familyName : b.name
      return compareTitles(aName, bName)
    })
}

export function useWeapons(subtype: WeaponSubtype, filters: WeaponFilters = {}) {
  const { weapons: subtypeWeapons, loading } = useWeaponSubtypeDataset(subtype)
  const elementMeta = useElementDataset()
  const weapons = useMemo(
    () => searchWeapons(subtypeWeapons, subtype, filters, elementMeta),
    [subtypeWeapons, subtype, filters, elementMeta]
  )

  return { weapons, total: weapons.length, loading }
}

function weaponMatchesSlug(entry: WeaponEntry, slug?: string): boolean {
  if (!slug) return false
  if (entry.slug === slug) return true
  return isWeaponFamily(entry) && (entry.aliasSlugs ?? []).includes(slug)
}

function getWeaponRelatedDisplayName(entry: WeaponEntry): string {
  return isWeaponFamily(entry)
    ? getWeaponDisplayName(getDisplayFamilyName(entry))
    : getWeaponDisplayName(entry.name)
}

function getWeaponSlugs(entry: WeaponEntry): string[] {
  return [entry.slug, ...(isWeaponFamily(entry) ? (entry.aliasSlugs ?? []) : [])]
}

function getWeaponAlsoSeeRefs(entry: WeaponEntry): AlsoSeeRef[] {
  return isWeaponFamily(entry) ? (entry.shared.alsoSee ?? []) : (entry.alsoSee ?? [])
}

function getWeaponObtainFingerprints(entry: WeaponEntry): Set<string> {
  const methods = isWeaponFamily(entry)
    ? entry.levelVariants.flatMap((level) => level.obtainVariants)
    : entry.obtainMethods

  return new Set(methods.map(obtainMethodInferenceFingerprint))
}

export function useWeaponBySlug(subtype: WeaponSubtype, slug?: string) {
  const { weapons, loading } = useWeaponSubtypeDataset(subtype)
  const weapon = useMemo(() => {
    if (loading) return undefined
    return weapons.find((entry) => weaponMatchesSlug(entry, slug)) ?? null
  }, [weapons, loading, slug])

  return { weapon, loading }
}

export function useRelatedWeapons(alsoSee: AlsoSeeRef[] = []) {
  const [allWeapons, setAllWeapons] = useState<WeaponEntry[]>([])
  const [loading, setLoading] = useState(alsoSee.length > 0)

  useEffect(() => {
    if (alsoSee.length === 0) {
      setAllWeapons([])
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    loadWeaponsBySubtype()
      .then((data) => {
        if (!active) return
        setAllWeapons(WEAPON_SUBTYPES.flatMap((meta) => data[meta.subtype]))
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setAllWeapons([])
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [alsoSee.length])

  const relatedWeapons = useMemo(
    () =>
      alsoSee.map((ref) => ({
        ref,
        entry: allWeapons.find((item) => weaponMatchesSlug(item, ref.slug)),
      })),
    [allWeapons, alsoSee]
  )

  return { relatedWeapons, loading }
}

export interface WeaponRelatedItem {
  ref?: AlsoSeeRef
  entry?: WeaponEntry
  relation: 'explicit' | 'same-obtain-near-name'
  scope: 'same-subtype' | 'cross-subtype'
}

const INFERRED_WEAPON_RELATED_LIMIT = 8
const INFERRED_WEAPON_RELATED_NAME_THRESHOLD = 0.7

export function useWeaponRelatedItems(weapon: WeaponEntry, alsoSee: AlsoSeeRef[] = []) {
  const [allWeapons, setAllWeapons] = useState<WeaponEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    loadWeaponsBySubtype()
      .then((data) => {
        if (!active) return
        setAllWeapons(WEAPON_SUBTYPES.flatMap((meta) => data[meta.subtype]))
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setAllWeapons([])
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const relatedWeapons = useMemo<WeaponRelatedItem[]>(() => {
    const currentSlugs = new Set(getWeaponSlugs(weapon))
    const explicitSlugSet = new Set(alsoSee.map((ref) => ref.slug))
    const explicitRelated = alsoSee.map((ref) => {
      const entry = allWeapons.find((item) => weaponMatchesSlug(item, ref.slug))
      return {
        ref,
        entry,
        relation: 'explicit' as const,
        scope:
          entry && entry.subtype !== weapon.subtype
            ? ('cross-subtype' as const)
            : ('same-subtype' as const),
      }
    })
    const reverseExplicitRelated = allWeapons.flatMap((candidate) => {
      const candidateSlugs = getWeaponSlugs(candidate)
      if (candidateSlugs.some((slug) => currentSlugs.has(slug))) return []
      if (candidateSlugs.some((slug) => explicitSlugSet.has(slug))) return []

      const linksToCurrent = getWeaponAlsoSeeRefs(candidate).some((ref) =>
        currentSlugs.has(ref.slug)
      )
      if (!linksToCurrent) return []

      return [
        {
          ref: undefined,
          entry: candidate,
          relation: 'explicit' as const,
          scope:
            candidate.subtype !== weapon.subtype
              ? ('cross-subtype' as const)
              : ('same-subtype' as const),
        },
      ]
    })

    const currentFingerprints = getWeaponObtainFingerprints(weapon)
    const currentName = getWeaponRelatedDisplayName(weapon)
    const inferredRelated = allWeapons
      .flatMap((candidate) => {
        if (candidate.subtype !== weapon.subtype) return []
        const candidateSlugs = getWeaponSlugs(candidate)
        if (candidateSlugs.some((slug) => currentSlugs.has(slug))) return []
        if (candidateSlugs.some((slug) => explicitSlugSet.has(slug))) return []

        const hasSharedObtainMethod = [...getWeaponObtainFingerprints(candidate)].some(
          (fingerprint) => currentFingerprints.has(fingerprint)
        )
        if (!hasSharedObtainMethod) return []

        const score = relatedNameScore(currentName, getWeaponRelatedDisplayName(candidate))
        if (score < INFERRED_WEAPON_RELATED_NAME_THRESHOLD) return []

        return [
          {
            ref: undefined,
            entry: candidate,
            relation: 'same-obtain-near-name' as const,
            scope: 'same-subtype' as const,
            score,
          },
        ]
      })
      .sort(
        (first, second) =>
          second.score - first.score ||
          compareTitles(
            getWeaponRelatedDisplayName(first.entry),
            getWeaponRelatedDisplayName(second.entry)
          )
      )
      .slice(0, INFERRED_WEAPON_RELATED_LIMIT)
      .map(({ score: _score, ...item }) => item)

    const seen = new Set<string>()
    return [...explicitRelated, ...reverseExplicitRelated, ...inferredRelated].filter((item) => {
      const slug = item.entry?.slug ?? item.ref?.slug
      if (!slug || seen.has(slug)) return false
      seen.add(slug)
      return true
    })
  }, [allWeapons, alsoSee, weapon])

  return { relatedWeapons, loading }
}

export function useWeaponCategoryAvailability(subtype: WeaponSubtype) {
  const { weapons, loading } = useWeaponSubtypeDataset(subtype)

  return useMemo(
    () => ({
      loading,
      hasArmorCustomization: weapons.some((entry) => entry.hasArmorCustomization === true),
      hasSpecial: weapons.some((entry) => entry.hasSpecial === true),
      hasCosmetic: weapons.some((entry) => entry.isCosmetic === true),
    }),
    [weapons, loading]
  )
}

export function useWeaponCounts() {
  return useWeaponCountsDataset()
}

export function useTotalWeaponCount() {
  return useWeaponCounts().total
}

export function buildWeaponCardData(entry: WeaponEntry) {
  if (!isWeaponFamily(entry)) {
    return {
      name: getWeaponDisplayName(entry.name),
      description: entry.description,
      elements: entry.elements,
      daRequired: entry.daRequired,
      dcRequired: entry.dcRequired ?? false,
      dmRequired: entry.dmRequired ?? false,
      isCosmetic: entry.isCosmetic ?? false,
      hasSpecial: entry.hasSpecial ?? false,
      hasArmorCustomization: entry.hasArmorCustomization ?? false,
      hasFree: entry.obtainMethods.some((method) => method.priceType === 'free'),
      hasMultipleVersions: hasVersionSuffix(entry.name),
      levelRange:
        getVersionSuffixRange(entry.name) ??
        (hasVersionSuffix(entry.name) ? entry.level : '') ??
        '',
      route: `/weapons/${entry.slug}?type=${encodeURIComponent(entry.subtype)}`,
    }
  }

  return {
    name: getWeaponDisplayName(getDisplayFamilyName(entry)),
    description: entry.shared.description,
    elements: entry.elements,
    daRequired: entry.hasDA,
    dcRequired: entry.hasDC,
    dmRequired: entry.hasDM,
    isCosmetic: entry.isCosmetic ?? false,
    hasSpecial: entry.hasSpecial ?? false,
    hasArmorCustomization: entry.hasArmorCustomization ?? false,
    hasFree: entry.hasFree,
    hasMultipleVersions: entry.levelVariants.length > 1,
    levelRange:
      hasSameLevelVariants(entry) || hasParentheticalVariantFamilyName(entry.familyName)
        ? ''
        : entry.levelRange,
    route: `/weapons/${entry.slug}?type=${encodeURIComponent(entry.subtype)}`,
  }
}
