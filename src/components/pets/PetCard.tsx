import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import type { Pet } from '../../types/pet'
import ElementPill from '../shared/ElementPill'

interface PetCardProps {
  pet: Pet
  toUrl?: string
  replace?: boolean
}

const MAX_PILLS = 2

export default function PetCard({ pet, toUrl, replace }: PetCardProps) {
  const allCodes = [...pet.elements, ...pet.traits]
  const visibleCodes = allCodes.slice(0, MAX_PILLS)
  const overflow = allCodes.length - MAX_PILLS

  const route = toUrl ?? `/${pet.type === 'pet' ? 'pets' : 'guests'}/${pet.slug}`

  return (
    <Link
      to={route}
      replace={replace}
      className="group flex items-start gap-3 bg-bg-surface border border-border-default rounded-lg p-4 min-h-[80px] transition-all duration-200 ease-out hover:bg-bg-elevated hover:border-border-hover hover:-translate-y-0.5 hover:shadow-medium focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-bg-base"
    >
      <div className="flex-1 min-w-0">
        {/* Element pills + type badge */}
        <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
          {visibleCodes.map(code => (
            <ElementPill key={code} code={code} size="sm" />
          ))}
          {overflow > 0 && (
            <span className="text-[10px] text-text-muted bg-bg-overlay px-1.5 py-0.5 rounded-full">
              +{overflow}
            </span>
          )}
          <span className="ml-auto text-[10px] text-text-muted bg-bg-overlay px-1.5 py-0.5 rounded-full capitalize flex-shrink-0">
            {pet.type}
          </span>
        </div>

        <h3 className="font-semibold text-text-primary text-sm leading-snug mb-1">{pet.name}</h3>
        <p className="text-text-secondary text-xs leading-relaxed line-clamp-2">{pet.description}</p>
      </div>
      <ChevronRight
        className="w-4 h-4 text-text-muted group-hover:text-text-secondary flex-shrink-0 mt-0.5 transition-colors duration-150"
        aria-hidden="true"
      />
    </Link>
  )
}
