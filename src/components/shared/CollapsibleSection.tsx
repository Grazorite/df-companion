import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './ui/collapsible'

interface CollapsibleSectionProps {
  title: string
  children: ReactNode
  defaultOpen?: boolean
  className?: string
}

/**
 * Disclosure section with a titled trigger and animated content.
 *
 * Built on the Radix Collapsible primitive so the trigger is a real button
 * with keyboard operation (Enter / Space), managed focus, and
 * `aria-controls` / `aria-expanded` wiring for assistive tech. Styling stays on
 * the existing DragonFable design tokens; the open/close height animation uses
 * Radix's `--radix-collapsible-content-height` variable (see `index.css`).
 *
 * Public API is unchanged from the previous `<details>`-based version so it is
 * a drop-in replacement for existing consumers.
 */
export default function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
  className = '',
}: CollapsibleSectionProps) {
  return (
    <Collapsible
      defaultOpen={defaultOpen}
      className={`group ${className}`.trim()}
    >
      <CollapsibleTrigger className="mb-3 flex cursor-pointer select-none items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-muted transition-colors hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base rounded-sm">
        <span>{title}</span>
        <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
        <div>{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}
