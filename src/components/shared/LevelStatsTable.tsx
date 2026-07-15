/**
 * LevelStatsTable Component
 * 
 * Displays a compact table showing stats for all level variants of an item.
 * 
 * Columns:
 * - Variant: Roman numeral (I, II, III, etc.) - hidden for "All Versions" items
 * - Level: Actual game level (10, 20, 30, etc.)
 * - Damage: Damage range
 * - Stats: Stat bonuses (header varies: "Pet's Stats" or "Bonuses")
 * - DA: Badge image if ANY obtain variant requires DA
 * - DC: Badge image if ANY obtain variant requires DC
 */

import type { LevelVariant } from '../../types/item'
import { getLevelVariantLabel, hasTitleDrivenVariantNames, shouldHideVariantColumn } from '../../utils/variantHelpers'

interface LevelStatsTableProps {
  levels: LevelVariant[]
  /** Hide the Variant column (for "All Versions" pets with no roman numerals) */
  hideVariantColumn?: boolean
  familyName?: string
}

export default function LevelStatsTable({ levels, hideVariantColumn = false, familyName }: LevelStatsTableProps) {
  const hasVariantNames = levels.some(level => Boolean(level.variantName))
  const useTitleLabels = familyName ? hasTitleDrivenVariantNames(levels, familyName) : false
  const variantLabels = levels.map(level => getLevelVariantLabel(level, familyName, useTitleLabels))
  const hasRedundantVariantColumn = shouldHideVariantColumn(levels, familyName)
  const showVariantColumn = !hasRedundantVariantColumn && (!hideVariantColumn || hasVariantNames || useTitleLabels)

  // Determine the correct stats column header based on statsType
  const statsHeader = levels.find(lv => lv.statsType === 'bonuses') 
    ? 'Bonuses' 
    : levels.find(lv => lv.statsType === 'petStats')
      ? "Pet's Stats"
      : 'Stats'
  
  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <div className="inline-block min-w-full align-middle px-4 sm:px-0">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="border-b border-border-default">
                {showVariantColumn && (
                  <th className="sticky left-0 bg-bg-base px-4 py-2 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Variant
                  </th>
                )}
                <th className={`px-4 py-2 text-left text-xs font-semibold text-text-muted uppercase tracking-wider ${!showVariantColumn ? 'sticky left-0 bg-bg-base' : ''}`}>
                  Level
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Damage
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
                  {statsHeader}
                </th>
                <th className="px-4 py-2 text-center" title="Dragon Amulet Required">
                  <img 
                    src="https://github.com/DF-Pedia/DF-Pedia/blob/master/tags_banners/Banner-DragonAmulet.png?raw=true" 
                    alt="DA" 
                    className="w-4 h-4 mx-auto"
                  />
                </th>
                <th className="px-4 py-2 text-center" title="Dragon Coins">
                  <img 
                    src="https://github.com/DF-Pedia/DF-Pedia/blob/master/weapons/DragonCoin.png?raw=true" 
                    alt="DC" 
                    className="w-4 h-4 mx-auto"
                  />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {levels.map((level, index) => {
                // Check if ANY obtain variant has DA/DC
                const hasDA = level.obtainVariants.some(ov => ov.daRequired)
                const hasDC = level.obtainVariants.some(ov => ov.dcRequired || ov.priceType === 'dc')
                
                return (
                  <tr
                    key={level.levelNumber}
                    className="hover:bg-bg-surface transition-colors"
                  >
                    {showVariantColumn && (
                      <td className="sticky left-0 bg-bg-base hover:bg-bg-surface transition-colors px-4 py-3 text-sm text-text-primary font-medium">
                        {variantLabels[index]}
                      </td>
                    )}
                    <td className={`px-4 py-3 text-sm text-text-secondary ${!showVariantColumn ? 'sticky left-0 bg-bg-base hover:bg-bg-surface transition-colors font-medium' : ''}`}>
                      {level.actualLevel ?? level.levelDisplay}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary whitespace-pre-line">
                      {level.damage}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {level.stats}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {hasDA ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-gold text-bg-base text-xs font-bold">
                          ✓
                        </span>
                      ) : (
                        <span className="text-text-muted text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {hasDC ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-amber-500 text-bg-base text-xs font-bold">
                          ✓
                        </span>
                      ) : (
                        <span className="text-text-muted text-xs">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
  )
}
