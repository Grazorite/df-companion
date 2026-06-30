import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import { BadgeGridSkeleton } from './components/shared/LoadingSkeleton'

const HomePage = lazy(() => import('./pages/HomePage'))
const BadgesPage = lazy(() => import('./pages/BadgesPage'))
const BadgeDetailPage = lazy(() => import('./pages/BadgeDetailPage'))
const PetsPage = lazy(() => import('./pages/PetsPage'))
const PetDetailPage = lazy(() => import('./pages/PetDetailPage'))
const GuestDetailPage = lazy(() => import('./pages/GuestDetailPage'))
const ComingSoonPage = lazy(() => import('./pages/ComingSoonPage'))

function PageLoader() {
  return (
    <div className="px-4 py-6 max-w-5xl mx-auto">
      <div className="h-8 bg-bg-surface rounded w-32 mb-2 animate-pulse" />
      <div className="h-4 bg-bg-surface rounded w-64 mb-6 animate-pulse" />
      <BadgeGridSkeleton count={6} />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/badges" element={<BadgesPage />} />
            <Route path="/badges/:slug" element={<BadgeDetailPage />} />
            <Route path="/pets" element={<PetsPage />} />
            <Route path="/pets/:slug" element={<PetDetailPage />} />
            <Route path="/guests/:slug" element={<GuestDetailPage />} />
            <Route path="/accessories" element={<ComingSoonPage />} />
            <Route path="/classes" element={<ComingSoonPage />} />
            <Route path="/housing" element={<ComingSoonPage />} />
            <Route path="/locations" element={<ComingSoonPage />} />
            <Route path="/monsters" element={<ComingSoonPage />} />
            <Route path="/npcs" element={<ComingSoonPage />} />
            <Route path="/items" element={<ComingSoonPage />} />
            <Route path="/weapons" element={<ComingSoonPage />} />
            <Route path="*" element={<ComingSoonPage />} />
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  )
}
