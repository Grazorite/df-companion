import { useLocation } from 'react-router-dom'
import type { Pet } from '../../types/pet'
import type { ItemFamily } from '../../types/item'
import PetCard from './PetCard'
import { BadgeGridSkeleton } from '../shared/LoadingSkeleton'

interface PetListProps {
  pets: (Pet | ItemFamily)[]
  loading?: boolean
}

function isItemFamily(item: Pet | ItemFamily): item is ItemFamily {
  return 'levelVariants' in item && 'familyName' in item
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
      {pets.map(item => {
        const isFamily = isItemFamily(item)
        const pet = isFamily ? null : (item as Pet)
        const family = isFamily ? (item as ItemFamily) : null
        
        const id = isFamily ? family!.id : pet!.id
        const slug = isFamily ? family!.slug : pet!.slug
        const type = isFamily ? family!.type : pet!.type
        const section = type === 'pet' ? 'pets' : 'guests'
        
        // For rendering, we need a Pet object for the card
        // If family, create a minimal Pet from first level variant
        const displayPet: Pet = isFamily ? {
          ...pet!,
          id: family!.id,
          name: family!.levelVariants[0].name,
          slug: family!.slug,
          type: family!.type as 'pet' | 'guest',
          description: family!.shared.description,
          daRequired: family!.hasDA,
          dcRequired: family!.hasDC,
          dmRequired: family!.hasDM,
          elements: family!.elements,
          traits: [],
          level: family!.levelRange,
          damage: family!.levelVariants[0].damage,
          stats: family!.levelVariants[0].stats,
          resists: family!.levelVariants[0].resists ?? family!.shared.resists ?? 'None',
          obtainMethods: family!.levelVariants[0].obtainVariants.map(ov => ({
            location: ov.location,
            price: ov.price,
            priceType: ov.priceType,
            requiredItems: ov.requiredItems,
            sellback: ov.sellback ?? '0 Gold',
          })),
          attacks: family!.shared.attacks ?? [],
          rarity: family!.levelVariants[0].rarity ?? family!.shared.rarity ?? '1',
          evolutions: [],
          releaseDate: family!.releaseDate ?? '',
          imageUrl: family!.shared.imageUrl,
          forumUrl: family!.forumUrl,
          notes: family!.shared.notes,
          alsoSee: family!.shared.alsoSee?.map(ref => ({
            name: ref.name,
            slug: ref.slug,
            type: ref.type as 'pet' | 'guest',
          })) ?? [],
          tags: family!.tags,
        } : pet!
        
        return (
          <li key={id}>
            <PetCard
              pet={displayPet}
              family={isFamily ? family! : undefined}
              toUrl={`/${section}/${slug}?from=${encodeURIComponent(fromUrl)}`}
            />
          </li>
        )
      })}
    </ul>
  )
}
