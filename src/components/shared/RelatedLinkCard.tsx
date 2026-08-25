import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

interface RelatedLinkCardProps {
  to: string
  title: string
  label?: string
  description?: string
}

export default function RelatedLinkCard({
  to,
  title,
  label,
  description = 'Related through an explicit forum note.',
}: RelatedLinkCardProps) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-3 bg-bg-surface border border-border-default rounded-lg p-4 h-[120px] transition-all duration-200 ease-out hover:bg-bg-elevated hover:border-border-hover hover:-translate-y-0.5 hover:shadow-medium focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-bg-base"
    >
      <div className="flex-1 min-w-0">
        {label && (
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            <span className="text-[10px] text-sky-300 bg-sky-500/15 px-1.5 py-0.5 rounded-full font-medium">
              {label}
            </span>
          </div>
        )}
        <h3 className="font-semibold text-text-primary text-sm leading-snug mb-1 line-clamp-1">
          {title}
        </h3>
        <p className="text-text-secondary text-xs leading-relaxed line-clamp-2">{description}</p>
      </div>
      <ChevronRight
        className="w-4 h-4 text-text-muted group-hover:text-text-secondary flex-shrink-0 mt-0.5 transition-colors duration-150"
        aria-hidden="true"
      />
    </Link>
  )
}
