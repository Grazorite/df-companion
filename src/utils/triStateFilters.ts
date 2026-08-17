export type FilterState = 'neutral' | 'include' | 'exclude'

export interface TriStateFilterSet<T extends string> {
  include: T[]
  exclude: T[]
}

export function getTriState<T extends string>(
  id: T,
  filters: TriStateFilterSet<T>
): FilterState {
  if (filters.include.includes(id)) return 'include'
  if (filters.exclude.includes(id)) return 'exclude'
  return 'neutral'
}

export function cycleTriState<T extends string>(
  id: T,
  filters: TriStateFilterSet<T>
): TriStateFilterSet<T> {
  const state = getTriState(id, filters)
  if (state === 'neutral') {
    return {
      include: [...filters.include, id],
      exclude: filters.exclude.filter((value) => value !== id),
    }
  }
  if (state === 'include') {
    return {
      include: filters.include.filter((value) => value !== id),
      exclude: [...filters.exclude, id],
    }
  }
  return {
    include: filters.include.filter((value) => value !== id),
    exclude: filters.exclude.filter((value) => value !== id),
  }
}

export function cycleSingleTriState<T extends string>(
  id: T,
  filters: TriStateFilterSet<T>
): TriStateFilterSet<T> {
  const state = getTriState(id, filters)
  if (state === 'neutral') return { include: [id], exclude: [] }
  if (state === 'include') return { include: [], exclude: [id] }
  return { include: [], exclude: [] }
}

export function parseFilterParam<T extends string>(
  value: string | null,
  isAllowed: (value: string) => value is T
): T[] {
  return value ? value.split(',').filter(isAllowed) : []
}
