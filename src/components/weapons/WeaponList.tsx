import { useLocation } from 'react-router-dom'
import type { WeaponEntry } from '../../types/weapon'
import { CardGridSkeleton } from '../shared/LoadingSkeleton'
import { buildWeaponCardData } from '../../hooks/useWeapons'
import { currentListUrl, detailUrlWithFrom } from '../../utils/navigationContext'
import ProgressiveCardGrid from '../shared/ProgressiveCardGrid'
import WeaponCard from './WeaponCard'

interface WeaponListProps {
  weapons: WeaponEntry[]
  loading?: boolean
}

export default function WeaponList({ weapons, loading = false }: WeaponListProps) {
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

  if (weapons.length === 0) {
    return (
      <div className="bg-bg-surface border border-border-default rounded-lg p-6 text-sm text-text-secondary">
        No weapons found for the current filters yet.
      </div>
    )
  }

  return (
    <ProgressiveCardGrid
      ariaLabel="Weapon results"
      className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"
      items={weapons}
      getKey={(weapon) => weapon.slug}
      resetKey={fromUrl}
      renderItem={(weapon) => (
        <WeaponCard
          weapon={weapon}
          toUrl={detailUrlWithFrom(buildWeaponCardData(weapon).route, fromUrl)}
        />
      )}
    />
  )
}
