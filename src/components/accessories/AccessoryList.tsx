import { useLocation } from 'react-router-dom'
import type { AccessoryEntry } from '../../types/accessory'
import AccessoryCard from './AccessoryCard'
import { CardGridSkeleton } from '../shared/LoadingSkeleton'
import { buildAccessoryCardData } from '../../hooks/useAccessories'
import { currentListUrl, detailUrlWithFrom } from '../../utils/navigationContext'
import ProgressiveCardGrid from '../shared/ProgressiveCardGrid'
import DatasetStateBoundary from '../shared/DatasetStateBoundary'

interface AccessoryListProps {
  accessories: AccessoryEntry[]
  loading?: boolean
  pending?: boolean
  error?: Error | null
  onRetry?: () => void
}

export default function AccessoryList({
  accessories,
  loading = false,
  pending = false,
  error = null,
  onRetry = () => undefined,
}: AccessoryListProps) {
  const location = useLocation()
  const fromUrl = currentListUrl(location)

  return (
    <DatasetStateBoundary
      loading={loading}
      loadingFallback={
        <CardGridSkeleton
          count={6}
          cardHeightClass="h-[120px]"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"
        />
      }
      error={error}
      onRetry={onRetry}
      empty={accessories.length === 0}
      emptyFallback={
        <div className="bg-bg-surface border border-border-default rounded-lg p-6 text-sm text-text-secondary">
          No accessories found for the current filters yet.
        </div>
      }
    >
      <ProgressiveCardGrid
        ariaLabel="Accessory results"
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"
        items={accessories}
        getKey={(accessory) => accessory.slug}
        resetKey={fromUrl}
        pending={pending}
        renderItem={(accessory) => (
          <AccessoryCard
            accessory={accessory}
            toUrl={detailUrlWithFrom(buildAccessoryCardData(accessory).route, fromUrl)}
          />
        )}
      />
    </DatasetStateBoundary>
  )
}
