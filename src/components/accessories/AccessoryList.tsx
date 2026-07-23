import type { AccessoryEntry } from '../../types/accessory'
import AccessoryCard from './AccessoryCard'
import { CardGridSkeleton } from '../shared/LoadingSkeleton'

interface AccessoryListProps {
  accessories: AccessoryEntry[]
  loading?: boolean
}

export default function AccessoryList({ accessories, loading = false }: AccessoryListProps) {
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
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {accessories.map((accessory) => (
        <AccessoryCard key={accessory.slug} accessory={accessory} />
      ))}
    </div>
  )
}
