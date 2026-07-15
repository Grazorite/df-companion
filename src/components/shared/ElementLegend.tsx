import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import elementsData from '../../data/elements.json'
import type { ElementsData } from '../../types/element'

const { elements, traits } = elementsData as ElementsData

interface ElementLegendProps {
  includeTraits?: boolean
}

export default function ElementLegend({ includeTraits = true }: ElementLegendProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-text-muted hover:text-text-secondary text-xs transition-colors"
        aria-expanded={open}
      >
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        Legend
      </button>

      {open && (
        <div className="mt-3 bg-bg-surface border border-border-default rounded-lg p-4">
          <div className="mb-3">
            <p className="text-text-muted text-xs mb-2 font-medium uppercase tracking-wider">Elements</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1.5">
              {elements.map(e => (
                <div key={e.code} className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${e.colour}`}>
                    {e.code}
                  </span>
                  <span className="text-xs text-text-secondary">{e.shortName}</span>
                </div>
              ))}
            </div>
          </div>
          {includeTraits && (
            <div className="border-t border-border-default pt-3">
              <p className="text-text-muted text-xs mb-2 font-medium uppercase tracking-wider">Traits</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1.5">
                {traits.map(t => (
                  <div key={t.code} className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${t.colour}`}>
                      {t.code}
                    </span>
                    <span className="text-xs text-text-secondary">{t.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
