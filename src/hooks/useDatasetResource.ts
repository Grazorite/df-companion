import { useEffect, useEffectEvent, useState } from 'react'

interface DatasetResource<T> {
  data: T
  error: Error | null
  loading: boolean
  retry: () => void
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error('The dataset could not be loaded.')
}

/**
 * Loads a public dataset without conflating a request failure with valid empty data.
 * Rejected loader promises must be reset by the loader so retry performs a real request.
 */
export function useDatasetResource<T>(
  load: () => Promise<T>,
  emptyValue: T,
  resourceKey: string
): DatasetResource<T> {
  const [data, setData] = useState<T>(emptyValue)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const loadResource = useEffectEvent(load)
  const getEmptyValue = useEffectEvent(() => emptyValue)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    loadResource()
      .then((nextData) => {
        if (!active) return
        setData(nextData)
        setLoading(false)
      })
      .catch((loadError: unknown) => {
        if (!active) return
        setData(getEmptyValue())
        setError(normalizeError(loadError))
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [resourceKey, attempt])

  return {
    data,
    error,
    loading,
    retry: () => setAttempt((current) => current + 1),
  }
}
