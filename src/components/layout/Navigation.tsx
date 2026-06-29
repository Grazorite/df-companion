import { NavLink } from 'react-router-dom'
import { Trophy, Scroll, Map, Skull, Package, Home } from 'lucide-react'
import { useTotalBadgeCount } from '../../hooks/useBadges'

const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Home', exact: true, available: true },
  { to: '/badges', icon: Trophy, label: 'Badges', exact: false, available: true },
  { to: '/quests', icon: Scroll, label: 'Quests', exact: false, available: false },
  { to: '/locations', icon: Map, label: 'Locations', exact: false, available: false },
  { to: '/monsters', icon: Skull, label: 'Monsters', exact: false, available: false },
  { to: '/items', icon: Package, label: 'Items', exact: false, available: false },
]

export default function Navigation() {
  const badgeCount = useTotalBadgeCount()

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <nav
        className="hidden lg:flex flex-col w-60 flex-shrink-0 bg-slate-950 border-r border-slate-800 min-h-screen sticky top-0 p-4"
        aria-label="Main navigation"
      >
        <div className="mb-6 px-2">
          <span className="text-amber-400 font-bold text-lg tracking-tight">DF Companion</span>
          <p className="text-slate-600 text-xs mt-0.5">DragonFable Reference</p>
        </div>

        <ul className="space-y-0.5 flex-1" role="list">
          {NAV_ITEMS.map(({ to, icon: Icon, label, exact, available }) => (
            <li key={to}>
              {available ? (
                <NavLink
                  to={to}
                  end={exact}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-amber-500/20 text-amber-400 font-medium'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                  <span className="flex-1">{label}</span>
                  {to === '/badges' && (
                    <span className="text-xs text-slate-500 tabular-nums">{badgeCount}</span>
                  )}
                </NavLink>
              ) : (
                <div
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-600 cursor-not-allowed select-none"
                  title="Coming soon"
                >
                  <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                  <span className="flex-1">{label}</span>
                  <span className="text-xs text-slate-700 bg-slate-800 px-1.5 py-0.5 rounded">
                    Soon
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-4 border-t border-slate-800 px-2">
          <p className="text-slate-700 text-xs">
            Data sourced from{' '}
            <a
              href="https://forums2.battleon.com/f/tt.asp?forumid=256"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-600 hover:text-slate-400 underline underline-offset-2 transition-colors"
            >
              DF Forums
            </a>
          </p>
        </div>
      </nav>

      {/* ── Mobile bottom tab bar ── */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 bg-slate-950 border-t border-slate-800 z-50 safe-area-pb"
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
                    `flex flex-col items-center justify-center h-full gap-0.5 transition-colors ${
                      isActive ? 'text-amber-400' : 'text-slate-500 active:text-slate-300'
                    }`
                  }
                >
                  <Icon className="w-5 h-5" aria-hidden="true" />
                  <span className="text-[10px] leading-none">{label}</span>
                </NavLink>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-0.5 text-slate-700 cursor-not-allowed">
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
