import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import type { Badge } from '../../types/badge'
import { displayTitle } from '../../utils/displayText'

interface BadgeCardProps {
  badge: Badge
  /** Override the navigation target (e.g. to carry `?from=` param). Defaults to /badges/:slug */
  toUrl?: string
  /** Use replace instead of push so clicking related badges doesn't pollute history */
  replace?: boolean
}

const CATEGORY_COLORS: Record<string, string> = {
  'quest-completion': 'bg-blue-500/20 text-blue-400',
  combat: 'bg-red-600/20 text-red-400',
  collection: 'bg-purple-500/20 text-purple-400',
  seasonal: 'bg-cyan-500/20 text-cyan-400',
  misc: 'bg-bg-overlay text-text-muted',
}

export default function BadgeCard({ badge, toUrl, replace }: BadgeCardProps) {
  return (
    <Link
      to={toUrl ?? `/badges/${badge.slug}`}
      replace={replace}
      className="group flex items-start gap-3 bg-bg-surface border border-border-default rounded-lg p-4 h-[120px] transition-all duration-200 ease-out hover:bg-bg-elevated hover:border-border-hover hover:-translate-y-0.5 hover:shadow-medium focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-bg-base"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span
            className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${CATEGORY_COLORS[badge.category] ?? CATEGORY_COLORS.misc}`}
          >
            {badge.category.replace(/-/g, ' ')}
          </span>
        </div>
        <h3 className="font-semibold text-text-primary text-sm leading-snug mb-1 line-clamp-1">
          {displayTitle(badge.name)}
        </h3>
        <p className="text-text-secondary text-xs leading-relaxed line-clamp-2">
          {badge.description}
        </p>
      </div>
      <ChevronRight
        className="w-4 h-4 text-text-muted group-hover:text-text-secondary flex-shrink-0 mt-0.5 transition-colors duration-150"
        aria-hidden="true"
      />
    </Link>
  )
}
