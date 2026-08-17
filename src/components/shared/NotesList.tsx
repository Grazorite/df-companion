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
  subItems: NoteItem[]
  quoteItems: string[]
}

function getIndentLevel(line: string): number {
  const spaces = line.match(/^\s*/)?.[0].length ?? 0
  return Math.floor(spaces / 2)
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
    const stack: Array<{ level: number; item: NoteItem }> = []

    const addItem = (level: number, item: NoteItem) => {
      if (level === 0 || stack.length === 0) {
        items.push(item)
      } else {
        const parent = [...stack].reverse().find((entry) => entry.level < level)?.item
        if (parent) {
          parent.subItems.push(item)
        } else {
          items.push(item)
        }
      }

      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop()
      }
      stack.push({ level, item })
    }

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const level = getIndentLevel(line)

      if (/^quote:$/i.test(trimmed)) {
        if (items.length === 0) {
          items.push({ text: '', subItems: [], quoteItems: [] })
        }
        activeQuoteItem = items[items.length - 1]
        continue
      }

      if (level > 0 && /^quote:$/i.test(cleanListMarker(trimmed))) {
        if (items.length === 0) {
          items.push({ text: '', subItems: [], quoteItems: [] })
        }
        activeQuoteItem = items[items.length - 1]
        continue
      }

      if (activeQuoteItem) {
        const startsTopLevelListItem = level === 0 && /^(?:[•\-*]\s*)+/.test(trimmed)
        const continuesQuote =
          !startsTopLevelListItem &&
          (activeQuoteItem.quoteItems.length === 0 ||
            level > 0 ||
            isLikelyQuoteContinuation(trimmed, activeQuoteItem.text))
        if (continuesQuote) {
          activeQuoteItem.quoteItems.push(cleanListMarker(trimmed))
          continue
        }
        activeQuoteItem = null
      }

      addItem(level, { text: cleanListMarker(trimmed), subItems: [], quoteItems: [] })
    }
    return items.filter((item) => item.text.length > 0 || item.quoteItems.length > 0)
  }

  // Legacy flat format — all top-level, no sub-bullets
  return topLevel
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((text) => ({ text: cleanListMarker(text), subItems: [], quoteItems: [] }))
}

function renderNoteItems(items: NoteItem[], showPopups: boolean) {
  return (
    <ul className="space-y-1">
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
            <div className="ml-5 mt-1">{renderNoteItems(item.subItems, showPopups)}</div>
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

export default function NotesList({ notes, showPopups = true }: NotesListProps) {
  const items = parseNotes(notes)
  if (items.length === 0) return null

  return <div className="[&>ul]:space-y-2">{renderNoteItems(items, showPopups)}</div>
}
