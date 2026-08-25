/**
 * Shared forum tag-image detection.
 *
 * The DragonFable encyclopedia marks status with tag images under
 * `.../tags/<Name>.<ext>` (e.g. `.../tags/Retired.png`). L2 scraper tags should
 * be driven by these images whenever the forum provides them. Text labels are
 * only category-specific fallbacks for index pages that spell a tag out without
 * rendering its image.
 *
 * The pattern matches the tag path regardless of whether it appears in a full
 * `<img src="...">` or a bare URL (some scrapers scan pre-extracted lead HTML).
 */
export type ForumTagName =
  | 'DA'
  | 'DC'
  | 'DM'
  | 'Temp'
  | 'Rare'
  | 'Seasonal'
  | 'SpecialOffer'
  | 'WarLoot'
  | 'Retired'

export function hasForumTag(html: string, tagName: ForumTagName): boolean {
  return new RegExp(`/tags/${tagName}\\.(?:png|jpg|jpeg|gif)`, 'i').test(html)
}

export function hasRetiredTag(html: string): boolean {
  return hasForumTag(html, 'Retired')
}

export function hasRareTag(html: string): boolean {
  return hasForumTag(html, 'Rare')
}

export function hasSeasonalTag(html: string): boolean {
  return hasForumTag(html, 'Seasonal')
}

export function hasSpecialOfferTag(html: string): boolean {
  return hasForumTag(html, 'SpecialOffer')
}

export function hasWarLootTag(html: string): boolean {
  return hasForumTag(html, 'WarLoot')
}
