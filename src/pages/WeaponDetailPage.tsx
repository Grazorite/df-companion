import { useLocation, useParams, useSearchParams } from 'react-router-dom'
import WeaponDetail from '../components/weapons/WeaponDetail'
import DetailPageLayout from '../components/shared/DetailPageLayout'
import { DetailPageSkeleton } from '../components/shared/LoadingSkeleton'
import { useWeaponBySlug } from '../hooks/useWeapons'
import { WEAPON_SUBTYPES, type WeaponSubtype } from '../types/weapon'
import { backUrlFromSearch } from '../utils/navigationContext'
import { DatasetErrorState } from '../components/shared/DatasetStateBoundary'

export default function WeaponDetailPage() {
  const { slug } = useParams()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const typeParam = searchParams.get('type')
  const activeSubtype = WEAPON_SUBTYPES.some((meta) => meta.subtype === typeParam)
    ? (typeParam as WeaponSubtype)
    : 'sword-axe-mace'
  const { weapon, loading, error, retry } = useWeaponBySlug(activeSubtype, slug)
  const filterBase = `/weapons?type=${activeSubtype}`
  const backUrl = backUrlFromSearch(location.search, filterBase)

  if (loading) return <DetailPageSkeleton />

  if (error) {
    return (
      <DetailPageLayout>
        <DatasetErrorState onRetry={retry} title="We couldn't load this weapon" />
      </DetailPageLayout>
    )
  }

  if (!weapon) {
    return (
      <DetailPageLayout>
        <div className="bg-bg-surface border border-border-default rounded-lg p-6 text-text-secondary">
          Weapon entry not found in the current dataset.
        </div>
      </DetailPageLayout>
    )
  }

  return <WeaponDetail weapon={weapon} filterBase={filterBase} backUrl={backUrl} />
}
