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
}

export default function ElementPill({ code, clickable = false, size = 'sm' }: ElementPillProps) {
  const entry = elementMap.get(code) ?? traitMap.get(code)
  const label = (entry as { shortName?: string; name?: string } | undefined)?.shortName ?? entry?.name ?? code
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
