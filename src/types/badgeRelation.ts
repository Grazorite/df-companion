import type { ItemType } from './item'

export interface BadgeRelation {
  badgeName: string
  badgeSlug: string
  itemName: string
  itemSlug: string
  itemType: ItemType
  categoryLabel: string
  route: string
}
