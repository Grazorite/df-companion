import { useLocation } from 'react-router-dom'
import type { Pet } from '../../types/pet'
import PetCard from './PetCard'
import { BadgeGridSkeleton } from '../shared/LoadingSkeleton'

interface PetListProps {
  pets: Pet[]
  loading?: boolean
}

export default function PetList({ pets, loading = false }: PetListProps) {
  const location = useLocation()
  const fromUrl = location.pathname + location.search

  if (loading) return <BadgeGridSkeleton count={6} />

  if (pets.length === 0) {
    return (
      <div className="text-center py-16 text-text-secondary">
        <p className="text-base font-medium mb-1">No entries found</p>
        <p className="text-sm text-text-muted">Try adjusting your search or filters</p>
      </div>
    )
  }

  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" aria-label="Results">
      {pets.map(pet => {
        const section = pet.type === 'pet' ? 'pets' : 'guests'
        return (
          <li key={pet.id}>
            <PetCard
              pet={pet}
              toUrl={`/${section}/${pet.slug}?from=${encodeURIComponent(fromUrl)}`}
            />
          </li>
        )
      })}
    </ul>
  )
}
