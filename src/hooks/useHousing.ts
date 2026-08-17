import { useEffect, useMemo, useState } from 'react'
import type { HousingEntry, HousingFilters, HousingSubtype } from '../types/housing'
import { isHousingFamily } from '../types/housing'
import { loadHousingBySubtype, loadHousingForSubtype, loadHousingManifest } from '../utils/dataLoaders'
import { compareTitles, displayTitle } from '../utils/displayText'
import { hasRetiredEntry } from '../utils/filterVisibility'
import { obtainMethodInferenceFingerprint } from '../utils/relatedItems'
import { getSearchWords } from '../utils/search'
import { useRelatedItems } from './useRelatedItems'

function hasMeaningfulEffect(effect: string | undefined): boolean {
  return Boolean(effect && !/^(?:none|n\/?a)$/i.test(effect.trim()))
}

function useHousingSubtypeDataset(subtype: HousingSubtype) {
  const [housing, setHousing] = useState<HousingEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    loadHousingForSubtype(subtype)
      .then((data) => {
        if (!active) return
        setHousing(data)
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setHousing([])
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [subtype])

  return { housing, loading }
}

function searchHousing(items: HousingEntry[], subtype: HousingSubtype, filters: HousingFilters) {
  const queryWords = getSearchWords(filters.query ?? '')

  return items
    .filter((item) => {
      if (item.subtype !== subtype) return false
      const isFamily = isHousingFamily(item)

      const hasAccess = (flag: NonNullable<HousingFilters['access']>[number]) => {
        if (flag === 'multiple') return isFamily && item.levelVariants.length > 1
        if (flag === 'dc') return isFamily ? item.hasDC : item.dcRequired === true
        return false
      }
      if (filters.access?.some((flag) => !hasAccess(flag))) return false
      if (filters.excludeAccess?.some((flag) => hasAccess(flag))) return false

      const itemRetired = item.retired === true
      const hasEffect = isFamily
        ? item.levelVariants.some((variant) => hasMeaningfulEffect(variant.effect))
        : item.hasSpecialEffect === true
      const hasCategory = (category: NonNullable<HousingFilters['categories']>[number]) => {
        if (category === 'effect') return hasEffect
        if (category === 'rare') return item.isRare === true
        if (category === 'seasonal') return item.isSeasonal === true
        if (category === 'retired') return itemRetired
        return false
      }
      if (filters.excludeCategories?.some((category) => hasCategory(category))) return false
      if (filters.categories && filters.categories.length > 0) {
        const matchesCategory = filters.categories.some((category) => hasCategory(category))
        if (filters.categories.includes('retired')) {
          if (!itemRetired) return false
        } else if (!matchesCategory || itemRetired) {
          return false
        }
      } else if (itemRetired) {
        return false
      }

      if (queryWords.length > 0) {
        const searchableText = [
          isFamily ? item.familyName : item.name,
          displayTitle(isFamily ? item.familyName : item.name),
          isFamily ? item.shared.description : item.description,
          ...(isFamily ? item.levelVariants.map((variant) => variant.name) : []),
          ...(isFamily
            ? item.levelVariants.flatMap((variant) =>
                variant.obtainVariants.map((obtain) => obtain.location)
              )
            : [item.location]),
          ...(isFamily ? item.levelVariants.map((variant) => variant.notes) : [item.notes]),
          ...item.tags,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        const contentWords = getSearchWords(searchableText)
        if (!queryWords.every((word) => contentWords.some((text) => text.startsWith(word)))) {
          return false
        }
      }

      return true
    })
    .sort((a, b) =>
      compareTitles(
        isHousingFamily(a) ? a.familyName : a.name,
        isHousingFamily(b) ? b.familyName : b.name
      )
    )
}

export function useHousing(subtype: HousingSubtype, filters: HousingFilters = {}) {
  const { housing: subtypeHousing, loading } = useHousingSubtypeDataset(subtype)
  const housing = useMemo(
    () => searchHousing(subtypeHousing, subtype, filters),
    [filters, subtype, subtypeHousing]
  )
  return { housing, total: housing.length, loading }
}

export function useHousingBySlug(subtype: HousingSubtype, slug: string) {
  const { housing, loading } = useHousingSubtypeDataset(subtype)
  const item = useMemo(() => {
    if (loading) return undefined
    return housing.find((entry) => entry.slug === slug) ?? null
  }, [housing, loading, slug])
  return { item, loading }
}

function getHousingSlugs(entry: HousingEntry): string[] {
  return isHousingFamily(entry)
    ? [entry.slug, ...(entry.aliasSlugs ?? [])]
    : [entry.slug]
}

function getHousingAlsoSeeRefs(entry: HousingEntry) {
  return isHousingFamily(entry) ? (entry.shared.alsoSee ?? []) : (entry.alsoSee ?? [])
}

function getHousingObtainFingerprints(entry: HousingEntry): Set<string> {
  const methods = isHousingFamily(entry)
    ? entry.levelVariants.flatMap((variant) => variant.obtainVariants)
    : (entry.obtainMethods ?? [])
  return new Set(methods.map(obtainMethodInferenceFingerprint))
}

function getHousingSourceUrls(entry: HousingEntry): string[] {
  const urls = isHousingFamily(entry)
    ? [
        entry.forumUrl,
        ...(entry.familySources?.map((source) => source.url) ?? []),
        ...entry.levelVariants.map((variant) => variant.sourceUrl),
      ]
    : [entry.forumUrl, entry.sourceUrl]
  return urls.filter((url): url is string => Boolean(url))
}

function housingMatchesSlug(entry: HousingEntry, slug: string) {
  return getHousingSlugs(entry).includes(slug)
}

function loadAllHousing() {
  return loadHousingBySubtype().then((bySubtype) => Object.values(bySubtype).flat())
}

export function useHousingRelatedItems(item: HousingEntry) {
  const { relatedItems, loading } = useRelatedItems({
    item,
    alsoSee: getHousingAlsoSeeRefs(item),
    loadAll: loadAllHousing,
    getSlugs: getHousingSlugs,
    getRefs: getHousingAlsoSeeRefs,
    getDisplayName: (entry) => displayTitle(isHousingFamily(entry) ? entry.familyName : entry.name),
    getFingerprints: getHousingObtainFingerprints,
    getScope: (entry) => entry.subtype,
    getSourceUrls: getHousingSourceUrls,
    matchesRef: (entry, ref) => housingMatchesSlug(entry, ref.slug),
    refTargetsItem: (ref, _item, currentSlugs) => currentSlugs.has(ref.slug),
    dedupeKey: (entry, slug) => `${entry.subtype}:${slug}`,
    limit: 8,
    nameThreshold: 0.55,
  })
  const relatedHousing = useMemo(
    () => relatedItems.flatMap((related) => (related.entry ? [related.entry] : [])),
    [relatedItems]
  )

  return { relatedHousing, loading }
}

export function useHousingCounts() {
  const [counts, setCounts] = useState<Record<HousingSubtype, number>>({
    house: 0,
    background: 0,
    floor: 0,
    rug: 0,
    shrub: 0,
    stuff: 0,
    'wall-item': 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    loadHousingManifest()
      .then((manifest) => {
        if (!active) return
        setCounts(manifest.bySubtype)
        setLoading(false)
      })
      .catch(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return {
    bySubtype: counts,
    total: Object.values(counts).reduce((sum, count) => sum + count, 0),
    loading,
  }
}

export function useHousingCategoryAvailability(subtype: HousingSubtype) {
  const { housing, loading } = useHousingSubtypeDataset(subtype)

  return useMemo(
    () => {
      const access = new Set<string>()
      const categories = new Set<string>()

      for (const entry of housing) {
        if (isHousingFamily(entry)) {
          if (entry.levelVariants.length > 1) access.add('multiple')
          if (entry.hasDC) access.add('dc')
        } else if (entry.dcRequired) {
          access.add('dc')
        }

        if (entry.isRare) categories.add('rare')
        if (entry.isSeasonal) categories.add('seasonal')
        if (entry.retired) categories.add('retired')
        if (
          isHousingFamily(entry)
            ? entry.levelVariants.some((variant) => hasMeaningfulEffect(variant.effect))
            : entry.hasSpecialEffect
        ) {
          categories.add('effect')
        }
      }

      return {
        loading,
        access,
        categories,
        hasRetired: hasRetiredEntry(housing),
      }
    },
    [housing, loading]
  )
}

export function useTotalHousingCount(): number {
  return useHousingCounts().total
}
