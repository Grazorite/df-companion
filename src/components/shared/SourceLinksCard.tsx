import { ExternalLink } from 'lucide-react'
import { displayTitle, normalizeDisplayText } from '../../utils/displayText'

export interface SourceLinkItem {
  url: string
  label: string
}

interface SourceLinksCardProps {
  links: SourceLinkItem[]
}

function directForumPostUrl(url: string): string {
  const messageId = url.match(/[?&]m=(\d+)/i)?.[1]
  if (!messageId || !/forums2\.battleon\.com\/f\//i.test(url)) return url

  return `https://forums2.battleon.com/f/fb.asp?m=${messageId}`
}

export default function SourceLinksCard({ links }: SourceLinksCardProps) {
  if (links.length === 0) return null

  return (
    <section className="bg-bg-surface border border-border-default rounded-lg p-5">
      <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
        Source{links.length > 1 ? 's' : ''}
      </h2>
      <div className="space-y-3">
        {links.map((link) => {
          const label = displayTitle(
            normalizeDisplayText(link.label).replace(/^DF Encyclopedia:\s*/i, '')
          )

          return (
            <a
              key={`${link.url}:${link.label}`}
              href={directForumPostUrl(link.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start justify-between gap-3 text-sm text-gold hover:text-gold-bright transition-colors"
            >
              <span className="min-w-0 break-words">{label}</span>
              <ExternalLink className="w-4 h-4 mt-0.5 shrink-0" />
            </a>
          )
        })}
      </div>
    </section>
  )
}
