const INVISIBLE_ITEM_NOTE_PATTERNS = [
  /\b(?:weapon|weapons|item|items|cape|capes|helm|helms)\s+(?:is|are)\s+not\s+visible\b/i,
  /\b(?:weapon|weapons|item|items|cape|capes|helm|helms)\s+(?:is|are)\s+invisible\b/i,
  /\b(?:weapon|weapons|item|items|cape|capes|helm|helms)\s+(?:appears?|appear)\s+invisible\b/i,
]

export function notesIndicateInvisibleItem(...notes: Array<string | undefined>): boolean {
  return notes.some((note) =>
    INVISIBLE_ITEM_NOTE_PATTERNS.some((pattern) => (note ? pattern.test(note) : false))
  )
}
