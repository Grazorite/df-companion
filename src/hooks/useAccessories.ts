import { useEffect, useMemo, useState } from 'react'
import type { ElementsData } from '../types/element'
import type {
  AccessoryEntry,
  AccessoryFamily,
  AccessoryFilters,
  AccessorySubtype,
} from '../types/accessory'
import type { AlsoSeeRef } from '../types/item'
import { isAccessoryFamily, ACCESSORY_SUBTYPES } from '../types/accessory'
import {
  loadAccessoriesBySubtype,
  loadAccessoriesForSubtype,
  loadAccessoryManifest,
  loadElements,
} from '../utils/dataLoaders'
import { compareTitles, displayTitle } from '../utils/displayText'
import { getSearchWords } from '../utils/search'
import {
  getDisplayFamilyName,
  hasParentheticalVariantFamilyName,
  hasSameLevelVariants,
} from '../utils/variantHelpers'

const EMPTY_ACCESSORY_COUNTS = Object.fromEntries(
  ACCESSORY_SUBTYPES.map((meta) => [meta.subtype, 0])
) as Record<AccessorySubtype, number>

function useAccessorySubtypeDataset(subtype: AccessorySubtype) {
  const [accessories, setAccessories] = useState<AccessoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    loadAccessoriesForSubtype(subtype)
      .then((data) => {
        if (!active) return
        setAccessories(data)
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setAccessories([])
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [subtype])

  return { accessories, loading }
}

function useElementDataset() {
  const [elementMeta, setElementMeta] = useState<ElementsData>({
    elements: [],
    traits: [],
  })

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

function useAccessoryCountsDataset() {
  const [counts, setCounts] = useState<Record<AccessorySubtype, number>>(EMPTY_ACCESSORY_COUNTS)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    loadAccessoryManifest()
      .then((data) => {
        if (!active) return
        setCounts(data.bySubtype)
        setTotal(data.total)
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setCounts(EMPTY_ACCESSORY_COUNTS)
        setTotal(0)
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return { bySubtype: counts, total, loading }
}

function hasMultipleVersionHint(name: string): boolean {
  return /\((?:All Versions|[IVX]+(?:\s*[-,]\s*[IVX]+)+|[IVX]+-[IVX]+)\)/i.test(name)
}

function getAccessoryNameRange(name: string): string | undefined {
  const match = name.match(
    /\(((?:All Versions|[IVXLCDM]+(?:\s*[-,]\s*[IVXLCDM]+)+|[IVXLCDM]+-[IVXLCDM]+|\d+\s*-\s*\d+))\)/i
  )
  return match?.[1]?.trim()
}

function searchAccessories(
  items: AccessoryEntry[],
  subtype: AccessorySubtype,
  filters: AccessoryFilters,
  elementMeta: ElementsData
): AccessoryEntry[] {
  const queryWords = getSearchWords(filters.query ?? '')

  return items
    .filter((item) => {
      if (item.subtype !== subtype) return false

      const hasAccess = (flag: NonNullable<AccessoryFilters['access']>[number]) => {
        if (flag === 'multi') {
          return isAccessoryFamily(item)
            ? item.levelVariants.length > 1
            : hasMultipleVersionHint(item.name)
        }
        if (flag === 'da') return isAccessoryFamily(item) ? item.hasDA : item.daRequired
        if (flag === 'dc') return isAccessoryFamily(item) ? item.hasDC : Boolean(item.dcRequired)
        if (flag === 'dm') return isAccessoryFamily(item) ? item.hasDM : Boolean(item.dmRequired)
        if (flag === 'free') {
          return isAccessoryFamily(item)
            ? item.hasFree
            : item.obtainMethods.some((method) => method.priceType === 'free')
        }
        return isAccessoryFamily(item)
          ? item.hasMerge
          : item.obtainMethods.some((method) => method.priceType === 'merge')
      }

      if (filters.access && filters.access.length > 0) {
        for (const flag of filters.access) {
          if (!hasAccess(flag)) return false
        }
      }

      const itemRetired = isAccessoryFamily(item) ? item.retired === true : item.retired === true
      if (filters.categories && filters.categories.length > 0) {
        const hasCategory = filters.categories.some((category) => {
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
      } else if (itemRetired) {
        return false
      }

      if (filters.elements && filters.elements.length > 0) {
        const itemElements = isAccessoryFamily(item) ? item.elements : item.elements
        if (!filters.elements.some((code) => itemElements.includes(code))) return false
      }

      if (queryWords.length > 0) {
        const itemName = isAccessoryFamily(item) ? item.familyName : item.name
        const description = isAccessoryFamily(item) ? item.shared.description : item.description
        const tags = item.tags ?? []
        const variantNames = isAccessoryFamily(item)
          ? item.levelVariants.map((level) => level.name)
          : []

        const searchableText = [
          itemName,
          displayTitle(itemName),
          description,
          ...variantNames,
          ...tags,
          ...item.elements.map(
            (code) =>
              elementMeta.elements.find((element) => element.code === code)?.shortName ?? code
          ),
        ]
          .join(' ')
          .toLowerCase()

        const words = getSearchWords(searchableText)
        const matches = queryWords.every((queryWord) =>
          words.some((word) => word.startsWith(queryWord))
        )
        if (!matches) return false
      }

      return true
    })
    .sort((a, b) => {
      const aName = isAccessoryFamily(a) ? a.familyName : a.name
      const bName = isAccessoryFamily(b) ? b.familyName : b.name
      return compareTitles(aName, bName)
    })
}

export function useAccessories(subtype: AccessorySubtype, filters: AccessoryFilters = {}) {
  const { accessories: subtypeAccessories, loading } = useAccessorySubtypeDataset(subtype)
  const elementMeta = useElementDataset()
  const accessories = useMemo(
    () => searchAccessories(subtypeAccessories, subtype, filters, elementMeta),
    [subtypeAccessories, subtype, filters, elementMeta]
  )

  return {
    accessories,
    total: accessories.length,
    loading,
  }
}

function accessoryMatchesSlug(entry: AccessoryEntry, slug?: string): boolean {
  if (!slug) return false
  if (entry.slug === slug) return true
  return isAccessoryFamily(entry) && (entry.aliasSlugs ?? []).includes(slug)
}

export function useAccessoryBySlug(subtype: AccessorySubtype, slug?: string) {
  const { accessories, loading } = useAccessorySubtypeDataset(subtype)
  const accessory = useMemo(() => {
    if (loading) return undefined
    return accessories.find((entry) => accessoryMatchesSlug(entry, slug)) ?? null
  }, [accessories, loading, slug])

  return { accessory, loading }
}

export function useRelatedAccessories(alsoSee: AlsoSeeRef[] = []) {
  const [allAccessories, setAllAccessories] = useState<AccessoryEntry[]>([])
  const [loading, setLoading] = useState(alsoSee.length > 0)

  useEffect(() => {
    if (alsoSee.length === 0) {
      setAllAccessories([])
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    loadAccessoriesBySubtype()
      .then((data) => {
        if (!active) return
        setAllAccessories(ACCESSORY_SUBTYPES.flatMap((meta) => data[meta.subtype]))
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setAllAccessories([])
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [alsoSee.length])

  const relatedAccessories = useMemo(
    () =>
      alsoSee.map((ref) => ({
        ref,
        entry: allAccessories.find((item) => accessoryMatchesSlug(item, ref.slug)),
      })),
    [allAccessories, alsoSee]
  )

  return { relatedAccessories, loading }
}

export function useAccessoryCounts() {
  return useAccessoryCountsDataset()
}

export function useTotalAccessoryCount() {
  return useAccessoryCounts().total
}

export function getAccessorySubtypeRoute(subtype: AccessorySubtype): string {
  return `/accessories?type=${encodeURIComponent(subtype)}`
}

export function buildAccessoryCardData(entry: AccessoryEntry) {
  if (!isAccessoryFamily(entry)) {
    return {
      name: displayTitle(entry.name),
      description: entry.description,
      elements: entry.elements,
      daRequired: entry.daRequired,
      dcRequired: entry.dcRequired ?? false,
      dmRequired: entry.dmRequired ?? false,
      hasFree: entry.obtainMethods.some((method) => method.priceType === 'free'),
      hasMultipleVersions: hasMultipleVersionHint(entry.name),
      levelRange: getAccessoryNameRange(entry.name) ?? entry.level ?? '',
      route: `/accessories/${entry.slug}?type=${encodeURIComponent(entry.subtype)}`,
    }
  }

  return {
    name: displayTitle(getDisplayFamilyName(entry)),
    description: entry.shared.description,
    elements: entry.elements,
    daRequired: entry.hasDA,
    dcRequired: entry.hasDC,
    dmRequired: entry.hasDM,
    hasFree: entry.hasFree,
    hasMultipleVersions: entry.levelVariants.length > 1,
    levelRange:
      hasSameLevelVariants(entry) || hasParentheticalVariantFamilyName(entry.familyName)
        ? ''
        : entry.levelRange,
    route: `/accessories/${entry.slug}?type=${encodeURIComponent(entry.subtype)}`,
  }
}

export function getAccessoryActiveVariant(entry: AccessoryFamily, index: number) {
  return entry.levelVariants[Math.min(Math.max(index, 0), entry.levelVariants.length - 1)]
}
