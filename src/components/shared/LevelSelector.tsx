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
import { chunkVariantRows, getLevelVariantLabel, hasTitleDrivenVariantNames, shouldUseSplitVariantRows } from '../../utils/variantHelpers'
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
  const levelKeys = levels.map(level => String(level.actualLevel ?? level.levelDisplay))
  const hasDuplicateLevels = new Set(levelKeys).size !== levelKeys.length

  const getButtonLabel = (level: LevelVariant) => getLevelVariantLabel(level, familyName, useTitleLabels, itemType)
  const splitRows = shouldUseSplitVariantRows(levels)
  const indexedLevels = levels.map((level, index) => ({ level, index }))
  const daLevels = indexedLevels.filter(({ level }) => level.obtainVariants.some(variant => variant.daRequired))
  const nonDaLevels = indexedLevels.filter(({ level }) => !level.obtainVariants.some(variant => variant.daRequired))
  const nonDcLevels = indexedLevels.filter(({ level }) => !level.obtainVariants.some(variant => variant.dcRequired || variant.priceType === 'dc'))
  const dcLevels = indexedLevels.filter(({ level }) => level.obtainVariants.some(variant => variant.dcRequired || variant.priceType === 'dc'))
  const shouldSplitDaRows = hasDuplicateLevels && indexedLevels.length >= 8 && daLevels.length > 0 && nonDaLevels.length > 0
  const groupedRows = shouldSplitDaRows
    ? [nonDaLevels, daLevels]
    : splitRows
      ? [nonDcLevels, dcLevels]
      : [indexedLevels]
  const rows = groupedRows.flatMap(row => chunkVariantRows(row))
  
  const usesVariantLabels = hasVariantNames || useTitleLabels

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
        {usesVariantLabels ? 'Select Variant' : 'Select Level'}
      </p>
      
      <div className="-mx-4 sm:mx-0">
        <div className="px-4 sm:px-0 pb-1 space-y-2">
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className="flex flex-wrap gap-2">
              {row.map(({ level, index }) => {
                return (
                  <button
                    key={`${level.levelNumber}-${level.name}-${index}`}
                    onClick={() => onChange(index)}
                    className={`
                      min-h-11 min-w-11 px-4 py-2 rounded-lg whitespace-nowrap
                      text-sm font-medium transition-all duration-200
                      ${
                        index === activeIndex
                          ? 'bg-gold text-bg-base shadow-medium'
                          : 'bg-bg-surface text-text-secondary border border-border-default hover:border-border-hover hover:text-text-primary'
                      }
                    `}
                    aria-pressed={index === activeIndex}
                    aria-label={`Select ${usesVariantLabels ? 'variant' : 'level'} ${getButtonLabel(level)}`}
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
