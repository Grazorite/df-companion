import type { WeaponEntry } from '../../types/weapon'
import { CardGridSkeleton } from '../shared/LoadingSkeleton'
import WeaponCard from './WeaponCard'

interface WeaponListProps {
  weapons: WeaponEntry[]
  loading?: boolean
}

export default function WeaponList({ weapons, loading = false }: WeaponListProps) {
  if (loading) {
    return (
      <CardGridSkeleton
        count={6}
        cardHeightClass="h-[120px]"
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"
      />
    )
  }

  if (weapons.length === 0) {
    return (
      <div className="bg-bg-surface border border-border-default rounded-lg p-6 text-sm text-text-secondary">
        No weapons found for the current filters yet.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {weapons.map((weapon) => (
        <WeaponCard key={weapon.slug} weapon={weapon} />
      ))}
    </div>
  )
}
