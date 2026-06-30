import { useParams, useLocation, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { usePetBySlug } from '../hooks/usePets'
import PetDetail from '../components/pets/PetDetail'

export default function PetDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const location = useLocation()

  const searchParams = new URLSearchParams(location.search)
  const backUrl = searchParams.get('from') ?? '/pets'

  // Slugs are type-prefixed — ensure we look up "pet-{slug}"
  const fullSlug = slug?.startsWith('pet-') ? slug : `pet-${slug ?? ''}`
  const pet = usePetBySlug(fullSlug)

  if (!pet) {
    return (
      <main className="px-4 py-8 max-w-3xl mx-auto text-center">
        <p className="text-text-secondary text-lg mb-4">Pet not found.</p>
        <Link to="/pets" className="text-gold underline underline-offset-2 text-sm hover:text-gold-bright">
          ← Back to Pets & Guests
        </Link>
      </main>
    )
  }

  return (
    <>
      <div className="px-4 sm:px-6 pt-6 max-w-3xl mx-auto">
        <Link
          to={backUrl}
          className="flex items-center gap-1.5 text-text-secondary hover:text-text-primary text-sm mb-6 transition-colors duration-150 min-h-[44px] -ml-1 px-1"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Back to Pets & Guests
        </Link>
      </div>
      <PetDetail pet={pet} backUrl={backUrl} />
    </>
  )
}
