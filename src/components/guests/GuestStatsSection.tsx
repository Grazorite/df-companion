import type { GuestStats } from '../../types/pet'

interface GuestStatsSectionProps {
  stats: GuestStats
}

// Helper to check if a value is non-zero/non-none
function isNonZero(value: string | undefined): boolean {
  if (!value) return false
  const normalized = value.toLowerCase().trim()
  return normalized !== '0' && 
         normalized !== '0%' && 
         normalized !== 'none' &&
         normalized !== 'n/a'
}

// Helper to check if any stat in a record is non-zero
function hasNonZeroStats(stats: Record<string, string | undefined> | undefined): boolean {
  if (!stats) return false
  return Object.values(stats).some(v => isNonZero(v))
}

// Stat display row component
function StatRow({ label, value }: { label: string; value: string | undefined }) {
  if (!value) return null
  return (
    <div className="flex justify-between text-sm py-0.5">
      <span className="text-text-muted">{label}</span>
      <span className="text-text-secondary font-medium">{value}</span>
    </div>
  )
}

// Filter stats to only show non-zero values
function filterNonZeroStats(stats: Record<string, string | undefined>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(stats)) {
    if (isNonZero(value)) {
      result[key] = value!
    }
  }
  return result
}

export default function GuestStatsSection({ stats }: GuestStatsSectionProps) {
  // Build stat category cards that have at least one non-zero value
  const categories: Array<{
    title: string
    stats: Array<{ label: string; value: string }>
  }> = []
  
  // Stats (STR, DEX, etc.) - show if any non-zero
  if (stats.characterStats && hasNonZeroStats(stats.characterStats as Record<string, string | undefined>)) {
    const filtered = filterNonZeroStats(stats.characterStats as Record<string, string | undefined>)
    categories.push({
      title: 'Stats',
      stats: Object.entries(filtered).map(([key, value]) => ({
        label: key.toUpperCase(),
        value,
      })),
    })
  }
  
  // Offense - show if any non-zero
  if (stats.offense && hasNonZeroStats(stats.offense as Record<string, string | undefined>)) {
    const filtered = filterNonZeroStats(stats.offense as Record<string, string | undefined>)
    const labelMap: Record<string, string> = { boost: 'Boost', bonus: 'Bonus', crit: 'Crit' }
    categories.push({
      title: 'Offense',
      stats: Object.entries(filtered).map(([key, value]) => ({
        label: labelMap[key] || key,
        value,
      })),
    })
  }
  
  // Damage Multipliers - show if any non-100% (base) or non-zero
  if (stats.damageMultipliers) {
    // For damage multipliers, filter out 100% (base value) as well as 0%
    const filtered: Record<string, string> = {}
    const dm = stats.damageMultipliers as Record<string, string | undefined>
    for (const [key, value] of Object.entries(dm)) {
      if (value && value !== '100%' && value !== '0%') {
        filtered[key] = value
      }
    }
    if (Object.keys(filtered).length > 0) {
      const labelMap: Record<string, string> = { nonCrit: 'Non-Crit', dex: 'Dex', dot: 'DoT', crit: 'Crit' }
      categories.push({
        title: 'Damage Multipliers',
        stats: Object.entries(filtered).map(([key, value]) => ({
          label: labelMap[key] || key,
          value,
        })),
      })
    }
  }
  
  // Defense - show if any non-zero
  if (stats.defense && hasNonZeroStats(stats.defense as Record<string, string | undefined>)) {
    const filtered = filterNonZeroStats(stats.defense as Record<string, string | undefined>)
    const labelMap: Record<string, string> = { 
      melee: 'Melee', pierce: 'Pierce', magic: 'Magic', 
      block: 'Block', parry: 'Parry', dodge: 'Dodge' 
    }
    categories.push({
      title: 'Defense',
      stats: Object.entries(filtered).map(([key, value]) => ({
        label: labelMap[key] || key,
        value,
      })),
    })
  }
  
  // Damage Reduction - show if any non-zero
  if (stats.damageReduction && hasNonZeroStats(stats.damageReduction as Record<string, string | undefined>)) {
    const filtered = filterNonZeroStats(stats.damageReduction as Record<string, string | undefined>)
    const labelMap: Record<string, string> = { nonCrit: 'Non-Crit', dot: 'DoT', crit: 'Crit' }
    categories.push({
      title: 'Damage Reduction',
      stats: Object.entries(filtered).map(([key, value]) => ({
        label: labelMap[key] || key,
        value,
      })),
    })
  }
  
  // Resistances - show if not "None"
  if (stats.resistances && Object.keys(stats.resistances).length > 0) {
    const hasNonNone = Object.values(stats.resistances).some(v => v.toLowerCase() !== 'none')
    if (hasNonNone) {
      categories.push({
        title: 'Resistances',
        stats: Object.entries(stats.resistances)
          .filter(([, value]) => value.toLowerCase() !== 'none')
          .map(([element, value]) => ({
            label: element,
            value,
          })),
      })
    }
  }
  
  // If no categories have data, don't render
  if (categories.length === 0 && !stats.level && !stats.damage && !stats.damageType) {
    return null
  }
  
  return (
    <section className="mb-5">
      {/* Basic Info - Level, Damage, Damage Type */}
      {(stats.level || stats.damage || stats.damageType) && (
        <div className="bg-bg-surface border border-border-default rounded-lg p-4 mb-3">
          <div className="grid grid-cols-3 gap-4 text-center">
            {stats.level && (
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Level</p>
                <p className="text-sm font-medium text-text-primary">{stats.level}</p>
              </div>
            )}
            {stats.damage && (
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Damage</p>
                <p className="text-sm font-medium text-text-primary">{stats.damage}</p>
              </div>
            )}
            {stats.damageType && (
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Type</p>
                <p className="text-sm font-medium text-text-primary">{stats.damageType}</p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Stat Categories - 2-column grid */}
      {categories.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {categories.map((category) => (
            <div 
              key={category.title} 
              className="bg-bg-surface border border-border-default rounded-lg p-4"
            >
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                {category.title}
              </h3>
              <div className="space-y-0.5">
                {category.stats.map((stat) => (
                  <StatRow key={stat.label} label={stat.label} value={stat.value} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
