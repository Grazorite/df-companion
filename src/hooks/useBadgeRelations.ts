import { useMemo } from 'react'
import badgeRelationsData from '../data/badge-relations.json'
import type { BadgeRelation } from '../types/badgeRelation'
import type { InlineTextLink } from '../types/inlineLink'

const badgeRelations = badgeRelationsData as BadgeRelation[]

function dedupeInlineLinks(links: InlineTextLink[]): InlineTextLink[] {
  const seen = new Set<string>()
  return links.filter((link) => {
    const key = `${link.text.toLowerCase()}|${link.to}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function itemLinkAliases(relation: BadgeRelation): string[] {
  const names = [relation.itemName, ...(relation.itemAliases ?? [])]
  const parenthetical = relation.itemName.match(/^(.+?)\s*\(([^)]+)\)$/)
  if (parenthetical) {
    const baseName = parenthetical[1]?.trim()
    const variants = parenthetical[2]
      ?.split(/\s*,\s*/)
      .map((variant) => variant.trim())
      .filter(Boolean)

    if (baseName && variants) {
      names.push(...variants.map((variant) => `${baseName} ${variant}`))
    }
  }

  if (relation.categoryLabel === 'Armor' && !/\bArmor$/i.test(relation.itemName)) {
    names.push(`${relation.itemName} Armor`)
  }

  return [...new Set(names)]
}

export function useBadgeInlineLinksForItem(itemSlug?: string): InlineTextLink[] {
  return useMemo(() => {
    if (!itemSlug) return []
    return dedupeInlineLinks(
      badgeRelations
        .filter((relation) => relation.itemSlug === itemSlug)
        .map((relation) => ({
          text: relation.badgeName,
          to: `/badges/${relation.badgeSlug}`,
        }))
    )
  }, [itemSlug])
}

export function useAwardingItemInlineLinksForBadge(badgeSlug?: string): InlineTextLink[] {
  return useMemo(() => {
    if (!badgeSlug) return []
    return dedupeInlineLinks(
      badgeRelations
        .filter((relation) => relation.badgeSlug === badgeSlug)
        .flatMap((relation) =>
          itemLinkAliases(relation).map((text) => ({
            text,
            to: relation.route,
          }))
        )
    )
  }, [badgeSlug])
}
