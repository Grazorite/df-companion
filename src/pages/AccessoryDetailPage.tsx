import { useParams, useSearchParams } from 'react-router-dom'
import AccessoryDetail from '../components/accessories/AccessoryDetail'
import { DetailPageSkeleton } from '../components/shared/LoadingSkeleton'
import { useAccessoryBySlug } from '../hooks/useAccessories'
import { ACCESSORY_SUBTYPES, type AccessorySubtype } from '../types/accessory'

export default function AccessoryDetailPage() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  const typeParam = searchParams.get('type')
  const activeSubtype = ACCESSORY_SUBTYPES.some((meta) => meta.subtype === typeParam)
    ? (typeParam as AccessorySubtype)
    : 'artifact'
  const { accessory, loading } = useAccessoryBySlug(activeSubtype, slug)

  if (loading) {
    return <DetailPageSkeleton />
  }

  if (!accessory) {
    return (
      <main className="px-4 sm:px-6 py-8 max-w-3xl mx-auto">
        <div className="bg-bg-surface border border-border-default rounded-lg p-6 text-text-secondary">
          Accessory entry not found in the current dataset.
        </div>
      </main>
    )
  }

  return <AccessoryDetail accessory={accessory} filterBase="/accessories" />
}
