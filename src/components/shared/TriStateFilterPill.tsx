import { Minus } from 'lucide-react'
import type { FilterState } from '../../utils/triStateFilters'

interface TriStateFilterPillProps {
  label: string
  state: FilterState
  onClick: () => void
  size?: 'access' | 'category' | 'element'
  activeClassName?: string
  inactiveClassName?: string
  elementClassName?: string
  disabled?: boolean
}

const SIZE_CLASSES = {
  access: 'px-3 py-1.5 text-xs min-h-[36px]',
  category: 'px-2.5 py-1 text-[11px]',
  element: 'px-1.5 py-0.5 text-[10px]',
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
  const includeClassName =
    size === 'access' && label === 'DC' && activeClassName === 'bg-gold-bright text-bg-base'
      ? 'bg-amber-500/20 text-gold'
      : activeClassName
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
      className={`inline-flex items-center gap-1 rounded-full font-medium transition-colors duration-150 ${
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
