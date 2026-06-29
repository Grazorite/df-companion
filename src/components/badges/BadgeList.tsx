import { useLocation } from 'react-router-dom'
import type { Badge } from '../../types/badge'
import BadgeCard from './BadgeCard'
import { BadgeGridSkeleton } from '../shared/LoadingSkeleton'

interface BadgeListProps {
  badges: Badge[]
  loading?: boolean
}

export default function BadgeList({ badges, loading = false }: BadgeListProps) {
  // Capture the current list URL so badge detail pages can link back to it exactly
  const location = useLocation()
  const fromUrl = location.pathname + location.search

  if (loading) {
    return <BadgeGridSkeleton count={6} />
  }

  if (badges.length === 0) {
    return (
      <div className="text-center py-16 text-text-secondary">
        <p className="text-base font-medium mb-1">No badges found</p>
        <p className="text-sm text-text-muted">Try adjusting your search or clearing filters</p>
      </div>
    )
  }

  return (
    <ul
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
      aria-label="Badge results"
    >
      {badges.map((badge) => (
        <li key={badge.id}>
          <BadgeCard
            badge={badge}
            toUrl={`/badges/${badge.slug}?from=${encodeURIComponent(fromUrl)}`}
          />
        </li>
      ))}
    </ul>
  )
}
