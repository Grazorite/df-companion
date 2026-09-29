import { useLocation, useParams, useSearchParams } from 'react-router-dom'
import ClassAbilityDetail from '../components/classAbilities/ClassAbilityDetail'
import DetailPageLayout from '../components/shared/DetailPageLayout'
import { DetailPageSkeleton } from '../components/shared/LoadingSkeleton'
import { useClassAbilityBySlug } from '../hooks/useClassAbilities'
import { CLASS_ABILITY_SUBTYPES, type ClassAbilitySubtype } from '../types/classAbility'
import { backUrlFromSearch } from '../utils/navigationContext'

export default function ClassAbilityDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const typeParam = searchParams.get('type')
  const activeSubtype = CLASS_ABILITY_SUBTYPES.some((meta) => meta.subtype === typeParam)
    ? (typeParam as ClassAbilitySubtype)
    : 'class'
  const subtypeMeta =
    CLASS_ABILITY_SUBTYPES.find((meta) => meta.subtype === activeSubtype) ??
    CLASS_ABILITY_SUBTYPES[0]
  const { item, loading } = useClassAbilityBySlug(activeSubtype, slug ?? '')
  const backUrl = backUrlFromSearch(
    location.search,
    `/classes?type=${encodeURIComponent(activeSubtype)}`
  )

  if (loading) {
    return <DetailPageSkeleton />
  }

  if (!item) {
    return (
      <DetailPageLayout>
        <div className="bg-bg-surface border border-border-default rounded-lg p-6 text-text-secondary">
          Class or ability entry not found.
        </div>
      </DetailPageLayout>
    )
  }

  return (
    <ClassAbilityDetail
      item={item}
      subtypeLabel={subtypeMeta.label}
      backUrl={backUrl}
      filterBase={`/classes?type=${encodeURIComponent(activeSubtype)}`}
    />
  )
}
