import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import type { Badge } from '../../types/badge'
import { displayTitle, normalizeDescriptionText } from '../../utils/displayText'

interface BadgeCardProps {
  badge: Badge
  /** Override the navigation target (e.g. to carry `?from=` param). Defaults to /badges/:slug */
  toUrl?: string
  /** Use replace instead of push so clicking related badges doesn't pollute history */
  replace?: boolean
  /** Optional type cue for cross-category related cards */
  badgeLabel?: string
}

const CATEGORY_COLORS: Record<string, string> = {
  'quest-completion': 'bg-blue-500/20 text-blue-400',
  combat: 'bg-red-600/20 text-red-400',
  collection: 'bg-purple-500/20 text-purple-400',
  seasonal: 'bg-cyan-500/20 text-cyan-400',
  misc: 'bg-bg-overlay text-text-muted',
}

export default function BadgeCard({ badge, toUrl, replace, badgeLabel }: BadgeCardProps) {
  return (
    <Link
      to={toUrl ?? `/badges/${badge.slug}`}
      replace={replace}
      className="group flex items-start gap-3 bg-bg-surface border border-border-default rounded-lg p-4 h-[120px] transition-[transform,box-shadow,background-color,border-color] duration-[160ms] ease-[cubic-bezier(0.2,0,0,1)] hover:bg-bg-elevated hover:border-border-hover hover:-translate-y-0.5 hover:shadow-medium active:translate-y-0 active:scale-[0.99] active:duration-[90ms] motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span
            className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${CATEGORY_COLORS[badge.category] ?? CATEGORY_COLORS.misc}`}
          >
            {badge.category.replace(/-/g, ' ')}
          </span>
          {badgeLabel && (
            <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-bg-overlay text-text-muted flex-shrink-0">
              {badgeLabel}
            </span>
          )}
        </div>
        <h2 className="font-semibold text-text-primary text-sm leading-snug mb-1 line-clamp-1">
          {displayTitle(badge.name)}
        </h2>
        <p className="text-text-secondary text-xs leading-relaxed line-clamp-2">
          {normalizeDescriptionText(badge.description)}
        </p>
      </div>
      <ChevronRight
        className="w-4 h-4 text-text-muted group-hover:text-text-secondary group-hover:translate-x-0.5 flex-shrink-0 mt-0.5 transition-[color,transform] duration-[130ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:group-hover:translate-x-0"
        aria-hidden="true"
      />
    </Link>
  )
}
