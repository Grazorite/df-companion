import { ExternalLink } from 'lucide-react'
import { normalizeDisplayText } from '../../utils/displayText'

export interface SourceLinkItem {
  url: string
  label: string
}

interface SourceLinksCardProps {
  links: SourceLinkItem[]
}

export default function SourceLinksCard({ links }: SourceLinksCardProps) {
  if (links.length === 0) return null

  return (
    <section className="bg-bg-surface border border-border-default rounded-lg p-5">
      <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
        Source{links.length > 1 ? 's' : ''}
      </h2>
      <div className="space-y-3">
        {links.map(link => (
          <a
            key={`${link.url}:${link.label}`}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start justify-between gap-3 text-sm text-gold hover:text-gold-bright transition-colors"
          >
            <span className="min-w-0 break-words">{normalizeDisplayText(link.label)}</span>
            <ExternalLink className="w-4 h-4 mt-0.5 shrink-0" />
          </a>
        ))}
      </div>
    </section>
  )
}
