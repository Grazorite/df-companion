import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { GuestStats } from '../../types/pet'

interface GuestStatsSectionProps {
  stats: GuestStats
}

export default function GuestStatsSection({ stats }: GuestStatsSectionProps) {
  const [isOpen, setIsOpen] = useState(false)
  
  // Check if we have any detailed stats to display
  const hasDetailedStats = 
    stats.characterStats ||
    stats.offense ||
    stats.damageMultipliers ||
    stats.defense ||
    stats.damageReduction ||
    stats.resistances
  
  if (!hasDetailedStats) return null
  
  return (
    <section aria-labelledby="guest-stats-heading" className="mb-5">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-bg-surface border border-border-default rounded-lg p-4 hover:bg-bg-elevated transition-colors text-left"
        aria-expanded={isOpen}
      >
        <div>
          <h2 id="guest-stats-heading" className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
            Detailed Stats
          </h2>
          <p className="text-sm text-text-secondary">
            {stats.level} • {stats.damageType} • {stats.element}
          </p>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      
      {isOpen && (
        <div className="mt-3 space-y-4 bg-bg-surface/40 border border-border-default rounded-lg p-4">
          {/* Basic Info */}
          <div>
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
              Basic Info
            </h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {stats.level && (
                <div>
                  <span className="text-text-muted">Level:</span>{' '}
                  <span className="text-text-secondary">{stats.level}</span>
                </div>
              )}
              {stats.damage && (
                <div>
                  <span className="text-text-muted">Damage:</span>{' '}
                  <span className="text-text-secondary">{stats.damage}</span>
                </div>
              )}
              {stats.damageType && (
                <div>
                  <span className="text-text-muted">Damage Type:</span>{' '}
                  <span className="text-text-secondary">{stats.damageType}</span>
                </div>
              )}
              {stats.element && (
                <div>
                  <span className="text-text-muted">Element:</span>{' '}
                  <span className="text-text-secondary">{stats.element}</span>
                </div>
              )}
              {stats.hp && (
                <div>
                  <span className="text-text-muted">HP:</span>{' '}
                  <span className="text-text-secondary">{stats.hp}</span>
                </div>
              )}
              {stats.mp && (
                <div>
                  <span className="text-text-muted">MP:</span>{' '}
                  <span className="text-text-secondary">{stats.mp}</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Character Stats */}
          {stats.characterStats && (
            <div>
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                Stats
              </h3>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 text-sm">
                {stats.characterStats.str && (
                  <div>
                    <span className="text-text-muted">STR:</span>{' '}
                    <span className="text-text-secondary">{stats.characterStats.str}</span>
                  </div>
                )}
                {stats.characterStats.dex && (
                  <div>
                    <span className="text-text-muted">DEX:</span>{' '}
                    <span className="text-text-secondary">{stats.characterStats.dex}</span>
                  </div>
                )}
                {stats.characterStats.int && (
                  <div>
                    <span className="text-text-muted">INT:</span>{' '}
                    <span className="text-text-secondary">{stats.characterStats.int}</span>
                  </div>
                )}
                {stats.characterStats.cha && (
                  <div>
                    <span className="text-text-muted">CHA:</span>{' '}
                    <span className="text-text-secondary">{stats.characterStats.cha}</span>
                  </div>
                )}
                {stats.characterStats.luk && (
                  <div>
                    <span className="text-text-muted">LUK:</span>{' '}
                    <span className="text-text-secondary">{stats.characterStats.luk}</span>
                  </div>
                )}
                {stats.characterStats.end && (
                  <div>
                    <span className="text-text-muted">END:</span>{' '}
                    <span className="text-text-secondary">{stats.characterStats.end}</span>
                  </div>
                )}
                {stats.characterStats.wis && (
                  <div>
                    <span className="text-text-muted">WIS:</span>{' '}
                    <span className="text-text-secondary">{stats.characterStats.wis}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Offense */}
          {stats.offense && (
            <div>
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                Offense
              </h3>
              <div className="grid grid-cols-3 gap-2 text-sm">
                {stats.offense.boost && (
                  <div>
                    <span className="text-text-muted">Boost:</span>{' '}
                    <span className="text-text-secondary">{stats.offense.boost}</span>
                  </div>
                )}
                {stats.offense.bonus && (
                  <div>
                    <span className="text-text-muted">Bonus:</span>{' '}
                    <span className="text-text-secondary">{stats.offense.bonus}</span>
                  </div>
                )}
                {stats.offense.crit && (
                  <div>
                    <span className="text-text-muted">Crit:</span>{' '}
                    <span className="text-text-secondary">{stats.offense.crit}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Damage Multipliers */}
          {stats.damageMultipliers && (
            <div>
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                Damage Multipliers
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                {stats.damageMultipliers.nonCrit && (
                  <div>
                    <span className="text-text-muted">Non-Crit:</span>{' '}
                    <span className="text-text-secondary">{stats.damageMultipliers.nonCrit}</span>
                  </div>
                )}
                {stats.damageMultipliers.dex && (
                  <div>
                    <span className="text-text-muted">Dex:</span>{' '}
                    <span className="text-text-secondary">{stats.damageMultipliers.dex}</span>
                  </div>
                )}
                {stats.damageMultipliers.dot && (
                  <div>
                    <span className="text-text-muted">DoT:</span>{' '}
                    <span className="text-text-secondary">{stats.damageMultipliers.dot}</span>
                  </div>
                )}
                {stats.damageMultipliers.crit && (
                  <div>
                    <span className="text-text-muted">Crit:</span>{' '}
                    <span className="text-text-secondary">{stats.damageMultipliers.crit}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Defense */}
          {stats.defense && (
            <div>
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                Defense
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-sm">
                {stats.defense.melee && (
                  <div>
                    <span className="text-text-muted">Melee:</span>{' '}
                    <span className="text-text-secondary">{stats.defense.melee}</span>
                  </div>
                )}
                {stats.defense.pierce && (
                  <div>
                    <span className="text-text-muted">Pierce:</span>{' '}
                    <span className="text-text-secondary">{stats.defense.pierce}</span>
                  </div>
                )}
                {stats.defense.magic && (
                  <div>
                    <span className="text-text-muted">Magic:</span>{' '}
                    <span className="text-text-secondary">{stats.defense.magic}</span>
                  </div>
                )}
                {stats.defense.block && (
                  <div>
                    <span className="text-text-muted">Block:</span>{' '}
                    <span className="text-text-secondary">{stats.defense.block}</span>
                  </div>
                )}
                {stats.defense.parry && (
                  <div>
                    <span className="text-text-muted">Parry:</span>{' '}
                    <span className="text-text-secondary">{stats.defense.parry}</span>
                  </div>
                )}
                {stats.defense.dodge && (
                  <div>
                    <span className="text-text-muted">Dodge:</span>{' '}
                    <span className="text-text-secondary">{stats.defense.dodge}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Damage Reduction */}
          {stats.damageReduction && (
            <div>
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                Damage Reduction
              </h3>
              <div className="grid grid-cols-3 gap-2 text-sm">
                {stats.damageReduction.nonCrit && (
                  <div>
                    <span className="text-text-muted">Non-Crit:</span>{' '}
                    <span className="text-text-secondary">{stats.damageReduction.nonCrit}</span>
                  </div>
                )}
                {stats.damageReduction.dot && (
                  <div>
                    <span className="text-text-muted">DoT:</span>{' '}
                    <span className="text-text-secondary">{stats.damageReduction.dot}</span>
                  </div>
                )}
                {stats.damageReduction.crit && (
                  <div>
                    <span className="text-text-muted">Crit:</span>{' '}
                    <span className="text-text-secondary">{stats.damageReduction.crit}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Resistances */}
          {stats.resistances && Object.keys(stats.resistances).length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                Resistances
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                {Object.entries(stats.resistances).map(([element, value]) => (
                  <div key={element}>
                    <span className="text-text-muted capitalize">{element}:</span>{' '}
                    <span className="text-text-secondary">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
