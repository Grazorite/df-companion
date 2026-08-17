export interface CategoryFilterAvailability {
  loading: boolean
  access?: ReadonlySet<string>
  categories?: ReadonlySet<string>
  elements?: ReadonlySet<string>
  hasRetired?: boolean
}

export function hasRetiredEntry<T extends { retired?: boolean }>(entries: T[]): boolean {
  return entries.some((entry) => entry.retired === true)
}

export function shouldShowAvailableFilter(
  id: string,
  kind: 'access' | 'category' | 'element',
  availability: CategoryFilterAvailability
): boolean {
  if (availability.loading) return false
  if (kind === 'category' && id === 'retired') {
    return availability.hasRetired === true || availability.categories?.has(id) === true
  }
  const key = kind === 'element' ? 'elements' : kind === 'category' ? 'categories' : 'access'
  const values = availability[key]
  return values ? values.has(id) : true
}

export function filterCategoryOptionsByAvailability<T extends { id: string }>(
  options: readonly T[],
  availability: CategoryFilterAvailability,
  shouldShow?: (option: T) => boolean
): T[] {
  return options.filter(
    (option) =>
      shouldShowAvailableFilter(option.id, 'category', availability) &&
      (shouldShow ? shouldShow(option) : true)
  )
}

export function filterAccessOptionsByAvailability<T extends { id: string }>(
  options: readonly T[],
  availability: CategoryFilterAvailability,
  shouldShow?: (option: T) => boolean
): T[] {
  return options.filter(
    (option) =>
      shouldShowAvailableFilter(option.id, 'access', availability) &&
      (shouldShow ? shouldShow(option) : true)
  )
}

export function filterElementOptionsByAvailability<T extends { code: string }>(
  options: readonly T[],
  availability: CategoryFilterAvailability
): T[] {
  return options.filter((option) => shouldShowAvailableFilter(option.code, 'element', availability))
}
