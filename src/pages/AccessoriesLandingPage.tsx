import { Link } from 'react-router-dom'
import { Bird, Circle, Cog, Crown, Gem, Shield, Shirt, Sparkles, Wrench } from 'lucide-react'
import { ACCESSORY_SUBTYPES } from '../types/accessory'
import { useAccessoryCounts } from '../hooks/useAccessories'

const SUBTYPE_ICONS = {
  artifact: Sparkles,
  belt: Wrench,
  bracer: Shield,
  'cape-wing': Bird,
  helm: Crown,
  necklace: Gem,
  ring: Circle,
  trinket: Cog,
} as const

export default function AccessoriesLandingPage() {
  const { bySubtype, total, loading } = useAccessoryCounts()

  return (
    <main className="px-4 sm:px-6 py-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-gold/10 text-gold px-3 py-1 text-xs font-semibold uppercase tracking-wider mb-3">
          <Shirt className="w-4 h-4" />
          Accessories
        </div>
        <h1 className="text-3xl font-bold text-gold mb-3">Accessories</h1>
        <p className="text-text-secondary leading-relaxed max-w-2xl">
          Browse DragonFable accessories by subtype. The route architecture is live now, with
          Bracers and Trinkets first in line for the initial verified rollout.
        </p>
        <p className="text-sm text-text-muted mt-3">
          {loading
            ? 'Loading accessory counts...'
            : `${total} ${total === 1 ? 'entry' : 'entries'} currently indexed across all accessory datasets.`}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {ACCESSORY_SUBTYPES.map((meta) => {
          const Icon = SUBTYPE_ICONS[meta.subtype]

          return (
            <Link
              key={meta.subtype}
              to={meta.route}
              className="flex items-start gap-3 bg-bg-surface border border-gold/30 rounded-lg p-4 hover:bg-bg-elevated hover:border-gold/60 transition-all duration-200 group shadow-subtle hover:shadow-medium"
            >
              <div className="bg-gold/15 rounded-lg p-2.5 flex-shrink-0 mt-0.5 group-hover:bg-gold/25 transition-colors duration-200">
                <Icon className="w-5 h-5 text-gold" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-text-primary text-sm leading-snug">
                  {meta.label}
                  <span className="ml-1.5 text-xs font-normal text-text-muted">
                    {loading ? (
                      <span className="inline-block h-2.5 w-5 rounded bg-bg-overlay animate-pulse" />
                    ) : (
                      `(${bySubtype[meta.subtype] ?? 0})`
                    )}
                  </span>
                </div>
                <div className="text-text-secondary text-xs mt-1 leading-relaxed">
                  {meta.shortDescription}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </main>
  )
}
