import { useLocation, useParams, useSearchParams } from 'react-router-dom'
import AccessoryDetail from '../components/accessories/AccessoryDetail'
import DetailPageLayout from '../components/shared/DetailPageLayout'
import { DetailPageSkeleton } from '../components/shared/LoadingSkeleton'
import { useAccessoryBySlug } from '../hooks/useAccessories'
import { ACCESSORY_SUBTYPES, type AccessorySubtype } from '../types/accessory'
import { backUrlFromSearch } from '../utils/navigationContext'
import { DatasetErrorState } from '../components/shared/DatasetStateBoundary'

export default function AccessoryDetailPage() {
  const { slug } = useParams()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const typeParam = searchParams.get('type')
  const activeSubtype = ACCESSORY_SUBTYPES.some((meta) => meta.subtype === typeParam)
    ? (typeParam as AccessorySubtype)
    : 'artifact'
  const { accessory, loading, error, retry } = useAccessoryBySlug(activeSubtype, slug)
  const filterBase = `/accessories?type=${activeSubtype}`
  const backUrl = backUrlFromSearch(location.search, filterBase)

  if (loading) {
    return <DetailPageSkeleton />
  }

  if (error) {
    return (
      <DetailPageLayout>
        <DatasetErrorState onRetry={retry} title="We couldn't load this accessory" />
      </DetailPageLayout>
    )
  }

  if (!accessory) {
    return (
      <DetailPageLayout>
        <div className="bg-bg-surface border border-border-default rounded-lg p-6 text-text-secondary">
          Accessory entry not found in the current dataset.
        </div>
      </DetailPageLayout>
    )
  }

  return <AccessoryDetail accessory={accessory} filterBase={filterBase} backUrl={backUrl} />
}
