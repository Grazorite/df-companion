import { useLocation } from 'react-router-dom'
import { CardGridSkeleton } from '../shared/LoadingSkeleton'
import type { ClassAbilityEntry } from '../../types/classAbility'
import ClassAbilityCard from './ClassAbilityCard'
import { currentListUrl, detailUrlWithFrom } from '../../utils/navigationContext'

interface ClassAbilityListProps {
  items: ClassAbilityEntry[]
  loading?: boolean
}

export default function ClassAbilityList({ items, loading = false }: ClassAbilityListProps) {
  const location = useLocation()
  const fromUrl = currentListUrl(location)

  if (loading) {
    return (
      <CardGridSkeleton
        count={6}
        cardHeightClass="h-[132px]"
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"
      />
    )
  }

  if (items.length === 0) {
    return (
      <div className="bg-bg-surface border border-border-default rounded-lg p-6 text-sm text-text-secondary">
        No classes or abilities found for the current filters yet.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {items.map((item) => (
        <ClassAbilityCard
          key={item.slug}
          item={item}
          toUrl={detailUrlWithFrom(
            `/classes/${item.slug}?type=${encodeURIComponent(item.subtype)}`,
            fromUrl
          )}
        />
      ))}
    </div>
  )
}
