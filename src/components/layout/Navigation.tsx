import { NavLink, useLocation } from 'react-router-dom'
import { useState } from 'react'
import {
  Trophy,
  Map,
  Skull,
  Home,
  Sword,
  Users,
  Shirt,
  House,
  Package,
  PawPrint,
  Sparkles,
  MoreHorizontal,
} from 'lucide-react'
import { useTotalBadgeCount } from '../../hooks/useBadges'
import { useTotalPetCount } from '../../hooks/usePets'
import { useTotalAccessoryCount } from '../../hooks/useAccessories'
import { useTotalWeaponCount } from '../../hooks/useWeapons'
import { useTotalHousingCount } from '../../hooks/useHousing'
import { useTotalClassAbilityCount } from '../../hooks/useClassAbilities'

// Mirrors the DF Encyclopedia forum structure exactly:
// https://forums2.battleon.com/f/tt.asp?forumid=256
const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Home', exact: true, available: true },
  { to: '/accessories', icon: Shirt, label: 'Accessories', exact: false, available: true },
  { to: '/badges', icon: Trophy, label: 'Badges', exact: false, available: true },
  { to: '/classes', icon: Sparkles, label: 'Classes / Abilities', exact: false, available: true },
  { to: '/housing', icon: House, label: 'Housing', exact: false, available: true },
  { to: '/locations', icon: Map, label: 'Locations / Quests', exact: false, available: false },
  { to: '/monsters', icon: Skull, label: 'Monsters', exact: false, available: false },
  { to: '/npcs', icon: Users, label: 'NPCs', exact: false, available: false },
  { to: '/pets', icon: PawPrint, label: 'Pets / Guests', exact: false, available: true },
  { to: '/items', icon: Package, label: 'Stackable Items', exact: false, available: false },
  { to: '/weapons', icon: Sword, label: 'Weapons', exact: false, available: true },
]

