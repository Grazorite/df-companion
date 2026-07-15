import { useEffect, useMemo, useState } from 'react'
import { searchBadges } from '../utils/search'
import { loadBadges, loadCategories } from '../utils/dataLoaders'
import type { Badge, BadgeFilters, CategoryMeta } from '../types/badge'

function useBadgeDataset() {
  const [badges, setBadges] = useState<Badge[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    loadBadges()
      .then(data => {
        if (!active) return
        setBadges(data)
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setBadges([])
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return { badges, loading }
}

function useCategoryDataset() {
  const [categories, setCategories] = useState<CategoryMeta[]>([])

  useEffect(() => {
    let active = true
    loadCategories()
      .then(data => {
        if (active) setCategories(data)
      })
      .catch(() => {
        if (active) setCategories([])
      })

    return () => {
      active = false
    }
  }, [])

  return categories
}

export function useBadges(filters: BadgeFilters = {}) {
  const { badges, loading } = useBadgeDataset()
  const results = useMemo(() => searchBadges(badges, filters), [badges, filters])
  return { badges: results, total: results.length, loading }
}

export function useBadgeBySlug(slug: string) {
  const { badges, loading } = useBadgeDataset()
  const badge = useMemo(() => {
    if (loading) return undefined
    return badges.find(b => b.slug === slug) ?? null
  }, [badges, loading, slug])

  return { badge, loading }
}

export function useCategories() {
  return useCategoryDataset()
}

export function useSubcategories(category: string): string[] {
  const { badges } = useBadgeDataset()

  return useMemo(() => {
    if (!category) return []
    const subs = badges
      .filter(b => b.category === category && b.subcategory)
      .map(b => b.subcategory as string)
    const allSubs = [...new Set(subs)]

    if (category === 'quest-completion' || category === 'collection') {
      return allSubs.filter(sub => sub !== 'Misc')
    }

    return allSubs
  }, [badges, category])
}

export function useBadgesByCategory(category: string, excludeSlug?: string, subcategory?: string) {
  const { badges } = useBadgeDataset()

  return useMemo(() => {
    const pool = badges.filter(b => b.category === category && b.slug !== excludeSlug)
    const sameSubcat = subcategory ? pool.filter(b => b.subcategory === subcategory) : []
    const others = pool.filter(b => !subcategory || b.subcategory !== subcategory)
    const shuffled = [
      ...sameSubcat.sort(() => Math.random() - 0.5),
      ...others.sort(() => Math.random() - 0.5),
    ]
    return shuffled.slice(0, 5)
  }, [badges, category, excludeSlug, subcategory])
}

export function useTotalBadgeCount() {
  const { badges } = useBadgeDataset()
  return badges.length
}
