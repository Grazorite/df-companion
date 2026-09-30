import { useLocation, useSearchParams, useParams } from 'react-router-dom'
import HousingDetail from '../components/housing/HousingDetail'
import DetailPageLayout from '../components/shared/DetailPageLayout'
import { DetailPageSkeleton } from '../components/shared/LoadingSkeleton'
import { useHousingBySlug } from '../hooks/useHousing'
import { HOUSING_SUBTYPES, type HousingSubtype } from '../types/housing'
import { backUrlFromSearch } from '../utils/navigationContext'
import { DatasetErrorState } from '../components/shared/DatasetStateBoundary'

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
  const { item, loading, error, retry } = useHousingBySlug(activeSubtype, slug ?? '')
  const backUrl = backUrlFromSearch(
    location.search,
    `/housing?type=${encodeURIComponent(activeSubtype)}`
  )

  if (loading) {
    return <DetailPageSkeleton />
  }

  if (error) {
    return (
      <DetailPageLayout>
        <DatasetErrorState onRetry={retry} title="We couldn't load this housing entry" />
      </DetailPageLayout>
    )
  }

  if (!item) {
    return (
      <DetailPageLayout>
        <div className="bg-bg-surface border border-border-default rounded-lg p-6 text-text-secondary">
          Housing entry not found.
        </div>
      </DetailPageLayout>
    )
  }

  return (
    <HousingDetail
      item={item}
      subtypeLabel={subtypeMeta.label}
      backUrl={backUrl}
      filterBase={`/housing?type=${encodeURIComponent(activeSubtype)}`}
    />
  )
}
