import { useParams, useSearchParams } from 'react-router-dom'
import WeaponDetail from '../components/weapons/WeaponDetail'
import { DetailPageSkeleton } from '../components/shared/LoadingSkeleton'
import { useWeaponBySlug } from '../hooks/useWeapons'
import { WEAPON_SUBTYPES, type WeaponSubtype } from '../types/weapon'

export default function WeaponDetailPage() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  const typeParam = searchParams.get('type')
  const activeSubtype = WEAPON_SUBTYPES.some((meta) => meta.subtype === typeParam)
    ? (typeParam as WeaponSubtype)
    : 'sword-axe-mace'
  const { weapon, loading } = useWeaponBySlug(activeSubtype, slug)

  if (loading) return <DetailPageSkeleton />

  if (!weapon) {
    return (
      <main className="px-4 sm:px-6 py-8 max-w-3xl mx-auto">
        <div className="bg-bg-surface border border-border-default rounded-lg p-6 text-text-secondary">
          Weapon entry not found in the current dataset.
        </div>
      </main>
    )
  }

  return <WeaponDetail weapon={weapon} filterBase={`/weapons?type=${activeSubtype}`} />
}
