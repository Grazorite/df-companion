import { Minus } from 'lucide-react'
import type { FilterState } from '../../utils/triStateFilters'

interface TriStateFilterPillProps {
  label: string
  state: FilterState
  onClick: () => void
  size?: 'segment' | 'access' | 'category' | 'element'
  activeClassName?: string
  inactiveClassName?: string
  elementClassName?: string
  disabled?: boolean
}

const SIZE_CLASSES = {
  segment: 'px-3 py-1.5 text-xs min-h-11 sm:min-h-9',
  access: 'px-3 py-1.5 text-xs min-h-11 sm:min-h-9',
  category: 'px-2.5 py-1 text-[11px] min-h-11 sm:min-h-0',
  element: 'px-1.5 py-0.5 text-[10px] min-h-11 sm:min-h-0',
}

export default function TriStateFilterPill({
  label,
  state,
  onClick,
  size = 'category',
  activeClassName = 'bg-gold-bright text-bg-base',
  inactiveClassName = 'bg-bg-overlay text-text-secondary hover:bg-border-hover hover:text-text-primary',
  elementClassName,
  disabled = false,
}: TriStateFilterPillProps) {
  const isExcluded = state === 'exclude'
  const includeClassName = (() => {
    if (size !== 'access' || activeClassName !== 'bg-gold-bright text-bg-base') {
      return activeClassName
    }
    if (label === 'DC') return 'bg-amber-500/20 text-gold'
    if (label === 'DM') return 'bg-slate-500/20 text-slate-300'
    return activeClassName
  })()
  const className =
    state === 'include'
      ? (elementClassName ?? includeClassName)
      : isExcluded
        ? 'bg-red-950/70 text-red-200 border border-red-700/70'
        : inactiveClassName

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={state !== 'neutral'}
      aria-label={
        state === 'include'
          ? `${label}: included. Click to exclude.`
          : state === 'exclude'
            ? `${label}: excluded. Click to clear.`
            : `${label}: no filter. Click to include.`
      }
      title={
        state === 'include'
          ? 'Included; click to exclude'
          : state === 'exclude'
            ? 'Excluded; click to clear'
            : 'Click to include'
      }
      className={`inline-flex items-center gap-1 rounded-full font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 ${
        SIZE_CLASSES[size]
      } ${className} ${state === 'include' ? 'font-semibold' : ''} ${
        disabled ? 'opacity-40 cursor-not-allowed' : ''
      }`}
    >
      {isExcluded && <Minus className="w-3 h-3" aria-hidden="true" />}
      {label}
    </button>
  )
}
