import { ChevronDown } from 'lucide-react'
import { useId } from 'react'
import elementsData from '../../data/elements.json'
import type { ElementsData } from '../../types/element'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible'

const { elements, traits } = elementsData as ElementsData

interface ElementLegendProps {
  includeTraits?: boolean
}

export default function ElementLegend({ includeTraits = true }: ElementLegendProps) {
  const contentId = useId()

  return (
    <Collapsible className="group/legend mb-4">
      <CollapsibleTrigger
        aria-controls={contentId}
        className="flex min-h-11 items-center gap-1.5 rounded-sm text-xs text-text-muted transition-colors hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base sm:min-h-0"
      >
        <ChevronDown
          className="h-3.5 w-3.5 transition-transform duration-[160ms] group-data-[state=open]/legend:rotate-180 motion-reduce:transition-none"
          aria-hidden="true"
        />
        Legend
      </CollapsibleTrigger>

      <CollapsibleContent id={contentId}>
        <div className="mt-3 bg-bg-surface border border-border-default rounded-lg p-4">
          <div className="mb-3">
            <p className="text-text-muted text-xs mb-2 font-medium uppercase tracking-wider">
              Elements
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1.5">
              {elements.map((e) => (
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
              <p className="text-text-muted text-xs mb-2 font-medium uppercase tracking-wider">
                Traits
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1.5">
                {traits.map((t) => (
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
      </CollapsibleContent>
    </Collapsible>
  )
}
