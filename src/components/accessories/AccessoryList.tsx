import { useLocation } from 'react-router-dom'
import type { AccessoryEntry } from '../../types/accessory'
import AccessoryCard from './AccessoryCard'
import { CardGridSkeleton } from '../shared/LoadingSkeleton'
import { buildAccessoryCardData } from '../../hooks/useAccessories'
import { currentListUrl, detailUrlWithFrom } from '../../utils/navigationContext'
import ProgressiveCardGrid from '../shared/ProgressiveCardGrid'

interface AccessoryListProps {
  accessories: AccessoryEntry[]
  loading?: boolean
}

export default function AccessoryList({ accessories, loading = false }: AccessoryListProps) {
  const location = useLocation()
  const fromUrl = currentListUrl(location)

  if (loading) {
    return (
      <CardGridSkeleton
        count={6}
        cardHeightClass="h-[120px]"
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"
      />
    )
  }

  if (accessories.length === 0) {
    return (
      <div className="bg-bg-surface border border-border-default rounded-lg p-6 text-sm text-text-secondary">
        No accessories found for the current filters yet.
      </div>
    )
  }

  return (
    <ProgressiveCardGrid
      ariaLabel="Accessory results"
      className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"
      items={accessories}
      getKey={(accessory) => accessory.slug}
      resetKey={fromUrl}
      renderItem={(accessory) => (
        <AccessoryCard
          accessory={accessory}
          toUrl={detailUrlWithFrom(buildAccessoryCardData(accessory).route, fromUrl)}
        />
      )}
    />
  )
}
