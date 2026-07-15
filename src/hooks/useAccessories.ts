import { useMemo } from 'react'
import artifactsData from '../data/artifacts.json'
import beltsData from '../data/belts.json'
import bracersData from '../data/bracers.json'
import capesWingsData from '../data/capes-wings.json'
import helmsData from '../data/helms.json'
import necklacesData from '../data/necklaces.json'
import ringsData from '../data/rings.json'
import trinketsData from '../data/trinkets.json'
import elementsData from '../data/elements.json'
import type { ElementsData } from '../types/element'
import type {
  AccessoryEntry,
  AccessoryFamily,
  AccessoryFilters,
  AccessorySubtype,
} from '../types/accessory'
import { isAccessoryFamily, ACCESSORY_SUBTYPES } from '../types/accessory'

const datasets = {
  artifact: artifactsData as AccessoryEntry[],
  belt: beltsData as AccessoryEntry[],
  bracer: bracersData as AccessoryEntry[],
  'cape-wing': capesWingsData as AccessoryEntry[],
  helm: helmsData as AccessoryEntry[],
  necklace: necklacesData as AccessoryEntry[],
  ring: ringsData as AccessoryEntry[],
  trinket: trinketsData as AccessoryEntry[],
}

const allAccessories = ACCESSORY_SUBTYPES.flatMap(meta => datasets[meta.subtype])
const elementMeta = elementsData as ElementsData

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
  filters: AccessoryFilters
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
  const accessories = useMemo(
    () => searchAccessories(allAccessories, subtype, filters),
    [subtype, filters.query, filters.access, filters.elements]
  )

  return {
    accessories,
    total: accessories.length,
  }
}

export function useAccessoryBySlug(subtype: AccessorySubtype, slug?: string) {
  const accessory = useMemo(
    () => datasets[subtype].find(entry => entry.slug === slug),
    [subtype, slug]
  )

  return accessory
}

export function useAccessoryCounts() {
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
