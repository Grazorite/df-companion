import { useEffect, useMemo, useState } from 'react'
import type { ElementsData } from '../types/element'
import type { AlsoSeeRef } from '../types/item'
import type { WeaponEntry, WeaponFamily, WeaponFilters, WeaponSubtype } from '../types/weapon'
import { isWeaponFamily, WEAPON_SUBTYPES } from '../types/weapon'
import {
  loadElements,
  loadWeaponManifest,
  loadWeaponsBySubtype,
  loadWeaponsForSubtype,
} from '../utils/dataLoaders'
import { compareTitles, displayTitle } from '../utils/displayText'
import { getRelatedNameTokens, obtainMethodInferenceFingerprint } from '../utils/relatedItems'
import { getSearchWords } from '../utils/search'
import {
  getFamilyCardDescription,
  getVersionSuffixRange,
  hasParentheticalVariantFamilyName,
  hasVersionSuffix,
  hasSameLevelVariants,
  stripVersionSuffix,
} from '../utils/variantHelpers'
import { useRelatedItems, type RelatedItemResult } from './useRelatedItems'

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

function compactParentheticalWeaponFamilyName(family: WeaponFamily): string {
  return stripVersionSuffix(family.familyName)
}

export function getWeaponFamilyDisplayName(family: WeaponFamily): string {
  return getWeaponDisplayName(compactParentheticalWeaponFamilyName(family))
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
        if (flag === 'default') return item.isDefault === true
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
      if (filters.excludeAccess?.some((flag) => hasAccess(flag))) return false

      const itemRetired = item.retired === true
      const hasCategoryFlag = (
        category: NonNullable<WeaponFilters['categories']>[number]
      ): boolean => {
        if (category === 'armor-customization') return item.hasArmorCustomization === true
        if (category === 'special') return item.hasSpecial === true
        if (category === 'cosmetic') return item.isCosmetic === true
        if (category === 'temp') return item.isTemp === true
        if (category === 'rare') return item.isRare === true
        if (category === 'seasonal') return item.isSeasonal === true
        if (category === 'special-offer') return item.isSpecialOffer === true
        if (category === 'retired') return itemRetired
        return false
      }
      if (filters.excludeCategories?.some((category) => hasCategoryFlag(category))) return false
      if (filters.categories && filters.categories.length > 0) {
        const hasCategory = filters.categories.some((category) => hasCategoryFlag(category))

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
      if (filters.excludeElements?.some((code) => item.elements.includes(code))) return false

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
    ? getWeaponFamilyDisplayName(entry)
    : getWeaponDisplayName(entry.name)
}

function getWeaponSlugs(entry: WeaponEntry): string[] {
  return [entry.slug, ...(isWeaponFamily(entry) ? (entry.aliasSlugs ?? []) : [])]
}

function isSameWeaponEntry(candidate: WeaponEntry, item: WeaponEntry): boolean {
  return (
    candidate.subtype === item.subtype &&
    getWeaponSlugs(candidate).some((slug) => slug === item.slug)
  )
}

function getWeaponAlsoSeeRefs(entry: WeaponEntry): AlsoSeeRef[] {
  const refs = isWeaponFamily(entry) ? (entry.shared.alsoSee ?? []) : (entry.alsoSee ?? [])
  if (entry.slug === 'weapon-staff-of-hearts-aria-in-wanderland') return refs
  return refs.filter((ref) => ref.slug !== 'weapon-staff-of-hearts-aria-in-wanderland')
}

function getWeaponSourceUrls(entry: WeaponEntry): string[] {
  return [
    entry.forumUrl,
    ...(isWeaponFamily(entry) ? (entry.familySources ?? []).map((source) => source.url) : []),
  ].filter(Boolean)
}

function getWeaponPriceTypes(entry: WeaponEntry): Set<string> {
  const methods = isWeaponFamily(entry)
    ? entry.levelVariants.flatMap((level) => level.obtainVariants)
    : entry.obtainMethods

  return new Set(methods.map((method) => method.priceType))
}

function normalizeRelatedWeaponName(entry: WeaponEntry): string {
  return stripVersionSuffix(getWeaponRelatedDisplayName(entry)).toLowerCase()
}

function isExcludedWeaponRelatedPair(candidate: WeaponEntry, item: WeaponEntry): boolean {
  const staffOfHeartsSlugs = new Set([
    'weapon-staff-of-hearts',
    'weapon-staff-of-hearts-card-shoppe',
    'weapon-staff-of-hearts-aria-in-wanderland',
  ])
  const currentSlugs = new Set(getWeaponSlugs(item))
  const candidateSlugs = new Set(getWeaponSlugs(candidate))
  const currentIsAria = currentSlugs.has('weapon-staff-of-hearts-aria-in-wanderland')
  const candidateIsAria = candidateSlugs.has('weapon-staff-of-hearts-aria-in-wanderland')
  const currentIsStaffOfHearts = [...currentSlugs].some((slug) => staffOfHeartsSlugs.has(slug))
  const candidateIsStaffOfHearts = [...candidateSlugs].some((slug) => staffOfHeartsSlugs.has(slug))

  if (currentIsStaffOfHearts && candidateIsStaffOfHearts && currentIsAria !== candidateIsAria) {
    return true
  }

  const pairSlugs = new Set([...currentSlugs, ...candidateSlugs])
  return pairSlugs.has('weapon-under-current') && pairSlugs.has('weapon-rip-current')
}

function isSpecificExactWeaponSibling(candidate: WeaponEntry, item: WeaponEntry): boolean {
  if (candidate.subtype === item.subtype) return false
  if (isExcludedWeaponRelatedPair(candidate, item)) return false
  if (normalizeRelatedWeaponName(candidate) !== normalizeRelatedWeaponName(item)) return false
  if (getRelatedNameTokens(getWeaponRelatedDisplayName(item)).length < 2) return false

  const currentPriceTypes = getWeaponPriceTypes(item)
  return [...getWeaponPriceTypes(candidate)].some((priceType) => currentPriceTypes.has(priceType))
}

function hasContainedMeaningfulWeaponName(candidate: WeaponEntry, item: WeaponEntry): boolean {
  if (candidate.subtype !== item.subtype) return false
  const currentName = normalizeRelatedWeaponName(item)
  const candidateName = normalizeRelatedWeaponName(candidate)
  if (currentName === candidateName) return false
  const shorter = currentName.length <= candidateName.length ? currentName : candidateName
  const longer = currentName.length > candidateName.length ? currentName : candidateName
  if (getRelatedNameTokens(shorter).length < 4) return false
  return longer.includes(shorter)
}

function isDeathKnightBladeSibling(candidate: WeaponEntry, item: WeaponEntry): boolean {
  if (candidate.subtype !== item.subtype) return false
  const currentName = normalizeRelatedWeaponName(item)
  const candidateName = normalizeRelatedWeaponName(candidate)
  if (!/\bdeathknight blade\b/i.test(currentName)) return false
  if (!/\bdeathknight blade\b/i.test(candidateName)) return false
  return !/\bdefault\b/i.test(currentName) && !/\bdefault\b/i.test(candidateName)
}

function getWeaponObtainFingerprints(entry: WeaponEntry): Set<string> {
  const methods = isWeaponFamily(entry)
    ? entry.levelVariants.flatMap((level) => level.obtainVariants)
    : entry.obtainMethods

  return new Set(methods.map(obtainMethodInferenceFingerprint))
}

function loadAllWeapons() {
  return loadWeaponsBySubtype().then((data) =>
    WEAPON_SUBTYPES.flatMap((meta) => data[meta.subtype])
  )
}

export function useWeaponBySlug(subtype: WeaponSubtype, slug?: string) {
  const { weapons, loading } = useWeaponSubtypeDataset(subtype)
  const weapon = useMemo(() => {
    if (loading) return undefined
    return weapons.find((entry) => weaponMatchesSlug(entry, slug)) ?? null
  }, [weapons, loading, slug])

  return { weapon, loading }
}

export type WeaponRelatedItem = RelatedItemResult<WeaponEntry, AlsoSeeRef>

const INFERRED_WEAPON_RELATED_LIMIT = 8
const INFERRED_WEAPON_RELATED_NAME_THRESHOLD = 0.7

export function useWeaponRelatedItems(weapon: WeaponEntry, alsoSee: AlsoSeeRef[] = []) {
  const filteredAlsoSee = alsoSee.filter((ref) => {
    if (weapon.slug !== 'weapon-staff-of-hearts-aria-in-wanderland') return true
    return ref.slug !== 'weapon-staff-of-hearts'
  })
  const { relatedItems, loading } = useRelatedItems({
    item: weapon,
    alsoSee: filteredAlsoSee,
    loadAll: loadAllWeapons,
    getSlugs: getWeaponSlugs,
    getRefs: getWeaponAlsoSeeRefs,
    getDisplayName: getWeaponRelatedDisplayName,
    getFingerprints: getWeaponObtainFingerprints,
    getScope: (entry) => entry.subtype,
    getSourceUrls: getWeaponSourceUrls,
    matchesRef: (entry, ref) =>
      ref.slug === 'weapon-rip-tide' ? entry.slug === ref.slug : weaponMatchesSlug(entry, ref.slug),
    refTargetsItem: (ref, _item, currentSlugs) => {
      const refIsAriaStaff = ref.slug === 'weapon-staff-of-hearts-aria-in-wanderland'
      const itemIsAriaStaff = currentSlugs.has('weapon-staff-of-hearts-aria-in-wanderland')
      if (refIsAriaStaff !== itemIsAriaStaff && ref.slug.includes('staff-of-hearts')) {
        return false
      }
      return currentSlugs.has(ref.slug)
    },
    isSameItem: isSameWeaponEntry,
    dedupeKey: (entry, slug) => `${entry.subtype}:${slug}`,
    hasInferredRelation: (candidate, currentItem, { hasSharedFingerprint }) =>
      !isExcludedWeaponRelatedPair(candidate, currentItem) &&
      (hasSharedFingerprint ||
        isSpecificExactWeaponSibling(candidate, currentItem) ||
        hasContainedMeaningfulWeaponName(candidate, currentItem) ||
        isDeathKnightBladeSibling(candidate, currentItem)),
    limit: INFERRED_WEAPON_RELATED_LIMIT,
    nameThreshold: INFERRED_WEAPON_RELATED_NAME_THRESHOLD,
  })

  return { relatedWeapons: relatedItems, loading }
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
      isDefault: entry.isDefault ?? false,
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
    name: getWeaponFamilyDisplayName(entry),
    description: getFamilyCardDescription(entry),
    elements: entry.elements,
    daRequired: entry.hasDA,
    dcRequired: entry.hasDC,
    dmRequired: entry.hasDM,
    isCosmetic: entry.isCosmetic ?? false,
    isDefault: entry.isDefault ?? false,
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
