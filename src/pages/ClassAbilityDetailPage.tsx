import { useLocation, useParams, useSearchParams } from 'react-router-dom'
import ClassAbilityDetail from '../components/classAbilities/ClassAbilityDetail'
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
    return <main className="px-4 sm:px-6 py-6 max-w-5xl mx-auto text-text-secondary">Loading...</main>
  }

  if (!item) {
    return (
      <main className="px-4 sm:px-6 py-6 max-w-5xl mx-auto">
        <div className="bg-bg-surface border border-border-default rounded-lg p-6 text-text-secondary">
          Class or ability entry not found.
        </div>
      </main>
    )
  }

  return <ClassAbilityDetail item={item} subtypeLabel={subtypeMeta.label} backUrl={backUrl} />
}
