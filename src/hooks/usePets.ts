import { useMemo } from 'react'
import petsData from '../data/pets.json'
import elementsData from '../data/elements.json'
import type { Pet, PetFilters, EntryType } from '../types/pet'
import type { ElementsData } from '../types/element'

// Normalize legacy field names (specialMarkers → traits) at load time
const allPets: Pet[] = (petsData as unknown as Array<Pet & { specialMarkers?: string[] }>).map(p => {
  if (!p.traits && p.specialMarkers) {
    p.traits = p.specialMarkers
    delete p.specialMarkers
  }
  if (!p.traits) p.traits = []
  return p as Pet
})
const elementMeta = elementsData as ElementsData

// ─── Search ───────────────────────────────────────────────────────────────────

function searchPets(pets: Pet[], filters: PetFilters): Pet[] {
  const query = (filters.query ?? '').toLowerCase().trim()
  const queryWords = query.split(/\s+/).filter(w => w.length >= 2)

  return pets
    .filter(pet => {
      // Segment filter — which type(s) are active
      if (filters.type && filters.type.length > 0) {
        if (!filters.type.includes(pet.type)) return false
      }

      // Element/trait filter — OR logic across selected codes (elements + traits combined)
      if (filters.elements && filters.elements.length > 0) {
        const petCodes = [...pet.elements, ...pet.traits]
        if (!filters.elements.some(e => petCodes.includes(e))) return false
      }

      // Access filter
      if (filters.access) {
        if (filters.access === 'da' && !pet.daRequired) return false
        if (filters.access === 'dc' && !pet.obtainMethods.some(m => m.priceType === 'dc')) return false
        if (filters.access === 'free' && !pet.obtainMethods.some(m => m.priceType === 'free')) return false
      }

      // Text search — word-prefix matching (same algorithm as badges)
      if (queryWords.length > 0) {
        const searchableText = [
          pet.name,
          pet.description,
          ...pet.elements.map(e => elementMeta.elements.find(el => el.code === e)?.shortName ?? e),
          ...pet.traits.map(t => elementMeta.traits.find(tr => tr.code === t)?.name ?? t),
          ...pet.tags,
        ].join(' ').toLowerCase()

        const contentWords = searchableText.split(/\W+/)
        return queryWords.every(qWord =>
          contentWords.some(cWord => cWord.startsWith(qWord))
        )
      }

      return true
    })
    .sort((a, b) => {
      if (queryWords.length > 0) {
        const aNameWords = a.name.toLowerCase().split(/\W+/)
        const bNameWords = b.name.toLowerCase().split(/\W+/)
        const aMatch = queryWords.some(qw => aNameWords.some(nw => nw.startsWith(qw)))
        const bMatch = queryWords.some(qw => bNameWords.some(nw => nw.startsWith(qw)))
        if (aMatch && !bMatch) return -1
        if (!aMatch && bMatch) return 1
      }
      return a.name.localeCompare(b.name)
    })
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function usePets(filters: PetFilters = {}) {
  const results = useMemo(() => searchPets(allPets, filters), [filters])
  return { pets: results, total: results.length }
}

export function usePetBySlug(slug: string) {
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
