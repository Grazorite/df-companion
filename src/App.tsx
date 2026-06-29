import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { Trophy, Scroll, Map, Skull, Package, Home } from 'lucide-react'

const HomePage = lazy(() => import('./pages/HomePage'))
const BadgesPage = lazy(() => import('./pages/BadgesPage'))
const BadgeDetailPage = lazy(() => import('./pages/BadgeDetailPage'))
const ComingSoonPage = lazy(() => import('./pages/ComingSoonPage'))

const navItems = [
  { to: '/', icon: Home, label: 'Home', exact: true },
  { to: '/badges', icon: Trophy, label: 'Badges', exact: false },
  { to: '/quests', icon: Scroll, label: 'Quests', exact: false },
  { to: '/locations', icon: Map, label: 'Locations', exact: false },
  { to: '/monsters', icon: Skull, label: 'Monsters', exact: false },
  { to: '/items', icon: Package, label: 'Items', exact: false },
]

const availablePaths = ['/', '/badges']

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20 text-slate-500 text-sm">
      Loading...
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-900 text-white flex flex-col lg:flex-row">
        {/* Desktop sidebar */}
        <nav
          className="hidden lg:flex flex-col w-60 flex-shrink-0 bg-slate-950 border-r border-slate-800 min-h-screen sticky top-0 p-4"
          aria-label="Main navigation"
        >
          <div className="mb-6 px-2">
            <span className="text-amber-400 font-bold text-lg">DF Companion</span>
          </div>
          <ul className="space-y-1 flex-1">
            {navItems.map(({ to, icon: Icon, label, exact }) => (
              <li key={to}>
                {availablePaths.includes(to) ? (
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
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {label}
                  </NavLink>
                ) : (
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-600 cursor-not-allowed">
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span>{label}</span>
                    <span className="ml-auto text-xs text-slate-700">Soon</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </nav>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-h-screen pb-16 lg:pb-0">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/badges" element={<BadgesPage />} />
              <Route path="/badges/:slug" element={<BadgeDetailPage />} />
              <Route path="/quests" element={<ComingSoonPage />} />
              <Route path="/locations" element={<ComingSoonPage />} />
              <Route path="/monsters" element={<ComingSoonPage />} />
              <Route path="/items" element={<ComingSoonPage />} />
              <Route path="*" element={<ComingSoonPage />} />
            </Routes>
          </Suspense>
        </div>

        {/* Mobile bottom nav */}
        <nav
          className="lg:hidden fixed bottom-0 inset-x-0 bg-slate-950 border-t border-slate-800 z-50"
          aria-label="Main navigation"
        >
          <ul className="flex h-14">
            {navItems.map(({ to, icon: Icon, label, exact }) => (
              <li key={to} className="flex-1">
                {availablePaths.includes(to) ? (
                  <NavLink
                    to={to}
                    end={exact}
                    className={({ isActive }) =>
                      `flex flex-col items-center justify-center h-full gap-0.5 text-xs transition-colors ${
                        isActive ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'
                      }`
                    }
                  >
                    <Icon className="w-5 h-5" />
                    <span>{label}</span>
                  </NavLink>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-0.5 text-xs text-slate-700 cursor-not-allowed">
                    <Icon className="w-5 h-5" />
                    <span>{label}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </BrowserRouter>
  )
}
