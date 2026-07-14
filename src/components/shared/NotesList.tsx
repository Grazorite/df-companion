/**
 * NotesList — renders structured notes with support for sub-bullets
 *
 * Handles two formats:
 * - Legacy: notes separated by " • " (flat)
 * - New: notes separated by "\n" with sub-bullets as "\n  • " within a line
 *
 * Reusable across pets, badges, and future sections.
 */

import { normalizeDisplayText } from '../../utils/displayText'

interface NotesListProps {
  notes: string
}

interface NoteItem {
  text: string
  subItems: string[]
  quoteItems: string[]
}

function parseNotes(raw: string): NoteItem[] {
  // Split on newlines first — if there are newlines, use them as delimiters
  // Otherwise fall back to " • " as the legacy separator
  const hasNewlines = raw.includes('\n')
  const topLevel = hasNewlines
    ? raw.split('\n').filter(line => !line.startsWith('  • '))
    : raw.split(' • ')

  if (hasNewlines) {
    // Parse with sub-bullet and forum quote-box support
    const items: NoteItem[] = []
    const lines = raw.split('\n')
    let activeQuoteItem: NoteItem | null = null

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      if (/^quote:$/i.test(trimmed)) {
        if (items.length === 0) {
          items.push({ text: '', subItems: [], quoteItems: [] })
        }
        activeQuoteItem = items[items.length - 1]
        continue
      }

      if (activeQuoteItem) {
        if (/^\s{2,}[•\-*]\s/.test(line)) {
          activeQuoteItem.subItems.push(trimmed.replace(/^(?:[•\-*]\s*)+/, ''))
          continue
        }

        if (/^(?:[•\-*]\s+)/.test(trimmed)) {
          activeQuoteItem = null
        } else {
          activeQuoteItem.quoteItems.push(trimmed.replace(/^(?:[•\-*]\s*)+/, ''))
          continue
        }
      }

      if (/^\s{2,}[•\-*]\s/.test(line)) {
        // Sub-bullet — attach to previous item
        if (items.length > 0) {
          items[items.length - 1].subItems.push(trimmed.replace(/^(?:[•\-*]\s*)+/, ''))
        } else {
          items.push({ text: trimmed.replace(/^(?:[•\-*]\s*)+/, ''), subItems: [], quoteItems: [] })
        }
      } else {
        // Top-level note
        items.push({ text: trimmed.replace(/^(?:[•\-*]\s*)+/, ''), subItems: [], quoteItems: [] })
      }
    }
    return items.filter(item => item.text.length > 0 || item.quoteItems.length > 0)
  }

  // Legacy flat format — all top-level, no sub-bullets
  return topLevel
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(text => ({ text: text.replace(/^(?:[•\-*]\s*)+/, ''), subItems: [], quoteItems: [] }))
}

export default function NotesList({ notes }: NotesListProps) {
  const items = parseNotes(notes)
  if (items.length === 0) return null

  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i}>
          {item.text && (
            <div className="flex gap-2 text-sm text-text-secondary leading-relaxed">
              <span className="text-text-muted mt-0.5 flex-shrink-0">•</span>
              <span>{normalizeDisplayText(item.text)}</span>
            </div>
          )}
          {item.subItems.length > 0 && (
            <ul className="ml-5 mt-1 space-y-1">
              {item.subItems.map((sub, j) => (
                <li key={j} className="flex gap-2 text-sm text-text-secondary leading-relaxed">
                  <span className="text-text-muted mt-0.5 flex-shrink-0">•</span>
                  <span>{normalizeDisplayText(sub)}</span>
                </li>
              ))}
            </ul>
          )}
          {item.quoteItems.length > 0 && (
            <div className={`${item.text ? 'ml-5 mt-2' : ''} rounded-md border border-border-default bg-bg-elevated px-3 py-2`}>
              <ul className="space-y-1">
                {item.quoteItems.map((quote, j) => (
                  <li key={j} className="text-sm text-text-secondary leading-relaxed italic">
                    {normalizeDisplayText(quote)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
