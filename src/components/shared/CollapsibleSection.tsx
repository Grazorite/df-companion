import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

interface CollapsibleSectionProps {
  title: string
  children: ReactNode
  defaultOpen?: boolean
  className?: string
}

export default function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
  className = '',
}: CollapsibleSectionProps) {
  return (
    <details
      className={`group bg-transparent ${className}`.trim()}
      open={defaultOpen}
    >
      <summary className="list-none cursor-pointer select-none mb-3">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-text-muted uppercase tracking-wider hover:text-text-secondary transition-colors">
          <span>{title}</span>
          <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
        </div>
      </summary>
      <div>{children}</div>
    </details>
  )
}
