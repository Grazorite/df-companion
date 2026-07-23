import { useEffect, useMemo, useState } from 'react'
import type { Pet, PetFilters, EntryType } from '../types/pet'
import type { ItemFamily } from '../types/item'
import type { ElementsData } from '../types/element'
import { loadElements, loadPetsAndGuests, loadPetsGuestsManifest } from '../utils/dataLoaders'
import { compareTitles, displayTitle } from '../utils/displayText'
import { getSearchWords } from '../utils/search'

function isItemFamily(item: Pet | ItemFamily): item is ItemFamily {
  return 'levelVariants' in item && 'familyName' in item
}

function getDisplayName(item: Pet | ItemFamily): string {
  return isItemFamily(item) ? item.familyName : item.name
}

function normalizeDuplicateVariantName(name: string): string {
  return name.replace(/\s+\((All Versions|[IVX]+-[IVX]+)\)$/i, '').trim()
}

function dedupeVariantEntries(items: Array<Pet | ItemFamily>) {
  const canonicalByNormalized = new Map<string, Pet | ItemFamily>()
  const aliasToCanonicalSlug = new Map<string, string>()

  for (const item of items) {
    const displayName = getDisplayName(item)
    const normalizedName = normalizeDuplicateVariantName(displayName)
    const existing = canonicalByNormalized.get(normalizedName)

    if (!existing) {
      canonicalByNormalized.set(normalizedName, item)
      continue
    }

    const existingName = getDisplayName(existing)
    const currentIsCanonicalName = displayName === normalizedName
    const existingIsCanonicalName = existingName === normalizedName
    const currentScore =
      (currentIsCanonicalName ? 4 : 0) +
      (isItemFamily(item) ? 2 : 0) +
      ('imageUrl' in item && item.imageUrl ? 1 : 0)
    const existingScore =
      (existingIsCanonicalName ? 4 : 0) +
      (isItemFamily(existing) ? 2 : 0) +
      ('imageUrl' in existing && existing.imageUrl ? 1 : 0)

    if (currentScore > existingScore) {
      aliasToCanonicalSlug.set(existing.slug, item.slug)
      if (isItemFamily(existing)) {
        existing.aliasSlugs?.forEach((alias) => aliasToCanonicalSlug.set(alias, item.slug))
      }
      canonicalByNormalized.set(normalizedName, item)
    } else {
      aliasToCanonicalSlug.set(item.slug, existing.slug)
    }
  }

  for (const item of canonicalByNormalized.values()) {
    if (!isItemFamily(item) || !item.aliasSlugs) continue
    for (const aliasSlug of item.aliasSlugs) {
      aliasToCanonicalSlug.set(aliasSlug, item.slug)
    }
  }

  return {
    items: Array.from(canonicalByNormalized.values()),
    aliasToCanonicalSlug,
  }
}

