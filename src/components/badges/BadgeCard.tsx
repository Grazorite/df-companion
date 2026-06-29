import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import type { Badge } from '../../types/badge'

interface BadgeCardProps {
  badge: Badge
}

const CATEGORY_COLORS: Record<string, string> = {
  'quest-completion': 'bg-blue-500/20 text-blue-400',
  combat: 'bg-red-500/20 text-red-400',
  collection: 'bg-purple-500/20 text-purple-400',
  seasonal: 'bg-cyan-500/20 text-cyan-400',
  misc: 'bg-slate-500/20 text-slate-400',
}

export default function BadgeCard({ badge }: BadgeCardProps) {
  return (
    <Link
      to={`/badges/${badge.slug}`}
      className="group flex items-start gap-3 bg-slate-800 hover:bg-slate-750 active:bg-slate-700 border border-slate-700 hover:border-slate-500 rounded-xl p-4 transition-colors min-h-[72px] focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-slate-900"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${CATEGORY_COLORS[badge.category] ?? CATEGORY_COLORS.misc}`}
          >
            {badge.category.replace(/-/g, ' ')}
          </span>
        </div>
        <h3 className="font-semibold text-white text-sm leading-snug mb-1">{badge.name}</h3>
        <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">{badge.description}</p>
      </div>
      <ChevronRight
        className="w-4 h-4 text-slate-600 group-hover:text-slate-400 flex-shrink-0 mt-0.5 transition-colors"
        aria-hidden="true"
      />
    </Link>
  )
}
