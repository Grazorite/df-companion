import type { ReactNode } from 'react'
import Navigation from './Navigation'
import BackToTop from '../shared/BackToTop'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-bg-base text-text-primary flex flex-col lg:flex-row">
      <Navigation />
      {/* Account for mobile bottom nav (56px) + iOS safe area inset */}
      <div
        className="flex-1 lg:pb-0 min-w-0"
        style={{ paddingBottom: 'calc(56px + env(safe-area-inset-bottom, 0px))' }}
      >
        {children}
      </div>
      <BackToTop />
    </div>
  )
}
