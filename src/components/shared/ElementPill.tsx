import { Link } from 'react-router-dom'
import elementsData from '../../data/elements.json'
import type { ElementsData } from '../../types/element'

const { elements, markers } = elementsData as ElementsData

// Build lookup maps once
const elementMap = new Map(elements.map(e => [e.code, e]))
const markerMap = new Map(markers.map(m => [m.code, m]))

interface ElementPillProps {
  code: string
  /** When true, clicking links to /pets?element=CODE */
  clickable?: boolean
  size?: 'sm' | 'md'
}

export default function ElementPill({ code, clickable = false, size = 'sm' }: ElementPillProps) {
  const entry = elementMap.get(code) ?? markerMap.get(code)
  const label = entry?.shortName ?? code
  const colour = entry?.colour ?? 'bg-bg-overlay text-text-muted'
  const classes = `inline-flex items-center font-medium rounded-full whitespace-nowrap ${colour} ${
    size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2.5 py-1'
  } ${clickable ? 'hover:opacity-80 transition-opacity cursor-pointer' : ''}`

  if (clickable) {
    return (
      <Link
        to={`/pets?element=${encodeURIComponent(code)}`}
        className={classes}
        title={entry?.name ?? code}
        onClick={e => e.stopPropagation()}
      >
        {label}
      </Link>
    )
  }

  return (
    <span className={classes} title={entry?.name ?? code}>
      {label}
    </span>
  )
}
