import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import type { AccessoryEntry } from '../../types/accessory'
import { buildAccessoryCardData } from '../../hooks/useAccessories'
import { accessPillClass } from '../../utils/accessPillStyles'
import { normalizeDescriptionText } from '../../utils/displayText'
import ElementPill from '../shared/ElementPill'
import LevelRangeBadge from '../shared/LevelRangeBadge'

interface AccessoryCardProps {
  accessory: AccessoryEntry
  badgeLabel?: string
  toUrl?: string
}

const MAX_PILLS = 3

export default function AccessoryCard({ accessory, badgeLabel, toUrl }: AccessoryCardProps) {
  const card = buildAccessoryCardData(accessory)
  const visibleCodes = card.elements.slice(0, MAX_PILLS)
  const overflow = card.elements.length - MAX_PILLS

  return (
    <Link
      to={toUrl ?? card.route}
      className="group flex items-start gap-3 bg-bg-surface border border-border-default rounded-lg p-4 h-[120px] transition-all duration-200 ease-out hover:bg-bg-elevated hover:border-border-hover hover:-translate-y-0.5 hover:shadow-medium focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-bg-base"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
          {visibleCodes.map((code) => (
            <ElementPill key={code} code={code} size="sm" />
          ))}
          {overflow > 0 && (
            <span className="text-[10px] text-text-muted bg-bg-overlay px-1.5 py-0.5 rounded-full">
              +{overflow}
            </span>
          )}
          {badgeLabel && (
            <span className="text-[10px] text-sky-300 bg-sky-500/15 px-1.5 py-0.5 rounded-full font-medium">
              {badgeLabel}
            </span>
          )}
          {card.hasMultipleVersions && card.levelRange && (
            <LevelRangeBadge levelRange={card.levelRange} />
          )}
          {card.daRequired && (
            <span className={accessPillClass('da', 'card')}>
              DA
            </span>
          )}
          {card.dcRequired && (
            <span className={accessPillClass('dc', 'card')}>
              DC
            </span>
          )}
          {card.dmRequired && (
            <span className={accessPillClass('dm', 'card')}>
              DM
            </span>
          )}
          {card.hasFree && (
            <span className="text-[10px] text-green-400 bg-green-500/20 px-1.5 py-0.5 rounded-full font-medium">
              Free
            </span>
          )}
        </div>

        <h3 className="font-semibold text-text-primary text-sm leading-snug mb-1 line-clamp-1">
          {card.name}
        </h3>
        <p className="text-text-secondary text-xs leading-relaxed line-clamp-2">
          {normalizeDescriptionText(card.description) || 'No description yet.'}
        </p>
      </div>
      <ChevronRight
        className="w-4 h-4 text-text-muted group-hover:text-text-secondary flex-shrink-0 mt-0.5 transition-colors duration-150"
        aria-hidden="true"
      />
    </Link>
  )
}
