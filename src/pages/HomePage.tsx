import { Link } from 'react-router-dom'
import { Trophy, Map, Skull, Sword, Users, Swords, ArrowRight } from 'lucide-react'
import { useTotalBadgeCount } from '../hooks/useBadges'

export default function HomePage() {
  const badgeCount = useTotalBadgeCount()

  return (
    <main className="px-4 sm:px-6 py-8 max-w-3xl mx-auto">
      {/* Hero */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gold mb-3">DragonFable Companion</h1>
        <p className="text-text-secondary text-base leading-relaxed max-w-xl mx-auto">
          A searchable reference for DragonFable game content. Sourced from the{' '}
          <a
            href="https://forums2.battleon.com/f/tt.asp?forumid=256"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold hover:text-gold-bright underline underline-offset-2 transition-colors"
          >
            official DragonFable forums
          </a>
          .
        </p>
      </div>

      {/* Badges — available */}
      <Link
        to="/badges"
        className="flex items-center justify-between bg-bg-surface border border-gold/30 rounded-lg p-5 mb-4 hover:bg-bg-elevated hover:border-gold/60 transition-all duration-200 group shadow-subtle hover:shadow-medium"
      >
        <div className="flex items-center gap-4">
          <div className="bg-gold/15 rounded-lg p-3 group-hover:bg-gold/25 transition-colors duration-200">
            <Trophy className="w-6 h-6 text-gold" />
          </div>
          <div>
            <div className="font-semibold text-text-primary text-lg">{badgeCount} Badges</div>
            <div className="text-text-secondary text-sm">Hidden achievements and how to earn them</div>
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-text-muted group-hover:text-gold transition-colors duration-150" />
      </Link>

      {/* Coming soon — forum structure */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: Map, label: 'Locations & Quests', desc: 'Areas, shops, events & quests' },
          { icon: Swords, label: 'Classes', desc: 'Skills, stats & abilities' },
          { icon: Skull, label: 'Monsters', desc: 'Enemies, stats & drops' },
          { icon: Sword, label: 'Weapons & Items', desc: 'Equipment & stackables' },
          { icon: Users, label: 'NPCs & Pets', desc: 'Characters & companions' },
        ].map(({ icon: Icon, label, desc }) => (
          <div
            key={label}
            className="flex items-center gap-3 bg-bg-surface/40 border border-border-subtle rounded-lg p-4 opacity-50 cursor-not-allowed"
          >
            <div className="bg-bg-overlay rounded-lg p-2 flex-shrink-0">
              <Icon className="w-5 h-5 text-text-muted" />
            </div>
            <div className="min-w-0">
              <div className="font-medium text-text-secondary text-sm leading-tight">{label}</div>
              <div className="text-text-muted text-xs truncate mt-0.5">{desc}</div>
              <div className="text-text-muted text-xs mt-0.5 opacity-70">Coming soon</div>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
