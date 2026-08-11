import { useEffect, useMemo, useState } from 'react'
import { compareTitles } from '../utils/displayText'
import { relatedNameScore } from '../utils/relatedItems'

export interface RelatedItemRef {
  name: string
  slug: string
  type: string
  url?: string
}

export interface RelatedItemResult<T, R extends RelatedItemRef = RelatedItemRef> {
  ref?: R
  entry?: T
  relation: 'explicit' | 'same-obtain-near-name'
  scope: 'same-subtype' | 'cross-subtype'
}

interface InferredRelationContext {
  hasSharedFingerprint: boolean
  score: number
}

interface UseRelatedItemsOptions<T, R extends RelatedItemRef = RelatedItemRef> {
  item: T
  alsoSee?: R[]
  items?: T[]
  loadAll: () => Promise<T[]>
  getSlugs: (entry: T) => string[]
  getRefs: (entry: T) => R[]
  getDisplayName: (entry: T) => string
  getFingerprints: (entry: T) => Set<string>
  getScope: (entry: T) => string
  getSourceUrls?: (entry: T) => string[]
  getRefSlug?: (ref: R) => string
  matchesRef?: (entry: T, ref: R) => boolean
  refTargetsItem?: (ref: R, item: T, currentSlugs: Set<string>) => boolean
  isSameItem?: (candidate: T, item: T, currentSlugs: Set<string>) => boolean
  dedupeKey?: (entry: T, slug: string) => string
  limit?: number
  nameThreshold?: number
  inferCandidate?: (candidate: T, item: T) => boolean
  hasInferredRelation?: (candidate: T, item: T, context: InferredRelationContext) => boolean
}

function defaultMatchesRef<T extends { slug: string }, R extends RelatedItemRef>(
  entry: T,
  ref: R
): boolean {
  return entry.slug === ref.slug
}

export function useRelatedItems<
  T extends { slug: string },
  R extends RelatedItemRef = RelatedItemRef,
>({
  item,
  alsoSee = [],
  items,
  loadAll,
  getSlugs,
  getRefs,
  getDisplayName,
  getFingerprints,
  getScope,
  getSourceUrls = () => [],
  getRefSlug = (ref) => ref.slug,
  matchesRef = defaultMatchesRef,
  refTargetsItem = (ref, _item, currentSlugs) => currentSlugs.has(ref.slug),
  isSameItem = (candidate, _item, currentSlugs) =>
    getSlugs(candidate).some((slug) => currentSlugs.has(slug)),
  dedupeKey,
  limit = 8,
  nameThreshold = 0.55,
  inferCandidate,
  hasInferredRelation,
}: UseRelatedItemsOptions<T, R>) {
  const [loadedItems, setLoadedItems] = useState<T[]>([])
  const [loading, setLoading] = useState(!items)

  useEffect(() => {
    if (items) {
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    loadAll()
      .then((data) => {
        if (!active) return
        setLoadedItems(data)
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setLoadedItems([])
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [items, loadAll])

  const allItems = items ?? loadedItems

  const relatedItems = useMemo<RelatedItemResult<T, R>[]>(() => {
    const currentSlugs = new Set(getSlugs(item))
    const currentScope = getScope(item)
    const explicitSlugSet = new Set(alsoSee.map(getRefSlug))
    const resolveRef = (ref: R) => {
      const matches = allItems.filter((candidate) => matchesRef(candidate, ref))
      return (
        matches.find(
          (candidate) => ref.url && getSourceUrls(candidate).some((url) => url === ref.url)
        ) ??
        matches.find((candidate) => getScope(candidate) === currentScope) ??
        matches[0]
      )
    }

    const itemScope = (entry?: T) =>
      entry && getScope(entry) !== currentScope
        ? ('cross-subtype' as const)
        : ('same-subtype' as const)

    const explicitRelated = alsoSee.map((ref) => {
      const entry = resolveRef(ref)
      return {
        ref,
        entry,
        relation: 'explicit' as const,
        scope: itemScope(entry),
      }
    })

    const reverseExplicitRelated = allItems.flatMap((candidate) => {
      const candidateSlugs = getSlugs(candidate)
      if (isSameItem(candidate, item, currentSlugs)) return []
      if (candidateSlugs.some((slug) => explicitSlugSet.has(slug))) return []
      if (!getRefs(candidate).some((ref) => refTargetsItem(ref, item, currentSlugs))) return []

      return [
        {
          ref: undefined,
          entry: candidate,
          relation: 'explicit' as const,
          scope: itemScope(candidate),
        },
      ]
    })

    const currentFingerprints = getFingerprints(item)
    const currentName = getDisplayName(item)
    const inferredRelated = allItems
      .flatMap((candidate) => {
        if (inferCandidate && !inferCandidate(candidate, item)) return []
        const candidateSlugs = getSlugs(candidate)
        if (isSameItem(candidate, item, currentSlugs)) return []
        if (candidateSlugs.some((slug) => explicitSlugSet.has(slug))) return []

        const hasSharedObtainMethod = [...getFingerprints(candidate)].some((fingerprint) =>
          currentFingerprints.has(fingerprint)
        )

        const score = relatedNameScore(currentName, getDisplayName(candidate))
        if (score < nameThreshold) return []
        const shouldInfer = hasInferredRelation
          ? hasInferredRelation(candidate, item, {
              hasSharedFingerprint: hasSharedObtainMethod,
              score,
            })
          : hasSharedObtainMethod
        if (!shouldInfer) return []

        return [
          {
            ref: undefined,
            entry: candidate,
            relation: 'same-obtain-near-name' as const,
            scope: itemScope(candidate),
            score,
          },
        ]
      })
      .sort(
        (first, second) =>
          second.score - first.score ||
          Number(first.scope === 'cross-subtype') - Number(second.scope === 'cross-subtype') ||
          compareTitles(getDisplayName(first.entry), getDisplayName(second.entry))
      )
      .slice(0, limit)
      .map(({ score: _score, ...related }) => related)

    const seen = new Set<string>()
    return [...explicitRelated, ...reverseExplicitRelated, ...inferredRelated].filter((related) => {
      const slug = related.entry?.slug ?? related.ref?.slug
      if (!slug) return false
      const key = related.entry && dedupeKey ? dedupeKey(related.entry, slug) : slug
      if (seen.has(key)) return false
      if (related.entry && isSameItem(related.entry, item, currentSlugs)) return false
      if (!related.entry && currentSlugs.has(slug)) return false
      seen.add(key)
      return true
    })
  }, [
    allItems,
    alsoSee,
    dedupeKey,
    getDisplayName,
    getFingerprints,
    getRefSlug,
    getRefs,
    getScope,
    getSlugs,
    getSourceUrls,
    hasInferredRelation,
    inferCandidate,
    isSameItem,
    item,
    limit,
    matchesRef,
    nameThreshold,
    refTargetsItem,
  ])

  return { relatedItems, loading }
}
