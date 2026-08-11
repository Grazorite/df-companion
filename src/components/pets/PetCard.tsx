import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import type { Pet } from '../../types/pet'
import type { ItemFamily } from '../../types/item'
import { displayTitle } from '../../utils/displayText'
import {
  getDisplayFamilyName,
  getFamilyCardDescription,
  hasSameLevelVariants,
  isSingleVariant,
} from '../../utils/variantHelpers'
import ElementPill from '../shared/ElementPill'
import LevelRangeBadge from '../shared/LevelRangeBadge'

interface PetCardProps {
  pet: Pet
  toUrl?: string
  replace?: boolean
  // Optional: ItemFamily for multi-variant display
  family?: ItemFamily
}

const MAX_PILLS = 3

export default function PetCard({ pet, toUrl, replace, family }: PetCardProps) {
  const allCodes = [...pet.elements, ...pet.traits]
  const visibleCodes = allCodes.slice(0, MAX_PILLS)
  const overflow = allCodes.length - MAX_PILLS

  const route = toUrl ?? `/${pet.type === 'pet' ? 'pets' : 'guests'}/${pet.slug}`

  // Check if multi-variant
  const isMultiVariant = family && !isSingleVariant(family)
  const sameLevelVariants = family ? hasSameLevelVariants(family) : false

  // Strip roman numerals from display name for multi-variant items
  const displayName = displayTitle(
    isMultiVariant && family ? getDisplayFamilyName(family) : pet.name
  )
  const displayDescription = family ? getFamilyCardDescription(family) : pet.description

  // Use family flags if available, otherwise fall back to Pet flags
  const displayFlags = family
    ? {
        hasDA: family.hasDA,
        hasDC: family.hasDC,
        hasDM: family.hasDM,
        hasFree: family.hasFree,
        levelRange: family.levelRange,
      }
    : {
        hasDA: pet.daRequired,
        hasDC: pet.dcRequired ?? false,
        hasDM: pet.dmRequired ?? false,
        hasFree: pet.obtainMethods.some((m) => m.priceType === 'free'),
        levelRange: pet.level,
      }
  const showLevelRange =
    isMultiVariant && pet.type !== 'guest' && !family?.isMultiPost && !sameLevelVariants
  const metadataPillCount = visibleCodes.length + (overflow > 0 ? 1 : 0) + (showLevelRange ? 1 : 0)
  const maxAccessPills = Math.max(0, 5 - metadataPillCount)
  const accessPills = [
    {
      key: 'da',
      label: 'DA',
      show: displayFlags.hasDA,
      className: 'text-orange-400 bg-orange-500/20',
    },
    {
      key: 'dc',
      label: 'DC',
      show: displayFlags.hasDC,
      className: 'text-gold bg-amber-500/20',
    },
    {
      key: 'dm',
      label: 'DM',
      show: displayFlags.hasDM,
      className: 'text-slate-300 bg-slate-500/20',
    },
    {
      key: 'free',
      label: 'Free',
      show: pet.type !== 'guest' && displayFlags.hasFree,
      className: 'text-green-400 bg-green-500/20',
    },
  ]
    .filter((pill) => pill.show)
    .slice(0, maxAccessPills)

  return (
    <Link
      to={route}
      replace={replace}
      className="group flex items-start gap-3 bg-bg-surface border border-border-default rounded-lg p-4 h-[120px] transition-all duration-200 ease-out hover:bg-bg-elevated hover:border-border-hover hover:-translate-y-0.5 hover:shadow-medium focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-bg-base"
    >
      <div className="flex-1 min-w-0">
        {/* Element pills + access pills + level range + type badge */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="min-w-0 flex flex-wrap items-center gap-1.5">
            {visibleCodes.map((code) => (
              <ElementPill key={code} code={code} size="sm" />
            ))}
            {overflow > 0 && (
              <span className="text-[10px] text-text-muted bg-bg-overlay px-1.5 py-0.5 rounded-full">
                +{overflow}
              </span>
            )}

            {/* Multi-variant indicators */}
            {showLevelRange && <LevelRangeBadge levelRange={displayFlags.levelRange} />}
            {accessPills.map((pill) => (
              <span
                key={pill.key}
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${pill.className}`}
              >
                {pill.label}
              </span>
            ))}
          </div>

          <span className="text-[10px] text-text-muted bg-bg-overlay px-1.5 py-0.5 rounded-full capitalize flex-shrink-0">
            {pet.type}
          </span>
        </div>

        <h3 className="font-semibold text-text-primary text-sm leading-snug mb-1 line-clamp-1">
          {displayName}
        </h3>
        <p className="text-text-secondary text-xs leading-relaxed line-clamp-2">
          {displayDescription}
        </p>
      </div>
      <ChevronRight
        className="w-4 h-4 text-text-muted group-hover:text-text-secondary flex-shrink-0 mt-0.5 transition-colors duration-150"
        aria-hidden="true"
      />
    </Link>
  )
}
