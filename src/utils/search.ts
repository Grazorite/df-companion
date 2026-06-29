import type { Badge, BadgeFilters } from '../types/badge'

export function searchBadges(badges: Badge[], filters: BadgeFilters): Badge[] {
  const query = (filters.query ?? '').toLowerCase().trim()

  return badges
    .filter((badge) => {
      // Category filter
      if (filters.category && badge.category !== filters.category) {
        return false
      }

      // Text search — minimum 2 characters
      if (query.length >= 2) {
        const searchable = [
          badge.name,
          badge.description,
          ...badge.tags,
          ...badge.howToObtain.map((s) => s.instruction),
        ]
          .join(' ')
          .toLowerCase()

        return searchable.includes(query)
      }

      return true
    })
    .sort((a, b) => {
      // If searching, prioritise name matches
      if (query.length >= 2) {
        const aNameMatch = a.name.toLowerCase().includes(query)
        const bNameMatch = b.name.toLowerCase().includes(query)
        if (aNameMatch && !bNameMatch) return -1
        if (!aNameMatch && bNameMatch) return 1
      }
      return a.name.localeCompare(b.name)
    })
}
