import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { InlineTextLink } from '../../types/inlineLink'
import { normalizeDisplayText } from '../../utils/displayText'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function uniqueLinks(links: InlineTextLink[]): InlineTextLink[] {
  const seen = new Set<string>()
  return links
    .map((link) => ({ text: normalizeDisplayText(link.text).trim(), to: link.to }))
    .filter((link) => {
      if (!link.text || !link.to) return false
      const key = `${link.text.toLowerCase()}|${link.to}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((first, second) => second.text.length - first.text.length)
}

export default function InlineTextLinks({
  text,
  links = [],
}: {
  text: string
  links?: InlineTextLink[]
}) {
  const displayText = normalizeDisplayText(text)
  const candidates = uniqueLinks(links)
  if (candidates.length === 0) return <>{displayText}</>

  const nodes: ReactNode[] = []
  let cursor = 0

  while (cursor < displayText.length) {
    let bestMatch:
      | {
          index: number
          length: number
          link: InlineTextLink
          value: string
        }
      | undefined

    for (const link of candidates) {
      const pattern = new RegExp(escapeRegExp(link.text), 'i')
      const match = pattern.exec(displayText.slice(cursor))
      if (!match || match.index < 0) continue
      const index = cursor + match.index
      const value = match[0] ?? link.text
      if (!bestMatch || index < bestMatch.index || (index === bestMatch.index && value.length > bestMatch.length)) {
        bestMatch = { index, length: value.length, link, value }
      }
    }

    if (!bestMatch) {
      nodes.push(displayText.slice(cursor))
      break
    }

    if (bestMatch.index > cursor) {
      nodes.push(displayText.slice(cursor, bestMatch.index))
    }

    nodes.push(
      <Link
        key={`${bestMatch.link.to}-${bestMatch.index}-${bestMatch.value}`}
        to={bestMatch.link.to}
        className="text-gold underline underline-offset-2 hover:text-gold-bright transition-colors"
      >
        {bestMatch.value}
      </Link>
    )
    cursor = bestMatch.index + bestMatch.length
  }

  return <>{nodes}</>
}
