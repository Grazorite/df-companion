import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Routes, Route, useLocation } from 'react-router-dom'
import Layout from './components/layout/Layout'
import { BadgeGridSkeleton, DetailPageSkeleton } from './components/shared/LoadingSkeleton'
import NavigationContinuity from './components/shared/NavigationContinuity'
import { ACCESSORY_SUBTYPES } from './types/accessory'
import { WEAPON_SUBTYPES } from './types/weapon'
import { HOUSING_SUBTYPES } from './types/housing'
import { CLASS_ABILITY_SUBTYPES } from './types/classAbility'
import { isDetailRoutePath } from './utils/navigationContext'

const HomePage = lazy(() => import('./pages/HomePage'))
const BadgesPage = lazy(() => import('./pages/BadgesPage'))
const BadgeDetailPage = lazy(() => import('./pages/BadgeDetailPage'))
const PetsPage = lazy(() => import('./pages/PetsPage'))
const PetDetailPage = lazy(() => import('./pages/PetDetailPage'))
const GuestDetailPage = lazy(() => import('./pages/GuestDetailPage'))
const AccessoryListPage = lazy(() => import('./pages/AccessoryListPage'))
const AccessoryDetailPage = lazy(() => import('./pages/AccessoryDetailPage'))
const WeaponListPage = lazy(() => import('./pages/WeaponListPage'))
const WeaponDetailPage = lazy(() => import('./pages/WeaponDetailPage'))
const HousingListPage = lazy(() => import('./pages/HousingListPage'))
const HousingDetailPage = lazy(() => import('./pages/HousingDetailPage'))
const ClassAbilityListPage = lazy(() => import('./pages/ClassAbilityListPage'))
const ClassAbilityDetailPage = lazy(() => import('./pages/ClassAbilityDetailPage'))
const ComingSoonPage = lazy(() => import('./pages/ComingSoonPage'))

function PageLoader() {
  const { pathname } = useLocation()

  if (isDetailRoutePath(pathname)) {
    return <DetailPageSkeleton />
  }

  return (
    <main className="px-4 py-6 max-w-5xl mx-auto">
      <div className="h-8 bg-bg-surface rounded w-32 mb-2 animate-pulse" />
      <div className="h-4 bg-bg-surface rounded w-64 mb-6 animate-pulse" />
      <BadgeGridSkeleton count={6} />
    </main>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <NavigationContinuity />
      <Layout>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/badges" element={<BadgesPage />} />
            <Route path="/badges/:slug" element={<BadgeDetailPage />} />
            <Route path="/pets" element={<PetsPage />} />
            <Route path="/pets/:slug" element={<PetDetailPage />} />
            <Route path="/guests/:slug" element={<GuestDetailPage />} />
            <Route path="/accessories" element={<AccessoryListPage />} />
            <Route path="/accessories/:slug" element={<AccessoryDetailPage />} />
            {ACCESSORY_SUBTYPES.map((meta) => (
              <Route
                key={meta.route}
                path={meta.route}
                element={
                  <Navigate to={`/accessories?type=${encodeURIComponent(meta.subtype)}`} replace />
                }
              />
            ))}
            <Route path="/housing" element={<HousingListPage />} />
            <Route path="/housing/:slug" element={<HousingDetailPage />} />
            {HOUSING_SUBTYPES.map((meta) => (
              <Route
                key={meta.route}
                path={meta.route}
                element={
                  <Navigate to={`/housing?type=${encodeURIComponent(meta.subtype)}`} replace />
                }
              />
            ))}
            <Route path="/weapons" element={<WeaponListPage />} />
            <Route path="/weapons/:slug" element={<WeaponDetailPage />} />
            {WEAPON_SUBTYPES.map((meta) => (
              <Route
                key={meta.route}
                path={meta.route}
                element={
                  <Navigate to={`/weapons?type=${encodeURIComponent(meta.subtype)}`} replace />
                }
              />
            ))}
            <Route path="/classes" element={<ClassAbilityListPage />} />
            <Route path="/classes/:slug" element={<ClassAbilityDetailPage />} />
            {CLASS_ABILITY_SUBTYPES.map((meta) => (
              <Route
                key={meta.route}
                path={meta.route}
                element={
                  <Navigate to={`/classes?type=${encodeURIComponent(meta.subtype)}`} replace />
                }
              />
            ))}
            <Route path="/locations" element={<ComingSoonPage />} />
            <Route path="/monsters" element={<ComingSoonPage />} />
            <Route path="/npcs" element={<ComingSoonPage />} />
            <Route path="/items" element={<ComingSoonPage />} />
            <Route path="*" element={<ComingSoonPage />} />
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  )
}
