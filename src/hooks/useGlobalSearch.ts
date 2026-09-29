import { useCallback, useEffect, useState } from 'react'
import searchIndexUrl from '../data/search-index.json?url'
import {
  rehydrateSearchIndex,
  type CompactSearchRecord,
  type SearchHit,
} from '../utils/searchIndex'

/**
 * The palette loads a single compact search-index JSON (name + slug + subtype +
 * section per entry) the first time it opens — NOT the full category datasets.
 * Full datasets load only once the user navigates to a result's detail page.
 * The rehydrated hits are cached at module scope so reopening is instant.
 */
let cachedIndex: SearchHit[] | null = null
let indexPromise: Promise<SearchHit[]> | null = null

function loadIndex(): Promise<SearchHit[]> {
  if (cachedIndex) return Promise.resolve(cachedIndex)
  if (!indexPromise) {
    indexPromise = fetch(searchIndexUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load search index: ${response.status}`)
        return response.json() as Promise<CompactSearchRecord[]>
      })
      .then((records) => {
        cachedIndex = rehydrateSearchIndex(records)
        return cachedIndex
      })
      .catch((error) => {
        // Drop the failed promise so a retry can start a fresh fetch.
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
  error: boolean
  retry: () => void
}

/**
 * Loads (once) and returns the global search index. Pass `enabled` so the fetch
 * only starts when the palette actually opens. On failure, exposes `error` and a
 * `retry()` that starts a fresh fetch.
 */
export function useGlobalSearch(enabled: boolean): GlobalSearchState {
  const [hits, setHits] = useState<SearchHit[] | null>(cachedIndex)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!enabled || hits) return
    let cancelled = false
    setError(false)
    loadIndex().then(
      (index) => {
        if (!cancelled) setHits(index)
      },
      () => {
        if (!cancelled) setError(true)
      }
    )
    return () => {
      cancelled = true
    }
  }, [enabled, hits, attempt])

  const retry = useCallback(() => {
    setError(false)
    setAttempt((current) => current + 1)
  }, [])

  return {
    hits: hits ?? [],
    loading: enabled && !hits && !error,
    ready: hits !== null,
    error,
    retry,
  }
}
