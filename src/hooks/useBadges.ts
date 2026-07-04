import { useMemo } from 'react'
import badgesData from '../data/badges.json'
import categoriesData from '../data/categories.json'
import { searchBadges } from '../utils/search'
import type { Badge, BadgeFilters, CategoryMeta } from '../types/badge'

const badges = (badgesData as Badge[]).map((badge) => ({
  ...badge,
  retired: badge.retired || /badge was retired on/i.test(badge.notes ?? ''),
  imageUrl: badge.imageUrl ?? badge.forumImageUrl,
}))
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

/** Returns all subcategories for a given top-level category, sorted as they appear in the forum */
export function useSubcategories(category: string): string[] {
  return useMemo(() => {
    if (!category) return []
    const subs = badges
      .filter((b) => b.category === category && b.subcategory)
      .map((b) => b.subcategory as string)
    // Preserve forum order by using insertion-order dedup
    const allSubs = [...new Set(subs)]
    
    // Remove "Misc" from quest-completion and collection categories
    if (category === 'quest-completion' || category === 'collection') {
      return allSubs.filter(sub => sub !== 'Misc')
    }
    
    return allSubs
  }, [category])
}

export function useBadgesByCategory(category: string, excludeSlug?: string, subcategory?: string) {
  return useMemo(() => {
    const pool = badges.filter((b) => b.category === category && b.slug !== excludeSlug)
    const sameSubcat = subcategory ? pool.filter((b) => b.subcategory === subcategory) : []
    const others = pool.filter((b) => !subcategory || b.subcategory !== subcategory)
    // Prefer same subcategory, shuffled — then fill from rest of category, also shuffled
    const shuffled = [
      ...sameSubcat.sort(() => Math.random() - 0.5),
      ...others.sort(() => Math.random() - 0.5),
    ]
    return shuffled.slice(0, 5)
  }, [category, excludeSlug, subcategory])
}

export function useTotalBadgeCount() {
  return badges.length
}
