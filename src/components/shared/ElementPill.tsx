import { Link } from 'react-router-dom'
import elementsData from '../../data/elements.json'
import type { ElementsData } from '../../types/element'

const { elements, traits } = elementsData as ElementsData

// Build lookup maps once
const elementMap = new Map(elements.map(e => [e.code, e]))
const traitMap = new Map(traits.map(t => [t.code, t]))

interface ElementPillProps {
  code: string
  /** When true, clicking links to /pets?element=CODE */
  clickable?: boolean
  size?: 'sm' | 'md'
  filterBase?: string
}

export default function ElementPill({
  code,
  clickable = false,
  size = 'sm',
  filterBase = '/pets',
}: ElementPillProps) {
  const entry = elementMap.get(code) ?? traitMap.get(code)
  const colour = entry?.colour ?? 'bg-bg-overlay text-text-muted'
  const classes = `inline-flex items-center font-medium rounded-full whitespace-nowrap ${colour} ${
    size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2.5 py-1'
  } ${clickable ? 'hover:opacity-80 transition-opacity cursor-pointer' : ''}`

  if (clickable) {
    return (
      <Link
        to={`${filterBase}?element=${encodeURIComponent(code)}`}
        className={classes}
        title={entry?.name ?? code}
        onClick={e => e.stopPropagation()}
      >
        {code}
      </Link>
    )
  }

  return (
    <span className={classes} title={entry?.name ?? code}>
      {code}
    </span>
  )
}
