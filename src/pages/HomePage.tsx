import { Link } from 'react-router-dom'
import { Trophy, Scroll, Map, Skull, Package, ArrowRight } from 'lucide-react'
import { useTotalBadgeCount } from '../hooks/useBadges'

export default function HomePage() {
  const badgeCount = useTotalBadgeCount()

  return (
    <main className="px-4 py-8 max-w-3xl mx-auto">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-amber-400 mb-2">DragonFable Companion</h1>
        <p className="text-slate-300 text-base leading-relaxed max-w-xl mx-auto">
          A searchable reference for DragonFable game content — quests, badges, locations, and
          more. All information sourced from the{' '}
          <a
            href="https://forums2.battleon.com/f/tt.asp?forumid=256"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-400 underline underline-offset-2"
          >
            official DragonFable forums
          </a>
          .
        </p>
      </div>

      {/* Available section */}
      <Link
        to="/badges"
        className="flex items-center justify-between bg-slate-800 border border-amber-500/40 rounded-xl p-5 mb-4 hover:bg-slate-700 hover:border-amber-400 transition-colors group"
      >
        <div className="flex items-center gap-4">
          <div className="bg-amber-500/20 rounded-lg p-3">
            <Trophy className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <div className="font-semibold text-white text-lg">Badges</div>
            <div className="text-slate-400 text-sm">{badgeCount} badges • Hidden achievements and how to earn them</div>
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-amber-400 transition-colors" />
      </Link>

      {/* Coming soon sections */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: Scroll, label: 'Quests', desc: 'Quest details & rewards' },
          { icon: Map, label: 'Locations', desc: 'Maps & area guides' },
          { icon: Skull, label: 'Monsters', desc: 'Stats & drops' },
          { icon: Package, label: 'Items', desc: 'Equipment & loot' },
        ].map(({ icon: Icon, label, desc }) => (
          <div
            key={label}
            className="flex items-center gap-3 bg-slate-800/50 border border-slate-700 rounded-xl p-4 opacity-60"
          >
            <div className="bg-slate-700 rounded-lg p-2">
              <Icon className="w-5 h-5 text-slate-400" />
            </div>
            <div>
              <div className="font-medium text-slate-300 text-sm">{label}</div>
              <div className="text-slate-500 text-xs">{desc}</div>
              <div className="text-slate-600 text-xs mt-0.5">Coming soon</div>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