function usePetDataset() {
  const [allPets, setAllPets] = useState<Array<Pet | ItemFamily>>([])
  const [petSlugAliases, setPetSlugAliases] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    loadPetsAndGuests()
      .then((items) => {
        if (!active) return
        const dedupedEntries = dedupeVariantEntries(items)
        setAllPets(dedupedEntries.items)
        setPetSlugAliases(dedupedEntries.aliasToCanonicalSlug)
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setAllPets([])
        setPetSlugAliases(new Map())
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return { allPets, petSlugAliases, loading }
}

function useElementsDataset() {
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

function usePetsGuestsManifestDataset() {
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    loadPetsGuestsManifest()
      .then((data) => {
        if (!active) return
        setTotal(data.total)
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setTotal(0)
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return { total, loading }
}

// ─── Search ───────────────────────────────────────────────────────────────────

function searchPets(
  pets: (Pet | ItemFamily)[],
  filters: PetFilters,
  elementMeta: ElementsData
): (Pet | ItemFamily)[] {
  const queryWords = getSearchWords(filters.query ?? '')
  const hasRetiredSignal = (...values: Array<string | undefined>): boolean =>
    values.some((value) =>
      value
        ? /previously attainable[\s\S]*retired|retired (?:access point|da access point|quest|version|location|entry)|previously attainable in the retired/i.test(
            value
          )
        : false
    )

  return pets
    .filter((item) => {
      const isFamily = isItemFamily(item)

      // Extract fields based on type
      const pet = isFamily ? null : (item as Pet)
      const family = isFamily ? (item as ItemFamily) : null

      const itemType = isFamily ? family!.type : pet!.type
      const isGuestEntry = itemType === 'guest'
      const itemElements = isFamily ? family!.elements : pet!.elements
      const itemTraits = isFamily ? [] : pet!.traits // Families don't have traits yet
      const itemName = isFamily ? family!.familyName : pet!.name
      const itemDescription = isFamily ? family!.shared.description : pet!.description
      const itemTags = isFamily ? family!.tags : pet!.tags
      const itemRetired = isFamily
        ? Boolean(
            family!.retired ||
            hasRetiredSignal(
              family!.shared.notes,
              ...family!.levelVariants.map((level) => level.notes),
              ...family!.levelVariants.flatMap((level) =>
                level.obtainVariants.map(
                  (variant) => `${variant.location} ${variant.requirements ?? ''}`
                )
              )
            )
          )
        : Boolean(
            pet!.retired ||
            hasRetiredSignal(
              pet!.notes,
              ...pet!.obtainMethods.map(
                (method) => `${method.location} ${method.requirements ?? ''}`
              )
            )
          )

      // Segment filter — which type(s) are active
      if (filters.type && filters.type.length > 0) {
        if (!filters.type.includes(itemType as EntryType)) return false
      }

      // Element/trait filter — OR logic across selected codes (elements + traits combined)
      if (filters.elements && filters.elements.length > 0) {
        const itemCodes = [...itemElements, ...itemTraits]
        if (!filters.elements.some((e) => itemCodes.includes(e))) return false
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
          const entryType = isFamily ? family!.type : pet!.type
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
              : pet!.obtainMethods.some((m) => m.priceType === 'free')
            if (!hasFree) return false
          }
          if (accessType === 'merge') {
            // Guests can't be merged, always exclude
            if (isGuest) return false
            const hasMerge = isFamily
              ? family!.hasMerge
              : pet!.obtainMethods.some((m) => m.priceType === 'merge')
            if (!hasMerge) return false
          }
        }
      }

      // Category filter (Level 2) — multi-select with OR logic
      if (filters.categories && filters.categories.length > 0) {
        const hasCategory = filters.categories.some((cat) => {
          if (cat === 'temp') return isFamily ? family!.isTemp === true : pet!.isTemp === true
          if (cat === 'rare') return isFamily ? family!.isRare === true : pet!.isRare === true
          if (cat === 'seasonal')
            return isFamily ? family!.isSeasonal === true : pet!.isSeasonal === true
          if (cat === 'special-offer')
            return isFamily ? family!.isSpecialOffer === true : pet!.isSpecialOffer === true
          if (cat === 'retired') return itemRetired === true
          return false
        })

        // Special handling for retired: when selected, ONLY show retired; otherwise exclude retired
        if (filters.categories.includes('retired')) {
          if (!itemRetired) return false
        } else {
          // Pets keep the badges-style retired exclusion.
          // Guests remain visible in "All" and category browsing even if marked retired.
          if (!isGuestEntry && itemRetired) return false
          // If other categories selected, must match at least one
          if (!hasCategory) return false
        }
      } else {
        // No categories selected — exclude retired pets by default.
        // Guests stay visible so older companion entries don't disappear from "All".
        if (!isGuestEntry && itemRetired) return false
      }

      // Text search — word-prefix matching
      // For families, search matches familyName, all variant names, and description
      if (queryWords.length > 0) {
        const variantNames = isFamily ? family!.levelVariants.map((lv) => lv.name) : []

        const searchableText = [
          itemName,
          displayTitle(itemName),
          ...variantNames,
          itemDescription,
          ...itemElements.map(
            (e) => elementMeta.elements.find((el) => el.code === e)?.shortName ?? e
          ),
          ...itemTraits.map((t) => elementMeta.traits.find((tr) => tr.code === t)?.name ?? t),
          ...itemTags,
        ]
          .join(' ')
          .toLowerCase()

        const contentWords = getSearchWords(searchableText)
        const matches = queryWords.every((qWord) =>
          contentWords.some((cWord) => cWord.startsWith(qWord))
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
        const aNameWords = getSearchWords(displayTitle(aName))
        const bNameWords = getSearchWords(displayTitle(bName))
        const aMatch = queryWords.some((qw) => aNameWords.some((nw) => nw.startsWith(qw)))
        const bMatch = queryWords.some((qw) => bNameWords.some((nw) => nw.startsWith(qw)))
        if (aMatch && !bMatch) return -1
        if (!aMatch && bMatch) return 1
      }
      return compareTitles(aName, bName)
    })
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function usePets(filters: PetFilters = {}) {
  const { allPets, loading } = usePetDataset()
  const elementMeta = useElementsDataset()
  const results = useMemo(
    () => searchPets(allPets, filters, elementMeta),
    [allPets, filters, elementMeta]
  )
  return { pets: results, total: results.length, loading }
}

export function usePetBySlug(slug: string): Pet | ItemFamily | null | undefined {
  const { allPets, petSlugAliases, loading } = usePetDataset()
  return useMemo(() => {
    if (loading) return undefined
    const canonicalSlug = petSlugAliases.get(slug) ?? slug
    return allPets.find((p) => p.slug === canonicalSlug) ?? null
  }, [allPets, loading, petSlugAliases, slug])
}

/** Counts per type for the segment toggle — applies search/filter but ignores type filter */
export function usePetCounts(filters: Omit<PetFilters, 'type'> = {}): Record<EntryType, number> {
  const { allPets } = usePetDataset()
  const elementMeta = useElementsDataset()
  return useMemo(() => {
    const filtersWithoutType = { ...filters, type: undefined }
    const all = searchPets(allPets, filtersWithoutType as PetFilters, elementMeta)
    return {
      pet: all.filter((p) => p.type === 'pet').length,
      guest: all.filter((p) => p.type === 'guest').length,
    }
  }, [allPets, elementMeta, filters])
}

export function useRelatedPets(alsoSee: { slug: string; name: string; type: string }[]) {
  const { allPets, petSlugAliases } = usePetDataset()
  return useMemo(
    () =>
      alsoSee
        .map((ref) => allPets.find((p) => p.slug === (petSlugAliases.get(ref.slug) ?? ref.slug)))
        .filter((p): p is Pet | ItemFamily => p !== null && p !== undefined),
    [allPets, alsoSee, petSlugAliases]
  )
}

export function useTotalPetCount() {
  return usePetsGuestsManifestDataset().total
}

// ─── Element hook ─────────────────────────────────────────────────────────────

export function useElements() {
  return useElementsDataset()
}
