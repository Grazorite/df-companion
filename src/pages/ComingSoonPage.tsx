import { Link } from 'react-router-dom'
import { Construction } from 'lucide-react'

export default function ComingSoonPage() {
  return (
    <main className="flex flex-col items-center justify-center px-4 py-20 text-center">
      <Construction className="w-12 h-12 text-gold mb-4" />
      <h1 className="text-2xl font-bold text-text-primary mb-2">Coming Soon</h1>
      <p className="text-text-secondary text-sm max-w-xs mb-6">
        This section is under construction. Check back later!
      </p>
      <Link
        to="/badges"
        className="bg-gold-bright hover:bg-gold text-bg-base font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors duration-150 shadow-subtle"
      >
        Browse Badges
      </Link>
    </main>
  )
}
