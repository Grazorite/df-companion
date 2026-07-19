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
import { getLevelVariantLabels, hasTitleDrivenVariantNames } from '../../utils/variantHelpers'
import type { ItemType } from '../../types/item'

interface LevelSelectorProps {
  levels: LevelVariant[]
  activeIndex: number
  onChange: (index: number) => void
  familyName?: string
  itemType?: ItemType
}

export default function LevelSelector({ levels, activeIndex, onChange, familyName, itemType }: LevelSelectorProps) {
  // Don't render if only one level
  if (levels.length <= 1) {
    return null
  }

  const hasVariantNames = levels.some(level => Boolean(level.variantName))
  const useTitleLabels = familyName ? hasTitleDrivenVariantNames(levels, familyName) : false

  const variantLabels = getLevelVariantLabels(levels, familyName, itemType)
  const getButtonLabel = (_level: LevelVariant, index: number) => variantLabels[index]
  const indexedLevels = levels.map((level, index) => ({ level, index }))
  
  const usesVariantLabels = hasVariantNames || useTitleLabels
  const useDropdown = levels.length > 12
  const activeLevel = levels[activeIndex]
  const compactButtons = levels.length > 8

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
        {usesVariantLabels ? 'Select Variant' : 'Select Level'}
      </p>

      {useDropdown ? (
        <select
          value={String(activeIndex)}
          onChange={event => onChange(Number.parseInt(event.target.value, 10))}
          className="w-full sm:max-w-sm min-h-11 rounded-lg bg-bg-surface border border-border-default px-3 py-2 text-sm font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-bg-base"
          aria-label={`Select ${usesVariantLabels ? 'variant' : 'level'}`}
        >
          {levels.map((level, index) => (
            <option key={`${level.levelNumber}-${level.name}-${index}`} value={index}>
              {getButtonLabel(level, index)}
            </option>
          ))}
        </select>
      ) : (
        <div className="-mx-4 sm:mx-0">
          <div className="px-4 sm:px-0 pb-1 flex flex-wrap gap-2">
            {indexedLevels.map(({ level, index }) => (
              <button
                key={`${level.levelNumber}-${level.name}-${index}`}
                onClick={() => onChange(index)}
                className={`
                  min-h-11 min-w-11 rounded-lg whitespace-nowrap
                  ${compactButtons ? 'px-3 py-2 text-xs' : 'px-4 py-2 text-sm'}
                  font-medium transition-all duration-200
                  ${
                    index === activeIndex
                      ? 'bg-gold text-bg-base shadow-medium'
                      : 'bg-bg-surface text-text-secondary border border-border-default hover:border-border-hover hover:text-text-primary'
                  }
                `}
                aria-pressed={index === activeIndex}
                aria-label={`Select ${usesVariantLabels ? 'variant' : 'level'} ${getButtonLabel(level, index)}`}
              >
                {getButtonLabel(level, index)}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {useDropdown && activeLevel && (
        <p className="text-xs text-text-muted">
          Showing {getButtonLabel(activeLevel, activeIndex)}
        </p>
      )}
    </div>
  )
}
