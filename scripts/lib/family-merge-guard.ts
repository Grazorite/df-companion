export interface FamilyLikeEntry {
  slug: string
  familyName?: string
  levelVariants?: unknown[]
}

export function isFamilyLikeEntry<T extends FamilyLikeEntry>(
  entry: T
): entry is T & { familyName: string; levelVariants: unknown[] } {
  return typeof entry.familyName === 'string' && Array.isArray(entry.levelVariants)
}

export function shouldPreserveFamilyForSameSlugIncoming<T extends FamilyLikeEntry>(
  existing: T,
  incomingWithSameSlug: T[],
  isFamily: (entry: T) => boolean = isFamilyLikeEntry
): boolean {
  return isFamily(existing) && incomingWithSameSlug.some((entry) => !isFamily(entry))
}

export function dedupeSameSlugPreferFamily<T extends FamilyLikeEntry>(
  entries: T[],
  isFamily: (entry: T) => boolean = isFamilyLikeEntry
): T[] {
  const bySlug = new Map<string, T>()

  for (const entry of entries) {
    const existing = bySlug.get(entry.slug)
    if (!existing) {
      bySlug.set(entry.slug, entry)
      continue
    }

    if (isFamily(existing) && !isFamily(entry)) continue
    if (!isFamily(existing) && isFamily(entry)) {
      bySlug.set(entry.slug, entry)
      continue
    }

    bySlug.set(entry.slug, entry)
  }

  return Array.from(bySlug.values())
}
