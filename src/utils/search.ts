import type { Badge, BadgeFilters } from '../types/badge'
import { compareTitles, displayTitle } from './displayText'

export function getSearchWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .split(/\W+/)
    .filter((word) => word.length >= 2)
}

/**
 * Search badges using word-prefix matching.
 * Each word in the query must match at the START of a word in the badge's content.
 * e.g. "lock" matches "Locksmith" and "lockpick" but NOT "unlocked" or "clock"
 */
export function searchBadges(badges: Badge[], filters: BadgeFilters): Badge[] {
  const queryWords = getSearchWords(filters.query ?? '')

  return badges
    .filter((badge) => {
      // Category filter
      if (filters.category && badge.category !== filters.category) return false
      if (filters.excludeCategory === 'retired' && badge.retired) return false
      if (filters.excludeCategory && filters.excludeCategory !== 'retired') {
        if (badge.category === filters.excludeCategory) return false
      }
      // Subcategory filter
      if (filters.subcategory && badge.subcategory !== filters.subcategory) return false
      if (filters.excludeSubcategory && badge.subcategory === filters.excludeSubcategory) {
        return false
      }
      // DA Required filter
      if (filters.daRequired === true && !badge.daRequired) return false
      if (filters.daRequiredExcluded === true && badge.daRequired) return false
      // Retired filter — when not explicitly filtering for retired, hide them by default
      if (filters.retired === true && !badge.retired) return false
      if (filters.retired !== true && badge.retired) return false

      // Text search — minimum 2 characters
      if (queryWords.length > 0) {
        const searchableText = [
          badge.name,
          displayTitle(badge.name),
          badge.description,
          badge.requirements,
          ...badge.tags,
          ...badge.howToObtain.map((s) => s.instruction),
        ]
          .join(' ')
          .toLowerCase()

        // Extract individual words from the searchable text
        const contentWords = getSearchWords(searchableText)

        // Every query word must match at least one content word as a prefix
        return queryWords.every((qWord) => contentWords.some((cWord) => cWord.startsWith(qWord)))
      }

      return true
    })
    .sort((a, b) => {
      // If searching, prioritise name matches over description matches
      if (queryWords.length > 0) {
        const aNameWords = getSearchWords(displayTitle(a.name))
        const bNameWords = getSearchWords(displayTitle(b.name))
        const aNameMatch = queryWords.some((qw) => aNameWords.some((nw) => nw.startsWith(qw)))
        const bNameMatch = queryWords.some((qw) => bNameWords.some((nw) => nw.startsWith(qw)))
        if (aNameMatch && !bNameMatch) return -1
        if (!aNameMatch && bNameMatch) return 1
      }
      return compareTitles(a.name, b.name)
    })
}
