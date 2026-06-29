import { useNavigate } from 'react-router-dom'
import type { Badge } from '../../types/badge'

interface BadgeCardProps {
  badge: Badge
}

const CATEGORY_COLORS: Record<string, string> = {
  'quest-completion': 'bg-blue-500/20 text-blue-400',
  exploration: 'bg-green-500/20 text-green-400',
  combat: 'bg-red-500/20 text-red-400',
  collection: 'bg-purple-500/20 text-purple-400',
  seasonal: 'bg-cyan-500/20 text-cyan-400',
  secret: 'bg-yellow-500/20 text-yellow-400',
  community: 'bg-pink-500/20 text-pink-400',
  misc: 'bg-slate-500/20 text-slate-400',
}

export default function BadgeCard({ badge }: BadgeCardProps) {
  const navigate = useNavigate()

  return (
    <button
      onClick={() => navigate(`/badges/${badge.slug}`)}
      className="w-full text-left bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 rounded-xl p-4 transition-colors min-h-[80px] focus:outline-none focus:ring-2 focus:ring-amber-500"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h3 className="font-semibold text-white text-sm leading-snug">{badge.name}</h3>
        <span
          className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full capitalize ${CATEGORY_COLORS[badge.category] ?? CATEGORY_COLORS.misc}`}
        >
          {badge.category.replace(/-/g, ' ')}
        </span>
      </div>
      <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">{badge.description}</p>
    </button>
  )
}
