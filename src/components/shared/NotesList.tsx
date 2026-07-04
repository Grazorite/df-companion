/**
 * NotesList — renders structured notes with support for sub-bullets
 *
 * Handles two formats:
 * - Legacy: notes separated by " • " (flat)
 * - New: notes separated by "\n" with sub-bullets as "\n  • " within a line
 *
 * Reusable across pets, badges, and future sections.
 */

interface NotesListProps {
  notes: string
}

interface NoteItem {
  text: string
  subItems: string[]
}

function parseNotes(raw: string): NoteItem[] {
  // Split on newlines first — if there are newlines, use them as delimiters
  // Otherwise fall back to " • " as the legacy separator
  const hasNewlines = raw.includes('\n')
  const topLevel = hasNewlines
    ? raw.split('\n').filter(line => !line.startsWith('  • '))
    : raw.split(' • ')

  if (hasNewlines) {
    // Parse with sub-bullet support
    const items: NoteItem[] = []
    const lines = raw.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      if (/^\s{2,}[•\-*]\s/.test(line)) {
        // Sub-bullet — attach to previous item
        if (items.length > 0) {
          items[items.length - 1].subItems.push(trimmed.replace(/^(?:[•\-*]\s*)+/, ''))
        } else {
          items.push({ text: trimmed.replace(/^(?:[•\-*]\s*)+/, ''), subItems: [] })
        }
      } else {
        // Top-level note
        items.push({ text: trimmed.replace(/^(?:[•\-*]\s*)+/, ''), subItems: [] })
      }
    }
    return items.filter(item => item.text.length > 0)
  }

  // Legacy flat format — all top-level, no sub-bullets
  return topLevel
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(text => ({ text: text.replace(/^(?:[•\-*]\s*)+/, ''), subItems: [] }))
}

export default function NotesList({ notes }: NotesListProps) {
  const items = parseNotes(notes)
  if (items.length === 0) return null

  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i}>
          <div className="flex gap-2 text-sm text-text-secondary leading-relaxed">
            <span className="text-text-muted mt-0.5 flex-shrink-0">•</span>
            <span>{item.text}</span>
          </div>
          {item.subItems.length > 0 && (
            <ul className="ml-5 mt-1 space-y-1">
              {item.subItems.map((sub, j) => (
                <li key={j} className="flex gap-2 text-sm text-text-secondary leading-relaxed">
                  <span className="text-text-muted mt-0.5 flex-shrink-0">•</span>
                  <span>{sub}</span>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  )
}
