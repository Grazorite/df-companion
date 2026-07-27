/**
 * Shared forum tag-image detection.
 *
 * The DragonFable encyclopedia marks status with tag images under
 * `.../tags/<Name>.<ext>` (e.g. `.../tags/Retired.png`). Detecting the Retired
 * tag was previously duplicated across every scraper with slightly different
 * regexes; this centralizes it so retired detection stays consistent.
 *
 * The pattern matches the tag path regardless of whether it appears in a full
 * `<img src="...">` or a bare URL (some scrapers scan pre-extracted lead HTML).
 */
export function hasRetiredTag(html: string): boolean {
  return /\/tags\/Retired\.(?:png|jpg|jpeg|gif)/i.test(html)
}
