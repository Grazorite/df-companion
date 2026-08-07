/**
 * NotesList — renders structured notes with support for sub-bullets
 *
 * Handles two formats:
 * - Legacy: notes separated by " • " (flat)
 * - New: notes separated by "\n" with sub-bullets as "\n  • " or "\n  " within a line
 *
 * Reusable across pets, badges, and future sections.
 */

import { normalizeDisplayText } from '../../utils/displayText'
import PopupText from './PopupText'

interface NotesListProps {
  notes: string
  showPopups?: boolean
}

interface NoteItem {
  text: string
  subItems: string[]
  quoteItems: string[]
}

function isIndentedSubItem(line: string): boolean {
  return /^\s+(?:[•\-*]\s*)?\S/.test(line)
}

function cleanListMarker(text: string): string {
  return text.trim().replace(/^(?:[•\-*]\s*)+/, '')
}

function isLikelyNewTopLevelNoteAfterQuote(line: string): boolean {
  return /^(?:Pet|Weapon(?:'s|s)?|Guest|Skill(?:'s)?|Special(?:'s)?|Attack|Nature Resist)\b.*\b(?:is|are|was|were|has|have|cannot|can|initially|previously|will)\b/i.test(
    line
  )
}

function isLikelyQuoteContinuation(line: string, parentText: string): boolean {
  if (/^["'*]/.test(line)) return true
  if (/\b(?:pop[- ]?up|headline|message)s?\b/i.test(parentText)) {
    return !isLikelyNewTopLevelNoteAfterQuote(line)
  }
  return /^(?:If you have|If enemy|Increases|These stack|Average damage formula:)/i.test(line)
}

function parseNotes(raw: string): NoteItem[] {
  // Split on newlines first — if there are newlines, use them as delimiters
  // Otherwise fall back to " • " as the legacy separator
  const hasNewlines = raw.includes('\n')
  const topLevel = hasNewlines
    ? raw.split('\n').filter((line) => !line.startsWith('  • '))
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

      if (isIndentedSubItem(line) && /^quote:$/i.test(cleanListMarker(trimmed))) {
        if (items.length === 0) {
          items.push({ text: '', subItems: [], quoteItems: [] })
        }
        activeQuoteItem = items[items.length - 1]
        continue
      }

      if (activeQuoteItem) {
        if (
          activeQuoteItem.quoteItems.length === 0 ||
          isIndentedSubItem(line) ||
          isLikelyQuoteContinuation(trimmed, activeQuoteItem.text)
        ) {
          activeQuoteItem.quoteItems.push(cleanListMarker(trimmed))
          continue
        }

        activeQuoteItem = null
      }

      if (isIndentedSubItem(line)) {
        // Sub-bullet — attach to previous item
        if (items.length > 0) {
          items[items.length - 1].subItems.push(cleanListMarker(trimmed))
        } else {
          items.push({ text: cleanListMarker(trimmed), subItems: [], quoteItems: [] })
        }
      } else {
        // Top-level note
        items.push({ text: cleanListMarker(trimmed), subItems: [], quoteItems: [] })
      }
    }
    return items.filter((item) => item.text.length > 0 || item.quoteItems.length > 0)
  }

  // Legacy flat format — all top-level, no sub-bullets
  return topLevel
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((text) => ({ text: cleanListMarker(text), subItems: [], quoteItems: [] }))
}

export default function NotesList({ notes, showPopups = true }: NotesListProps) {
  const items = parseNotes(notes)
  if (items.length === 0) return null

  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i}>
          {item.text && (
            <div className="flex gap-2 text-sm text-text-secondary leading-relaxed">
              <span className="text-text-muted mt-0.5 flex-shrink-0">•</span>
              <div className="min-w-0 flex-1">
                <PopupText
                  text={item.text}
                  as="span"
                  quoteClassName="mt-2"
                  showPopups={showPopups}
                />
              </div>
            </div>
          )}
          {item.subItems.length > 0 && (
            <ul className="ml-5 mt-1 space-y-1">
              {item.subItems.map((sub, j) => (
                <li key={j} className="flex gap-2 text-sm text-text-secondary leading-relaxed">
                  <span className="text-text-muted mt-0.5 flex-shrink-0">•</span>
                  <div className="min-w-0 flex-1">
                    <PopupText text={sub} as="span" quoteClassName="mt-2" showPopups={showPopups} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {item.quoteItems.length > 0 && (
            <div
              className={`${item.text ? 'ml-5 mt-2' : ''} rounded-md border border-border-default bg-bg-elevated px-3 py-2`}
            >
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
