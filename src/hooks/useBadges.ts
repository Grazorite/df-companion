import { useMemo } from 'react'
import badgesData from '../data/badges.json'
import categoriesData from '../data/categories.json'
import { searchBadges } from '../utils/search'
import type { Badge, BadgeFilters, CategoryMeta } from '../types/badge'

const badges = badgesData as Badge[]
const categories = categoriesData as CategoryMeta[]

export function useBadges(filters: BadgeFilters = {}) {
  const results = useMemo(() => searchBadges(badges, filters), [filters])

  return { badges: results, total: results.length }
}

export function useBadgeBySlug(slug: string) {
  return useMemo(() => badges.find((b) => b.slug === slug) ?? null, [slug])
}

export function useCategories() {
  return categories
}

export function useBadgesByCategory(category: string, excludeSlug?: string) {
  return useMemo(
    () => badges.filter((b) => b.category === category && b.slug !== excludeSlug).slice(0, 5),
    [category, excludeSlug]
  )
}

export function useTotalBadgeCount() {
  return badges.length
}
