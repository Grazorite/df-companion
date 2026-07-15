import type { AccessoryEntry } from '../../types/accessory'
import AccessoryCard from './AccessoryCard'

interface AccessoryListProps {
  accessories: AccessoryEntry[]
}

export default function AccessoryList({ accessories }: AccessoryListProps) {
  if (accessories.length === 0) {
    return (
      <div className="bg-bg-surface border border-border-default rounded-lg p-6 text-sm text-text-secondary">
        No accessories found for the current filters yet.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {accessories.map(accessory => (
        <AccessoryCard key={accessory.slug} accessory={accessory} />
      ))}
    </div>
  )
}
