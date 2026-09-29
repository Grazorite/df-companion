import { useLocation } from 'react-router-dom'
import type { Badge } from '../../types/badge'
import BadgeCard from './BadgeCard'
import { BadgeGridSkeleton } from '../shared/LoadingSkeleton'
import { currentListUrl, detailUrlWithFrom } from '../../utils/navigationContext'
import ProgressiveCardGrid from '../shared/ProgressiveCardGrid'

interface BadgeListProps {
  badges: Badge[]
  loading?: boolean
  pending?: boolean
}

export default function BadgeList({ badges, loading = false, pending = false }: BadgeListProps) {
  // Capture the current list URL so badge detail pages can link back to it exactly
  const location = useLocation()
  const fromUrl = currentListUrl(location)

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
    <ProgressiveCardGrid
      ariaLabel="Badge results"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
      items={badges}
      getKey={(badge) => badge.id}
      resetKey={fromUrl}
      pending={pending}
      renderItem={(badge) => (
        <BadgeCard badge={badge} toUrl={detailUrlWithFrom(`/badges/${badge.slug}`, fromUrl)} />
      )}
    />
  )
}
