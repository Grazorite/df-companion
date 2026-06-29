import { NavLink } from 'react-router-dom'
import { Trophy, Map, Skull, Home, Sword, Users, Swords } from 'lucide-react'
import { useTotalBadgeCount } from '../../hooks/useBadges'

const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Home', exact: true, available: true },
  { to: '/badges', icon: Trophy, label: 'Badges', exact: false, available: true },
  { to: '/locations', icon: Map, label: 'Locations & Quests', exact: false, available: false },
  { to: '/classes', icon: Swords, label: 'Classes', exact: false, available: false },
  { to: '/monsters', icon: Skull, label: 'Monsters', exact: false, available: false },
  { to: '/items', icon: Sword, label: 'Weapons & Items', exact: false, available: false },
  { to: '/npcs', icon: Users, label: 'NPCs & Pets', exact: false, available: false },
]

export default function Navigation() {
  const badgeCount = useTotalBadgeCount()

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <nav
        className="hidden lg:flex flex-col w-60 flex-shrink-0 bg-bg-elevated border-r border-border-default h-screen sticky top-0 overflow-y-auto p-4"
        aria-label="Main navigation"
      >
        {/* App title */}
        <div className="mb-6 px-2">
          <span className="text-gold font-bold text-lg tracking-tight">DF Companion</span>
          <p className="text-text-muted text-xs mt-0.5">DragonFable Reference</p>
        </div>

        <ul className="space-y-0.5 flex-1" role="list">
          {NAV_ITEMS.map(({ to, icon: Icon, label, exact, available }) => (
            <li key={to}>
              {available ? (
                <NavLink
                  to={to}
                  end={exact}
                  className={({ isActive }) =>
                    `flex items-center gap-3 pl-2 pr-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                      isActive
                        ? 'border-l-[3px] border-gold bg-gold/10 text-gold font-medium pl-[5px]'
                        : 'border-l-[3px] border-transparent text-text-secondary hover:text-text-primary hover:bg-bg-overlay/60 pl-[5px]'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                  <span className="flex-1">{label}</span>
                  {to === '/badges' && (
                    <span className="text-xs text-text-muted tabular-nums">{badgeCount}</span>
                  )}
                </NavLink>
              ) : (
                <div
                  className="flex items-center gap-3 pl-[5px] pr-3 py-2.5 rounded-lg text-sm text-text-muted opacity-40 cursor-not-allowed select-none border-l-[3px] border-transparent"
                  title="Coming soon"
                >
                  <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                  <span className="flex-1">{label}</span>
                  <span className="text-xs text-text-muted bg-bg-overlay px-1.5 py-0.5 rounded">
                    Soon
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>

        {/* Forum attribution */}
        <div className="mt-auto pt-4 border-t border-border-default px-2">
          <p className="text-text-muted text-xs">
            Data from{' '}
            <a
              href="https://forums2.battleon.com/f/tt.asp?forumid=256"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-secondary hover:text-text-primary underline underline-offset-2 transition-colors"
            >
              DF Forums
            </a>
          </p>
        </div>
      </nav>

      {/* ── Mobile bottom tab bar ── */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 bg-bg-elevated border-t border-border-default z-50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-label="Main navigation"
      >
        <ul className="flex h-14" role="list">
          {NAV_ITEMS.map(({ to, icon: Icon, label, exact, available }) => (
            <li key={to} className="flex-1">
              {available ? (
                <NavLink
                  to={to}
                  end={exact}
                  className={({ isActive }) =>
                    `relative flex flex-col items-center justify-center h-full gap-0.5 transition-colors duration-150 ${
                      isActive ? 'text-gold' : 'text-text-muted active:text-text-secondary'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {/* Gold top indicator for active item */}
                      {isActive && (
                        <span className="absolute top-0 inset-x-2 h-0.5 bg-gold rounded-b-full" />
                      )}
                      <Icon className="w-5 h-5" aria-hidden="true" />
                      <span className="text-[10px] leading-none">{label}</span>
                    </>
                  )}
                </NavLink>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-0.5 text-text-muted opacity-40 cursor-not-allowed">
                  <Icon className="w-5 h-5" aria-hidden="true" />
                  <span className="text-[10px] leading-none">{label}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}
