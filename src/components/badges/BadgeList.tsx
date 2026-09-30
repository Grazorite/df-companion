import { useLocation } from 'react-router-dom'
import type { Badge } from '../../types/badge'
import BadgeCard from './BadgeCard'
import { BadgeGridSkeleton } from '../shared/LoadingSkeleton'
import { currentListUrl, detailUrlWithFrom } from '../../utils/navigationContext'
import ProgressiveCardGrid from '../shared/ProgressiveCardGrid'
import DatasetStateBoundary from '../shared/DatasetStateBoundary'

interface BadgeListProps {
  badges: Badge[]
  loading?: boolean
  pending?: boolean
  error?: Error | null
  onRetry?: () => void
}

export default function BadgeList({
  badges,
  loading = false,
  pending = false,
  error = null,
  onRetry = () => undefined,
}: BadgeListProps) {
  // Capture the current list URL so badge detail pages can link back to it exactly
  const location = useLocation()
  const fromUrl = currentListUrl(location)

  return (
    <DatasetStateBoundary
      loading={loading}
      loadingFallback={<BadgeGridSkeleton count={6} />}
      error={error}
      onRetry={onRetry}
      empty={badges.length === 0}
      emptyFallback={
        <div className="text-center py-16 text-text-secondary">
          <p className="text-base font-medium mb-1">No badges found</p>
          <p className="text-sm text-text-muted">Try adjusting your search or clearing filters</p>
        </div>
      }
    >
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
    </DatasetStateBoundary>
  )
}
