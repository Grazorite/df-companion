import { useMemo } from 'react'
import petsData from '../data/pets.json'
import guestsData from '../data/guests.json'
import elementsData from '../data/elements.json'
import type { Pet, PetFilters, EntryType } from '../types/pet'
import type { ItemFamily } from '../types/item'
import type { ElementsData } from '../types/element'

// Normalize legacy field names (specialMarkers → traits) at load time
const loadedPets: Pet[] = (petsData as unknown as Array<Pet & { specialMarkers?: string[] }>).map(p => {
  if (!p.traits && p.specialMarkers) {
    p.traits = p.specialMarkers
    delete p.specialMarkers
  }
  if (!p.traits) p.traits = []
  return p as Pet
})

const loadedGuests: Pet[] = (guestsData as unknown as Array<Pet & { specialMarkers?: string[] }>).map(p => {
  if (!p.traits && p.specialMarkers) {
    p.traits = p.specialMarkers
    delete p.specialMarkers
  }
  if (!p.traits) p.traits = []
  return p as Pet
})

// Combine pets and guests into single array
const allPets: Pet[] = [...loadedPets, ...loadedGuests]
const elementMeta = elementsData as ElementsData

// ─── Type Guard ───────────────────────────────────────────────────────────────

function isItemFamily(item: Pet | ItemFamily): item is ItemFamily {
  return 'levelVariants' in item && 'familyName' in item
}

// ─── Search ───────────────────────────────────────────────────────────────────