export default function Navigation() {
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const badgeCount = useTotalBadgeCount()
  const petCount = useTotalPetCount()
  const accessoryCount = useTotalAccessoryCount()
  const weaponCount = useTotalWeaponCount()
  const housingCount = useTotalHousingCount()
  const classAbilityCount = useTotalClassAbilityCount()

  const isNavItemActive = (to: string, exact: boolean) => {
    if (to === '/accessories') {
      return (
        location.pathname === '/accessories' ||
        [
          '/artifacts',
          '/belts',
          '/bracers',
          '/capes-wings',
          '/helms',
          '/necklaces',
          '/rings',
          '/trinkets',
        ].some((route) => location.pathname === route || location.pathname.startsWith(`${route}/`))
      )
    }

    if (to === '/housing') {
      return (
        location.pathname === '/housing' ||
        ['/houses', '/backgrounds', '/floors', '/rugs', '/shrubs', '/stuff', '/wall-items'].some(
          (route) => location.pathname === route || location.pathname.startsWith(`${route}/`)
        )
      )
    }

    if (exact) return location.pathname === to
    return location.pathname === to || location.pathname.startsWith(`${to}/`)
  }

  const mobilePrimaryItems = NAV_ITEMS.filter((item) =>
    ['/', '/accessories', '/badges', '/pets'].includes(item.to)
  )
  const moreItems = NAV_ITEMS.filter(
    (item) => !mobilePrimaryItems.some((primary) => primary.to === item.to)
  )
  const moreActive = moreItems.some((item) => isNavItemActive(item.to, item.exact))

  function getCountForPath(to: string): number | undefined {
    if (to === '/accessories') return accessoryCount
    if (to === '/badges') return badgeCount
    if (to === '/classes') return classAbilityCount
    if (to === '/housing') return housingCount
    if (to === '/pets') return petCount
    if (to === '/weapons') return weaponCount
    return undefined
  }

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <nav
        className="hidden lg:flex flex-col w-64 flex-shrink-0 bg-bg-elevated border-r border-border-default h-screen sticky top-0 overflow-y-auto p-4"
        aria-label="Main navigation"
      >
        {/* App title */}
        <div className="mb-6 px-2 flex items-center gap-2.5">
          <img
            src="https://media.artix.com/encyc/df/tags/DA.png"
            alt="DragonFable logo"
            className="w-8 h-8 object-contain flex-shrink-0"
          />
          <div>
            <span className="text-gold font-bold text-lg tracking-tight">DF Companion</span>
            <p className="text-text-muted text-xs mt-0.5">A DragonFable Reference</p>
          </div>
        </div>

        <ul className="space-y-0.5 flex-1" role="list">
          {NAV_ITEMS.map(({ to, icon: Icon, label, exact, available }) => (
            <li key={to}>
              {available ? (
                <NavLink
                  to={to}
                  end={exact}
                  className={`flex items-center gap-3 pl-2 pr-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                    isNavItemActive(to, exact)
                      ? 'border-l-[3px] border-gold bg-gold/10 text-gold font-medium pl-[5px]'
                      : 'border-l-[3px] border-transparent text-text-secondary hover:text-text-primary hover:bg-bg-overlay/60 pl-[5px]'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                  <span className="flex-1">{label}</span>
                  {to === '/accessories' && (
                    <span className="text-xs text-text-muted tabular-nums">{accessoryCount}</span>
                  )}
                  {to === '/badges' && (
                    <span className="text-xs text-text-muted tabular-nums">{badgeCount}</span>
                  )}
                  {to === '/pets' && (
                    <span className="text-xs text-text-muted tabular-nums">{petCount}</span>
                  )}
                  {to === '/classes' && (
                    <span className="text-xs text-text-muted tabular-nums">
                      {classAbilityCount}
                    </span>
                  )}
                  {to === '/weapons' && (
                    <span className="text-xs text-text-muted tabular-nums">{weaponCount}</span>
                  )}
                  {to === '/housing' && (
                    <span className="text-xs text-text-muted tabular-nums">{housingCount}</span>
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
        {moreOpen && (
          <div className="absolute inset-x-3 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px)+0.5rem)] rounded-lg border border-border-default bg-bg-elevated shadow-prominent overflow-hidden">
            <div className="grid grid-cols-2 gap-1 p-2">
              {moreItems.map(({ to, icon: Icon, label, exact, available }) =>
                available ? (
                  <NavLink
                    key={to}
                    to={to}
                    end={exact}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs transition-colors ${
                      isNavItemActive(to, exact)
                        ? 'bg-gold/10 text-gold font-medium'
                        : 'text-text-secondary hover:bg-bg-overlay hover:text-text-primary'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                    {getCountForPath(to) !== undefined && (
                      <span className="text-[10px] text-text-muted tabular-nums">
                        {getCountForPath(to)}
                      </span>
                    )}
                  </NavLink>
                ) : (
                  <div
                    key={to}
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-text-muted opacity-40"
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                    <span className="text-[10px]">Soon</span>
                  </div>
                )
              )}
            </div>
          </div>
        )}
        <ul className="flex h-14" role="list">
          {mobilePrimaryItems.map(({ to, icon: Icon, label, exact, available }) => (
            <li key={to} className="flex-1">
              {available ? (
                <NavLink
                  to={to}
                  end={exact}
                  onClick={() => setMoreOpen(false)}
                  className={() =>
                    `relative flex flex-col items-center justify-center h-full gap-0.5 transition-colors duration-150 ${
                      isNavItemActive(to, exact)
                        ? 'text-gold'
                        : 'text-text-muted active:text-text-secondary'
                    }`
                  }
                >
                  {() => (
                    <>
                      {isNavItemActive(to, exact) && (
                        <span className="absolute top-0 inset-x-2 h-0.5 bg-gold rounded-b-full" />
                      )}
                      <Icon className="w-5 h-5" aria-hidden="true" />
                      <span className="text-[10px] leading-none truncate px-1">
                        {label.split(' /')[0]}
                      </span>
                    </>
                  )}
                </NavLink>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-0.5 text-text-muted opacity-40 cursor-not-allowed">
                  <Icon className="w-5 h-5" aria-hidden="true" />
                  <span className="text-[10px] leading-none truncate px-1">
                    {label.split(' /')[0]}
                  </span>
                </div>
              )}
            </li>
          ))}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen((open) => !open)}
              aria-expanded={moreOpen}
              aria-label="More sections"
              className={`relative flex h-full w-full flex-col items-center justify-center gap-0.5 transition-colors duration-150 ${
                moreActive || moreOpen ? 'text-gold' : 'text-text-muted active:text-text-secondary'
              }`}
            >
              {(moreActive || moreOpen) && (
                <span className="absolute top-0 inset-x-2 h-0.5 bg-gold rounded-b-full" />
              )}
              <MoreHorizontal className="w-5 h-5" aria-hidden="true" />
              <span className="text-[10px] leading-none truncate px-1">More</span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  )
}
