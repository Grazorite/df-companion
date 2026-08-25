import { useEffect, useMemo, useState } from 'react'
import badgeRelationsData from '../data/badge-relations.json'
import type { Badge } from '../types/badge'
import type { BadgeRelation } from '../types/badgeRelation'
import { extractAwardedBadgeNames, normalizeBadgeLookupKey } from '../utils/badgeAwardText'
import { loadBadges } from '../utils/dataLoaders'

const badgeRelations = badgeRelationsData as BadgeRelation[]

export function useAwardedBadges(texts: Array<string | undefined | null>) {
  const [badges, setBadges] = useState<Badge[]>([])

  useEffect(() => {
    let active = true
    loadBadges()
      .then((data) => {
        if (active) setBadges(data)
      })
      .catch(() => {
        if (active) setBadges([])
      })

    return () => {
      active = false
    }
  }, [])

  const badgeNames = useMemo(() => extractAwardedBadgeNames(texts), [texts])

  return useMemo(() => {
    if (badgeNames.length === 0 || badges.length === 0) return []
    const badgeByKey = new Map(
      badges.map((badge) => [normalizeBadgeLookupKey(badge.name), badge] as const)
    )
    return badgeNames.flatMap((name) => {
      const badge = badgeByKey.get(normalizeBadgeLookupKey(name))
      return badge ? [badge] : []
    })
  }, [badgeNames, badges])
}

export function useItemsAwardingBadge(badgeSlug?: string) {
  return useMemo(
    () => badgeRelations.filter((relation) => relation.badgeSlug === badgeSlug),
    [badgeSlug]
  )
}
