import type { ItemType } from './item'

export interface BadgeRelation {
  badgeName: string
  badgeSlug: string
  itemName: string
  itemAliases?: string[]
  itemSlug: string
  itemType: ItemType
  categoryLabel: string
  route: string
}
