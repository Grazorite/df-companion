import { Link } from 'react-router-dom'
import { Trophy, Map, Skull, Sword, Users, Shirt, House, Package, PawPrint, ArrowRight } from 'lucide-react'
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
            <div className="text-text-secondary text-sm">The where, what and how of Badges</div>
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-text-muted group-hover:text-gold transition-colors duration-150" />
      </Link>

      {/* Coming soon — exact forum structure */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {[
          { icon: Shirt, label: 'Accessories', desc: 'Belts, necklaces, rings, brooches, wings and capes' },
          { icon: Sword, label: 'Classes / Abilities', desc: 'Stats and abilities for all classes' },
          { icon: House, label: 'Housing & House Items', desc: 'Home is where the monsters are' },
          { icon: Map, label: 'Locations / Quests / Events', desc: 'Areas, shops, battlezones and special events' },
          { icon: Skull, label: 'Monsters', desc: 'All the creepy, crawly, cute or scary monsters' },
          { icon: Users, label: 'NPCs', desc: 'All those people who talk to you in the game' },
          { icon: PawPrint, label: 'Pets / Guests', desc: 'Your battle companions' },
          { icon: Package, label: 'Stackable / Non-Equippable Items', desc: 'Resources and non-equippable items' },
          { icon: Sword, label: 'Weapons', desc: 'Swords, daggers, staves and more' },
        ].map(({ icon: Icon, label, desc }) => (
          <div
            key={label}
            className="flex items-center gap-3 bg-bg-surface/40 border border-border-subtle rounded-lg p-3.5 opacity-50 cursor-not-allowed"
          >
            <div className="bg-bg-overlay rounded-lg p-2 flex-shrink-0">
              <Icon className="w-4 h-4 text-text-muted" />
            </div>
            <div className="min-w-0">
              <div className="font-medium text-text-secondary text-sm leading-tight">{label}</div>
              <div className="text-text-muted text-xs mt-0.5 line-clamp-1">{desc}</div>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
