import type { LevelVariant } from '../../types/item'
import { getLevelVariantLabels, shouldShowVariantColumn } from '../../utils/variantHelpers'

interface AccessoryStatsTableProps {
  levels: LevelVariant[]
  familyName?: string
}

export default function AccessoryStatsTable({
  levels,
  familyName,
}: AccessoryStatsTableProps) {
  const variantLabels = getLevelVariantLabels(levels, familyName, 'accessory')
  const showVariantColumn = shouldShowVariantColumn(levels, familyName, 'accessory')

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
              <th
                className={`px-4 py-2 text-left text-xs font-semibold text-text-muted uppercase tracking-wider ${
                  !showVariantColumn ? 'sticky left-0 bg-bg-base' : ''
                }`}
              >
                Level
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
                Stats
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
                Resists
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
              const hasDA = level.obtainVariants.some(variant => variant.daRequired)
              const hasDC = level.obtainVariants.some(
                variant => variant.dcRequired || variant.priceType === 'dc'
              )

              return (
                <tr key={`${level.levelNumber}-${level.name}-${index}`} className="hover:bg-bg-surface transition-colors">
                  {showVariantColumn && (
                    <td className="sticky left-0 bg-bg-base hover:bg-bg-surface transition-colors px-4 py-3 text-sm text-text-primary font-medium">
                      {variantLabels[index]}
                    </td>
                  )}
                  <td
                    className={`px-4 py-3 text-sm text-text-secondary ${
                      !showVariantColumn
                        ? 'sticky left-0 bg-bg-base hover:bg-bg-surface transition-colors font-medium'
                        : ''
                    }`}
                  >
                    {level.actualLevel ?? level.levelDisplay}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-secondary whitespace-pre-line">
                    {level.stats || 'None'}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-secondary whitespace-pre-line">
                    {level.resists || 'None'}
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
