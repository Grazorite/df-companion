import { useLocation } from 'react-router-dom'
import { CardGridSkeleton } from '../shared/LoadingSkeleton'
import type { HousingEntry } from '../../types/housing'
import HousingCard from './HousingCard'
import { currentListUrl, detailUrlWithFrom } from '../../utils/navigationContext'
import ProgressiveCardGrid from '../shared/ProgressiveCardGrid'

interface HousingListProps {
  housing: HousingEntry[]
  loading?: boolean
  pending?: boolean
}

export default function HousingList({ housing, loading = false, pending = false }: HousingListProps) {
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

  if (housing.length === 0) {
    return (
      <div className="bg-bg-surface border border-border-default rounded-lg p-6 text-sm text-text-secondary">
        No housing entries found for the current filters yet.
      </div>
    )
  }

  return (
    <ProgressiveCardGrid
      ariaLabel="Housing results"
      className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"
      items={housing}
      getKey={(item, index) => `${item.subtype}:${item.slug}:${index}`}
      resetKey={fromUrl}
      pending={pending}
      renderItem={(item) => (
        <HousingCard
          item={item}
          toUrl={detailUrlWithFrom(
            `/housing/${item.slug}?type=${encodeURIComponent(item.subtype)}`,
            fromUrl
          )}
        />
      )}
    />
  )
}
