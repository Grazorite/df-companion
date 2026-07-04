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
import { getLevelVariantLabel, hasTitleDrivenVariantNames, shouldUseSplitVariantRows } from '../../utils/variantHelpers'

interface LevelSelectorProps {
  levels: LevelVariant[]
  activeIndex: number
  onChange: (index: number) => void
  familyName?: string
}

export default function LevelSelector({ levels, activeIndex, onChange, familyName }: LevelSelectorProps) {
  // Don't render if only one level
  if (levels.length <= 1) {
    return null
  }

  const hasVariantNames = levels.some(level => Boolean(level.variantName))
  const useTitleLabels = familyName ? hasTitleDrivenVariantNames(levels, familyName) : false

  const getButtonLabel = (level: LevelVariant) => getLevelVariantLabel(level, familyName, useTitleLabels)
  const splitRows = shouldUseSplitVariantRows(levels)
  const nonDcLevels = levels.filter(level => !level.obtainVariants.some(variant => variant.dcRequired || variant.priceType === 'dc'))
  const dcLevels = levels.filter(level => level.obtainVariants.some(variant => variant.dcRequired || variant.priceType === 'dc'))
  const rows = splitRows ? [nonDcLevels, dcLevels] : [levels]
  
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
        {hasVariantNames ? 'Select Variant' : 'Select Level'}
      </p>
      
      {/* Horizontal scrollable pill container */}
      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <div className="px-4 sm:px-0 pb-1 space-y-2">
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className="flex gap-2 w-max min-w-full">
              {row.map((level) => {
                const index = levels.findIndex(candidate => candidate.levelNumber === level.levelNumber)
                return (
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
                    aria-label={`Select ${hasVariantNames ? 'variant' : 'level'} ${getButtonLabel(level)}`}
                  >
                    {getButtonLabel(level)}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
