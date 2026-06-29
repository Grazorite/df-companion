import type { Badge, BadgeFilters } from '../types/badge'

/**
 * Search badges using word-prefix matching.
 * Each word in the query must match at the START of a word in the badge's content.
 * e.g. "lock" matches "Locksmith" and "lockpick" but NOT "unlocked" or "clock"
 */
export function searchBadges(badges: Badge[], filters: BadgeFilters): Badge[] {
  const query = (filters.query ?? '').toLowerCase().trim()
  const queryWords = query.split(/\s+/).filter((w) => w.length >= 2)

  return badges
    .filter((badge) => {
      // Category filter
      if (filters.category && badge.category !== filters.category) {
        return false
      }

      // Text search — minimum 2 characters
      if (queryWords.length > 0) {
        const searchableText = [
          badge.name,
          badge.description,
          badge.requirements,
          ...badge.tags,
          ...badge.howToObtain.map((s) => s.instruction),
        ]
          .join(' ')
          .toLowerCase()

        // Extract individual words from the searchable text
        const contentWords = searchableText.split(/\W+/)

        // Every query word must match at least one content word as a prefix
        return queryWords.every((qWord) =>
          contentWords.some((cWord) => cWord.startsWith(qWord))
        )
      }

      return true
    })
    .sort((a, b) => {
      // If searching, prioritise name matches over description matches
      if (queryWords.length > 0) {
        const aNameWords = a.name.toLowerCase().split(/\W+/)
        const bNameWords = b.name.toLowerCase().split(/\W+/)
        const aNameMatch = queryWords.some((qw) => aNameWords.some((nw) => nw.startsWith(qw)))
        const bNameMatch = queryWords.some((qw) => bNameWords.some((nw) => nw.startsWith(qw)))
        if (aNameMatch && !bNameMatch) return -1
        if (!aNameMatch && bNameMatch) return 1
      }
      return a.name.localeCompare(b.name)
    })
}
