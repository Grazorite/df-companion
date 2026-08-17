import { useLocation, useSearchParams, useParams } from 'react-router-dom'
import HousingDetail from '../components/housing/HousingDetail'
import { useHousingBySlug } from '../hooks/useHousing'
import { HOUSING_SUBTYPES, type HousingSubtype } from '../types/housing'
import { backUrlFromSearch } from '../utils/navigationContext'

export default function HousingDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const typeParam = searchParams.get('type')
  const activeSubtype = HOUSING_SUBTYPES.some((meta) => meta.subtype === typeParam)
    ? (typeParam as HousingSubtype)
    : 'house'
  const subtypeMeta =
    HOUSING_SUBTYPES.find((meta) => meta.subtype === activeSubtype) ?? HOUSING_SUBTYPES[0]
  const { item, loading } = useHousingBySlug(activeSubtype, slug ?? '')
  const backUrl = backUrlFromSearch(
    location.search,
    `/housing?type=${encodeURIComponent(activeSubtype)}`
  )

  if (loading) {
    return <main className="px-4 sm:px-6 py-6 max-w-5xl mx-auto text-text-secondary">Loading...</main>
  }

  if (!item) {
    return (
      <main className="px-4 sm:px-6 py-6 max-w-5xl mx-auto">
        <div className="bg-bg-surface border border-border-default rounded-lg p-6 text-text-secondary">
          Housing entry not found.
        </div>
      </main>
    )
  }

  return <HousingDetail item={item} subtypeLabel={subtypeMeta.label} backUrl={backUrl} />
}
