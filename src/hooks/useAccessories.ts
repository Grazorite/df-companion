import { useEffect, useMemo, useState } from 'react'
import type { ElementsData } from '../types/element'
import type {
  AccessoryEntry,
  AccessoryFamily,
  AccessoryFilters,
  AccessorySubtype,
} from '../types/accessory'
import { isAccessoryFamily, ACCESSORY_SUBTYPES } from '../types/accessory'
import { loadAccessoriesBySubtype, loadElements } from '../utils/dataLoaders'

function useAccessoryDataset() {
  const [datasets, setDatasets] = useState<Record<AccessorySubtype, AccessoryEntry[]>>({
    artifact: [],
    belt: [],
    bracer: [],
    'cape-wing': [],
    helm: [],
    necklace: [],
    ring: [],
    trinket: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    loadAccessoriesBySubtype()
      .then(data => {
        if (!active) return
        setDatasets(data)
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return { datasets, loading }
}

function useElementDataset() {
  const [elementMeta, setElementMeta] = useState<ElementsData>({
    elements: [],
    traits: [],
  })

  useEffect(() => {
    let active = true
    loadElements()
      .then(data => {
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

function hasMultipleVersionHint(name: string): boolean {
  return /\((?:All Versions|[IVX]+(?:\s*[-,]\s*[IVX]+)+|[IVX]+-[IVX]+)\)/i.test(name)
}

function getAccessoryNameRange(name: string): string | undefined {
  const match = name.match(/\(((?:All Versions|[IVXLCDM]+(?:\s*[-,]\s*[IVXLCDM]+)+|[IVXLCDM]+-[IVXLCDM]+|\d+\s*-\s*\d+))\)/i)
  return match?.[1]?.trim()
}

function searchAccessories(
  items: AccessoryEntry[],
  subtype: AccessorySubtype,
  filters: AccessoryFilters,
  elementMeta: ElementsData
): AccessoryEntry[] {
  const query = (filters.query ?? '').toLowerCase().trim()
  const queryWords = query.split(/\s+/).filter(word => word.length >= 2)

  return items
    .filter(item => {
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
            : item.obtainMethods.some(method => method.priceType === 'free')
        }
        return isAccessoryFamily(item)
          ? item.hasMerge
          : item.obtainMethods.some(method => method.priceType === 'merge')
      }

      if (filters.access && filters.access.length > 0) {
        for (const flag of filters.access) {
          if (!hasAccess(flag)) return false
        }
      }

      if (filters.elements && filters.elements.length > 0) {
        const itemElements = isAccessoryFamily(item) ? item.elements : item.elements
        if (!filters.elements.some(code => itemElements.includes(code))) return false
      }

      if (queryWords.length > 0) {
        const itemName = isAccessoryFamily(item) ? item.familyName : item.name
        const description = isAccessoryFamily(item) ? item.shared.description : item.description
        const tags = item.tags ?? []
        const variantNames = isAccessoryFamily(item) ? item.levelVariants.map(level => level.name) : []

        const searchableText = [
          itemName,
          description,
          ...variantNames,
          ...tags,
          ...item.elements.map(
            code => elementMeta.elements.find(element => element.code === code)?.shortName ?? code
          ),
        ]
          .join(' ')
          .toLowerCase()

        const words = searchableText.split(/\W+/)
        const matches = queryWords.every(queryWord =>
          words.some(word => word.startsWith(queryWord))
        )
        if (!matches) return false
      }

      return true
    })
    .sort((a, b) => {
      const aName = isAccessoryFamily(a) ? a.familyName : a.name
      const bName = isAccessoryFamily(b) ? b.familyName : b.name
      return aName.localeCompare(bName)
    })
}

export function useAccessories(subtype: AccessorySubtype, filters: AccessoryFilters = {}) {
  const { datasets, loading } = useAccessoryDataset()
  const allAccessories = useMemo(
    () => ACCESSORY_SUBTYPES.flatMap(meta => datasets[meta.subtype]),
    [datasets]
  )
  const elementMeta = useElementDataset()
  const accessories = useMemo(
    () => searchAccessories(allAccessories, subtype, filters, elementMeta),
    [allAccessories, subtype, filters, elementMeta]
  )

  return {
    accessories,
    total: accessories.length,
    loading,
  }
}

export function useAccessoryBySlug(subtype: AccessorySubtype, slug?: string) {
  const { datasets, loading } = useAccessoryDataset()
  const accessory = useMemo(
    () => {
      if (loading) return undefined
      return datasets[subtype].find(entry => entry.slug === slug) ?? null
    },
    [datasets, loading, subtype, slug]
  )

  return { accessory, loading }
}

export function useAccessoryCounts() {
  const { datasets } = useAccessoryDataset()
  return useMemo(() => {
    const counts = Object.fromEntries(
      ACCESSORY_SUBTYPES.map(meta => [meta.subtype, datasets[meta.subtype].length])
    ) as Record<AccessorySubtype, number>

    return {
      total: Object.values(counts).reduce((sum, count) => sum + count, 0),
      bySubtype: counts,
    }
  }, [])
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
      name: entry.name,
      description: entry.description,
      elements: entry.elements,
      daRequired: entry.daRequired,
      dcRequired: entry.dcRequired ?? false,
      dmRequired: entry.dmRequired ?? false,
      hasFree: entry.obtainMethods.some(method => method.priceType === 'free'),
      hasMultipleVersions: hasMultipleVersionHint(entry.name),
      levelRange: getAccessoryNameRange(entry.name) ?? entry.level ?? '',
      route: `/accessories/${entry.slug}?type=${encodeURIComponent(entry.subtype)}`,
    }
  }

  return {
    name: entry.familyName,
    description: entry.shared.description,
    elements: entry.elements,
    daRequired: entry.hasDA,
    dcRequired: entry.hasDC,
    dmRequired: entry.hasDM,
    hasFree: entry.hasFree,
    hasMultipleVersions: entry.levelVariants.length > 1,
    levelRange: entry.levelRange,
    route: `/accessories/${entry.slug}?type=${encodeURIComponent(entry.subtype)}`,
  }
}

export function getAccessoryActiveVariant(entry: AccessoryFamily, index: number) {
  return entry.levelVariants[Math.min(Math.max(index, 0), entry.levelVariants.length - 1)]
}
