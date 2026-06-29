import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import type { Badge } from '../../types/badge'

interface BadgeCardProps {
  badge: Badge
}

const CATEGORY_COLORS: Record<string, string> = {
  'quest-completion': 'bg-blue-500/20 text-blue-400',
  combat: 'bg-red-600/20 text-red-400',
  collection: 'bg-purple-500/20 text-purple-400',
  seasonal: 'bg-cyan-500/20 text-cyan-400',
  misc: 'bg-bg-overlay text-text-muted',
}

export default function BadgeCard({ badge }: BadgeCardProps) {
  return (
    <Link
      to={`/badges/${badge.slug}`}
      className="group flex items-start gap-3 bg-bg-surface border border-border-default rounded-lg p-4 min-h-[80px] transition-all duration-200 ease-out hover:bg-bg-elevated hover:border-border-hover hover:-translate-y-0.5 hover:shadow-medium focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-bg-base"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span
            className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${CATEGORY_COLORS[badge.category] ?? CATEGORY_COLORS.misc}`}
          >
            {badge.category.replace(/-/g, ' ')}
          </span>
        </div>
        <h3 className="font-semibold text-text-primary text-sm leading-snug mb-1">{badge.name}</h3>
        <p className="text-text-secondary text-xs leading-relaxed line-clamp-2">{badge.description}</p>
      </div>
      <ChevronRight
        className="w-4 h-4 text-text-muted group-hover:text-text-secondary flex-shrink-0 mt-0.5 transition-colors duration-150"
        aria-hidden="true"
      />
    </Link>
  )
}
