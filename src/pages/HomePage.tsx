import { Link } from 'react-router-dom'
import { Trophy, Map, Skull, Sword, Users, Shirt, House, Package, PawPrint } from 'lucide-react'
import { useTotalBadgeCount } from '../hooks/useBadges'
import { useTotalPetCount } from '../hooks/usePets'
import { useTotalAccessoryCount } from '../hooks/useAccessories'

// All sections in forum order — each as its own card, uniform grid
const SECTIONS = [
  { to: '/accessories', icon: Shirt, label: 'Accessories', desc: 'Belts, necklaces, rings, brooches, wings and capes. If you can equip it and it\'s not a weapon, you\'ll find it here.', available: true },
  { to: '/badges', icon: Trophy, label: 'Badges', desc: 'The where, what and how of Badges.', available: true },
  { to: '/classes', icon: Sword, label: 'Classes / Abilities', desc: 'All the different stats and abilities for the different classes in DragonFable.', available: false },
  { to: '/housing', icon: House, label: 'Housing & House Items', desc: 'Home is where the monsters are. Better get some stuff to make it more comfy.', available: false },
  { to: '/locations', icon: Map, label: 'Locations / Quests / Events', desc: 'All the different places in DF — shops, access areas, battlezones and Special Event entries.', available: false },
  { to: '/monsters', icon: Skull, label: 'Monsters', desc: 'All the creepy, crawly, cute or scary monsters that you face throughout DragonFable.', available: false },
  { to: '/npcs', icon: Users, label: 'NPCs', desc: 'All those people who talk to you in the game? Put them here.', available: false },
  { to: '/pets', icon: PawPrint, label: 'Pets / Guests', desc: 'The people (or pets) who will help you in your battles.', available: true },
  { to: '/items', icon: Package, label: 'Stackable / Non-Equippable Items', desc: 'If it\'s a resource, stackable item, or non-equippable item, you\'ll find it here.', available: false },
  { to: '/weapons', icon: Sword, label: 'Weapons', desc: 'If you hit with it, throw it, or use it to multiply spell energy, put it here.', available: false },
]

export default function HomePage() {
  const accessoryCount = useTotalAccessoryCount()
  const badgeCount = useTotalBadgeCount()
  const petCount = useTotalPetCount()

  return (
    <main className="px-4 sm:px-6 py-8 max-w-2xl mx-auto">
      {/* Hero */}
      <div className="mb-8 text-center">
        <img
          src="https://raw.githubusercontent.com/DF-Pedia/DF-Pedia/master/tags_banners/Header-DFLogo.png"
          alt="DragonFable"
          className="h-16 mx-auto mb-4 object-contain"
        />
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

      {/* Section grid — single column, full width */}
      <div className="grid grid-cols-1 gap-3">
        {SECTIONS.map(({ to, icon: Icon, label, desc, available }) =>
          available ? (
            <Link
              key={to}
              to={to}
              className="flex items-start gap-3 bg-bg-surface border border-gold/30 rounded-lg p-4 hover:bg-bg-elevated hover:border-gold/60 transition-all duration-200 group shadow-subtle hover:shadow-medium"
            >
              <div className="bg-gold/15 rounded-lg p-2.5 flex-shrink-0 mt-0.5 group-hover:bg-gold/25 transition-colors duration-200">
                <Icon className="w-5 h-5 text-gold" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-text-primary text-sm leading-snug">
                  {label}
                  {to === '/badges' && (
                    <span className="ml-1.5 text-xs font-normal text-text-muted">({badgeCount})</span>
                  )}
                  {to === '/pets' && (
                    <span className="ml-1.5 text-xs font-normal text-text-muted">({petCount})</span>
                  )}
                  {to === '/accessories' && (
                    <span className="ml-1.5 text-xs font-normal text-text-muted">({accessoryCount})</span>
                  )}
                </div>
                <div className="text-text-secondary text-xs mt-1 leading-relaxed">{desc}</div>
              </div>
            </Link>
          ) : (
            <div
              key={to}
              className="flex items-start gap-3 bg-bg-surface/40 border border-border-subtle rounded-lg p-4 opacity-50 cursor-not-allowed"
            >
              <div className="bg-bg-overlay rounded-lg p-2.5 flex-shrink-0 mt-0.5">
                <Icon className="w-5 h-5 text-text-muted" />
              </div>
              <div className="min-w-0">
                <div className="font-medium text-text-secondary text-sm leading-snug">{label}</div>
                <div className="text-text-muted text-xs mt-1 leading-relaxed">{desc}</div>
              </div>
            </div>
          )
        )}
      </div>
    </main>
  )
}
