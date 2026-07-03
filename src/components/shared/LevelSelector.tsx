/**
 * LevelSelector Component
 * 
 * Horizontal pill buttons for selecting which level to view in detail sections.
 * Used when obtain methods or attacks vary by level.
 * 
 * Features:
 * - Pill buttons [I] [II] [III▼] for each level
 * - Active level has gold highlight
 * - Horizontal scroll on mobile
 * - Minimum 44px touch targets
 * - Only renders when levels.length > 1
 * 
 * Example: Goldfish Knight level selector with 7 buttons (I through VII)
 */

import type { LevelVariant } from '../../types/item'

interface LevelSelectorProps {
  levels: LevelVariant[]
  activeIndex: number
  onChange: (index: number) => void
}

export default function LevelSelector({ levels, activeIndex, onChange }: LevelSelectorProps) {
  // Don't render if only one level
  if (levels.length <= 1) {
    return null
  }
  
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
        Select Level
      </p>
      
      {/* Horizontal scrollable pill container */}
      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <div className="flex gap-2 px-4 sm:px-0 pb-1">
          {levels.map((level, index) => (
            <button
              key={level.levelNumber}
              onClick={() => onChange(index)}
              className={`
                flex-shrink-0 min-h-11 min-w-11 px-4 py-2 rounded-lg
                text-sm font-medium transition-all duration-200
                ${
                  index === activeIndex
                    ? 'bg-gold text-bg-base shadow-medium'
                    : 'bg-bg-surface text-text-secondary border border-border-default hover:border-border-hover hover:text-text-primary'
                }
              `}
              aria-pressed={index === activeIndex}
              aria-label={`Select level ${level.levelDisplay}`}
            >
              {level.levelDisplay}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