function searchPets(pets: (Pet | ItemFamily)[], filters: PetFilters): (Pet | ItemFamily)[] {
  const query = (filters.query ?? '').toLowerCase().trim()
  const queryWords = query.split(/\s+/).filter(w => w.length >= 2)

  return pets
    .filter(item => {
      const isFamily = isItemFamily(item)
      
      // Extract fields based on type
      const pet = isFamily ? null : (item as Pet)
      const family = isFamily ? (item as ItemFamily) : null
      
      const itemType = isFamily ? family!.type : pet!.type
      const itemElements = isFamily ? family!.elements : pet!.elements
      const itemTraits = isFamily ? [] : pet!.traits  // Families don't have traits yet
      const itemName = isFamily ? family!.familyName : pet!.name
      const itemDescription = isFamily ? family!.shared.description : pet!.description
      const itemTags = isFamily ? family!.tags : pet!.tags
      const itemRetired = isFamily ? (family!.retired ?? false) : (pet!.retired ?? false)
      
      // Segment filter — which type(s) are active
      if (filters.type && filters.type.length > 0) {
        if (!filters.type.includes(itemType as EntryType)) return false
      }

      // Element/trait filter — OR logic across selected codes (elements + traits combined)
      if (filters.elements && filters.elements.length > 0) {
        const itemCodes = [...itemElements, ...itemTraits]
        if (!filters.elements.some(e => itemCodes.includes(e))) return false
      }

      // Access filter (Level 1) — multi-select with AND logic
      if (filters.access && filters.access.length > 0) {
        for (const accessType of filters.access) {
          if (accessType === 'multi') {
            // Multiple Versions: show only ItemFamily with more than 1 level variant
            if (!isFamily || family!.levelVariants.length <= 1) return false
          }
          if (accessType === 'da') {
            const hasDA = isFamily ? family!.hasDA : pet!.daRequired
            if (!hasDA) return false
          }
          
          // Guests are never purchased - skip Free/DC/DM/Merge filters for guests
          const entryType: EntryType = isFamily ? family!.type : pet!.type
          const isGuest = entryType === 'guest'
          
          if (accessType === 'dc') {
            // Guests can't be DC purchased, always exclude
            if (isGuest) return false
            const hasDC = isFamily ? family!.hasDC : (pet!.dcRequired ?? false)
            if (!hasDC) return false
          }
          if (accessType === 'dm') {
            // Guests can't be DM purchased, always exclude
            if (isGuest) return false
            const hasDM = isFamily ? family!.hasDM : (pet!.dmRequired ?? false)
            if (!hasDM) return false
          }
          if (accessType === 'free') {
            // Guests are always "free" (invited), skip this filter for guests
            if (isGuest) return false
            const hasFree = isFamily
              ? family!.hasFree
              : pet!.obtainMethods.some(m => m.priceType === 'free')
            if (!hasFree) return false
          }
          if (accessType === 'merge') {
            // Guests can't be merged, always exclude
            if (isGuest) return false
            const hasMerge = isFamily
              ? family!.hasMerge
              : pet!.obtainMethods.some(m => m.priceType === 'merge')
            if (!hasMerge) return false
          }
        }
      }

      // Category filter (Level 2) — multi-select with OR logic
      if (filters.categories && filters.categories.length > 0) {
        const hasCategory = filters.categories.some(cat => {
          if (cat === 'temp') return isFamily ? (family!.isTemp === true) : (pet!.isTemp === true)
          if (cat === 'rare') return isFamily ? (family!.isRare === true) : (pet!.isRare === true)
          if (cat === 'seasonal') return isFamily ? (family!.isSeasonal === true) : (pet!.isSeasonal === true)
          if (cat === 'special-offer') return isFamily ? (family!.isSpecialOffer === true) : (pet!.isSpecialOffer === true)
          if (cat === 'retired') return itemRetired === true
          return false
        })
        
        // Special handling for retired: when selected, ONLY show retired; otherwise exclude retired
        if (filters.categories.includes('retired')) {
          if (!itemRetired) return false
        } else {
          // If retired NOT selected and other categories are, exclude retired items
          if (itemRetired) return false
          // If other categories selected, must match at least one
          if (!hasCategory) return false
        }
      } else {
        // No categories selected — exclude retired by default (same as badges)
        if (itemRetired) return false
      }

      // Text search — word-prefix matching
      // For families, search matches familyName, all variant names, and description
      if (queryWords.length > 0) {
        const variantNames = isFamily
          ? family!.levelVariants.map(lv => lv.name)
          : []
        
        const searchableText = [
          itemName,
          ...variantNames,
          itemDescription,
          ...itemElements.map(e => elementMeta.elements.find(el => el.code === e)?.shortName ?? e),
          ...itemTraits.map(t => elementMeta.traits.find(tr => tr.code === t)?.name ?? t),
          ...itemTags,
        ].join(' ').toLowerCase()

        const contentWords = searchableText.split(/\W+/)
        const matches = queryWords.every(qWord =>
          contentWords.some(cWord => cWord.startsWith(qWord))
        )
        if (!matches) return false
      }

      return true
    })
    .sort((a, b) => {
      const aIsFamily = isItemFamily(a)
      const bIsFamily = isItemFamily(b)
      const aName = aIsFamily ? (a as ItemFamily).familyName : (a as Pet).name
      const bName = bIsFamily ? (b as ItemFamily).familyName : (b as Pet).name
      
      if (queryWords.length > 0) {
        const aNameWords = aName.toLowerCase().split(/\W+/)
        const bNameWords = bName.toLowerCase().split(/\W+/)
        const aMatch = queryWords.some(qw => aNameWords.some(nw => nw.startsWith(qw)))
        const bMatch = queryWords.some(qw => bNameWords.some(nw => nw.startsWith(qw)))
        if (aMatch && !bMatch) return -1
        if (!aMatch && bMatch) return 1
      }
      return aName.localeCompare(bName)
    })
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function usePets(filters: PetFilters = {}) {
  const results = useMemo(() => searchPets(allPets, filters), [filters])
  return { pets: results, total: results.length }
}

export function usePetBySlug(slug: string): Pet | ItemFamily | null {
  return useMemo(() => allPets.find(p => p.slug === slug) ?? null, [slug])
}

/** Counts per type for the segment toggle — applies search/filter but ignores type filter */
export function usePetCounts(filters: Omit<PetFilters, 'type'> = {}): Record<EntryType, number> {
  return useMemo(() => {
    const filtersWithoutType = { ...filters, type: undefined }
    const all = searchPets(allPets, filtersWithoutType as PetFilters)
    return {
      pet: all.filter(p => p.type === 'pet').length,
      guest: all.filter(p => p.type === 'guest').length,
    }
  }, [filters])
}

export function useRelatedPets(alsoSee: { slug: string; name: string; type: string }[]) {
  return useMemo(
    () => alsoSee
      .map(ref => allPets.find(p => p.slug === ref.slug))
      .filter((p): p is Pet => p !== null && p !== undefined),
    [alsoSee]
  )
}

export function useTotalPetCount() {
  return allPets.length
}

// ─── Element hook ─────────────────────────────────────────────────────────────

export function useElements() {
  return elementMeta
}
