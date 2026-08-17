import { useLocation } from 'react-router-dom'
import { CardGridSkeleton } from '../shared/LoadingSkeleton'
import type { HousingEntry } from '../../types/housing'
import HousingCard from './HousingCard'
import { currentListUrl, detailUrlWithFrom } from '../../utils/navigationContext'

interface HousingListProps {
  housing: HousingEntry[]
  loading?: boolean
}

export default function HousingList({ housing, loading = false }: HousingListProps) {
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
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {housing.map((item) => (
        <HousingCard
          key={item.slug}
          item={item}
          toUrl={detailUrlWithFrom(`/housing/${item.slug}?type=${encodeURIComponent(item.subtype)}`, fromUrl)}
        />
      ))}
    </div>
  )
}
