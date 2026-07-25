export function cleanNotes(notes?: string): string | undefined {
  if (!notes) return undefined

  const separator = notes.includes('\n') ? '\n' : ' • '
  const bullets = notes.split(separator)
  const cutoff = bullets.findIndex((note) => /^Thanks\s+to\b/i.test(note.trim()))
  const kept = cutoff >= 0 ? bullets.slice(0, cutoff) : bullets
  const result = kept.filter((note) => note.trim().length > 0).join(separator)

  return result || undefined
}

function splitNoteGroups(notes: string): string[] {
  const groups: string[] = []

  for (const line of notes.split('\n')) {
    if (!line.trim()) continue

    if (/^\s{2,}[•\-*]\s/.test(line) && groups.length > 0) {
      groups[groups.length - 1] += `\n${line}`
    } else {
      groups.push(line)
    }
  }

  return groups
}

function normalizeNoteGroup(group: string): string {
  return group
    .split('\n')
    .map((line) => line.trim().replace(/^(?:[•\-*]\s*)+/, ''))
    .join('\n')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function removeNoteGroups(notes: string, notesToRemove: Array<string | undefined>): string {
  const removeSet = new Set(
    notesToRemove
      .filter((note): note is string => Boolean(note))
      .flatMap(splitNoteGroups)
      .map(normalizeNoteGroup)
  )

  if (removeSet.size === 0) return notes

  return splitNoteGroups(notes)
    .filter((group) => !removeSet.has(normalizeNoteGroup(group)))
    .join('\n')
}

interface ResolveFamilyNotesOptions {
  sharedNotes?: string
  activeVariantNotes?: string
  allVariantNotes?: Array<string | undefined>
  showSharedNotes?: boolean
}

export function resolveFamilyNotes({
  sharedNotes,
  activeVariantNotes,
  allVariantNotes = [],
  showSharedNotes = true,
}: ResolveFamilyNotesOptions): { sharedNotes?: string; variantNotes?: string } {
  const cleanedSharedNotes = showSharedNotes ? cleanNotes(sharedNotes) : undefined
  const cleanedVariantNotes = cleanNotes(activeVariantNotes)
  const cleanedAllVariantNotes = allVariantNotes.map(cleanNotes)
  const prunedSharedNotes = cleanedSharedNotes
    ? cleanNotes(removeNoteGroups(cleanedSharedNotes, cleanedAllVariantNotes))
    : undefined
  const variantNotes =
    cleanedVariantNotes && cleanedVariantNotes !== prunedSharedNotes
      ? cleanedVariantNotes
      : undefined

  return {
    ...(prunedSharedNotes ? { sharedNotes: prunedSharedNotes } : {}),
    ...(variantNotes ? { variantNotes } : {}),
  }
}
