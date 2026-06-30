import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import type { Evolution } from '../../types/pet'

interface PetEvolutionsProps {
  evolutions: Evolution[]
  fromUrl: string
}

export default function PetEvolutions({ evolutions, fromUrl }: PetEvolutionsProps) {
  if (evolutions.length === 0) return null

  return (
    <section aria-labelledby="evolutions-heading" className="mb-5">
      <h2 id="evolutions-heading" className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
        Combinations / Evolutions
      </h2>
      <div className="space-y-2">
        {evolutions.map((ev, i) => {
          const section = ev.resultType === 'pet' ? 'pets' : 'guests'
          return (
            <div key={i} className="bg-bg-surface border border-border-default rounded-lg p-3.5 flex items-center gap-3">
              <div className="flex-1 min-w-0 text-sm text-text-secondary">
                Combine with <span className="text-text-primary font-medium">{ev.combineWith}</span>
              </div>
              <ArrowRight className="w-4 h-4 text-text-muted flex-shrink-0" aria-hidden="true" />
              <Link
                to={`/${section}/${ev.resultSlug}?from=${encodeURIComponent(fromUrl)}`}
                replace
                className="text-gold hover:text-gold-bright text-sm font-medium transition-colors text-right flex-shrink-0"
              >
                {ev.resultName}
              </Link>
            </div>
          )
        })}
      </div>
    </section>
  )
}
