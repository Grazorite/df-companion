import type { ReactNode } from 'react'
import Navigation from './Navigation'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col lg:flex-row">
      <Navigation />
      {/* bottom nav padding on mobile, none on desktop */}
      <div className="flex-1 pb-16 lg:pb-0 min-w-0">
        {children}
      </div>
    </div>
  )
}
