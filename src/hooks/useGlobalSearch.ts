import { useEffect, useState } from 'react'
import {
  loadAccessoriesBySubtype,
  loadBadges,
  loadClassAbilitiesBySubtype,
  loadHousingBySubtype,
  loadPetsAndGuests,
  loadWeaponsBySubtype,
} from '../utils/dataLoaders'
import { buildSearchIndex, type SearchHit } from '../utils/searchIndex'

/**
 * The palette index is built lazily and cached at module scope: the datasets
 * are only fetched the first time the palette is opened, and the (cached)
 * per-section loaders mean this also warms the caches that list/detail pages
 * reuse — nothing is double-fetched.
 */
let cachedIndex: SearchHit[] | null = null
let indexPromise: Promise<SearchHit[]> | null = null

function loadIndex(): Promise<SearchHit[]> {
  if (cachedIndex) return Promise.resolve(cachedIndex)
  if (!indexPromise) {
    indexPromise = Promise.all([
      loadBadges(),
      loadPetsAndGuests(),
      loadAccessoriesBySubtype(),
      loadWeaponsBySubtype(),
      loadHousingBySubtype(),
      loadClassAbilitiesBySubtype(),
    ])
      .then(([badges, petsGuests, accessories, weapons, housing, classes]) => {
        cachedIndex = buildSearchIndex({
          badges,
          petsGuests,
          accessories,
          weapons,
          housing,
          classes,
        })
        return cachedIndex
      })
      .catch((error) => {
        // Allow a later open to retry rather than caching a failed promise.
        indexPromise = null
        throw error
      })
  }
  return indexPromise
}

export interface GlobalSearchState {
  hits: SearchHit[]
  loading: boolean
  ready: boolean
}

/**
 * Loads (once) and returns the global search index. Pass `enabled` so the fetch
 * only starts when the palette actually opens.
 */
export function useGlobalSearch(enabled: boolean): GlobalSearchState {
  const [hits, setHits] = useState<SearchHit[] | null>(cachedIndex)

  useEffect(() => {
    if (!enabled || hits) return
    let cancelled = false
    loadIndex().then(
      (index) => {
        if (!cancelled) setHits(index)
      },
      () => {
        // Swallow — a subsequent open retries via the reset promise above.
      }
    )
    return () => {
      cancelled = true
    }
  }, [enabled, hits])

  return {
    hits: hits ?? [],
    loading: enabled && !hits,
    ready: hits !== null,
  }
}
