import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ExternalLink, Shield, ImageOff } from 'lucide-react'
import type { Pet, Guest } from '../../types/pet'
import type { ItemFamily } from '../../types/item'
import { isSingleVariant } from '../../utils/variantHelpers'
import ElementPill from '../shared/ElementPill'
import AccessPills from '../shared/AccessPills'
import NotesList from '../shared/NotesList'
import LevelStatsTable from '../shared/LevelStatsTable'
import LevelSelector from '../shared/LevelSelector'
import ObtainVariantCard from '../shared/ObtainVariantCard'
import PetAttacks from './PetAttacks'
import GuestAttacks from '../guests/GuestAttacks'
import GuestStatsSection from '../guests/GuestStatsSection'
import PetEvolutions from './PetEvolutions'
import PetCard from './PetCard'
import { useRelatedPets } from '../../hooks/usePets'

interface PetDetailProps {
  pet: Pet
  backUrl: string
  // Optional: ItemFamily for multi-variant display
  family?: ItemFamily
}

function PetImage({ src, name }: { src: string; name: string }) {
  const [broken, setBroken] = useState(false)
  if (broken) {
    return (
      <div className="w-full max-w-xs mx-auto aspect-square bg-bg-elevated border border-border-default rounded-xl flex flex-col items-center justify-center gap-2 text-text-muted">
        <ImageOff className="w-10 h-10" />
        <span className="text-xs">Image unavailable</span>
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={`${name}`}
      loading="lazy"
      onError={() => setBroken(true)}
      className="max-w-xs w-full mx-auto rounded-xl border border-border-default shadow-medium img-fade"
    />
  )
}

export default function PetDetail({ pet, backUrl, family }: PetDetailProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const dcRequired = pet.dcRequired ?? false
  const dmRequired = pet.dmRequired ?? false
  
  // Check if this is a guest
  const isGuest = pet.type === 'guest'
  const guest = isGuest ? (pet as unknown as Guest) : undefined
  
  // Alternative image toggle state
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  
  // Determine if we're using multi-variant display
  const isMultiVariant = family && !isSingleVariant(family)
  
  // Parse level URL param for multi-variant display
  const levelParam = searchParams.get('level')
  const activeIndex = useMemo(() => {
    if (!isMultiVariant || !family || !levelParam) return 0
    
    // Try to match by levelNumber, levelDisplay, or name
    const idx = family.levelVariants.findIndex(
      lv =>
        String(lv.levelNumber) === levelParam ||
        lv.levelDisplay.toLowerCase() === levelParam.toLowerCase() ||
        lv.name.toLowerCase().includes(levelParam.toLowerCase())
    )
    return idx >= 0 ? idx : 0
  }, [levelParam, isMultiVariant, family])
  
  // Handler for level selection
  const handleLevelChange = (index: number) => {
    if (!family) return
    setSearchParams(
      prev => {
        prev.set('level', String(family.levelVariants[index].levelNumber))
        return prev
      },
      { replace: true }
    )
  }
  
  // Use shared data if available, otherwise fall back to Pet data
  const displayData = family ? {
    description: family.shared.description,
    imageUrl: family.shared.imageUrl,
    alternativeImages: family.shared.alternativeImages,
    element: family.shared.element,
    resists: family.shared.resists,
    rarity: family.shared.rarity,
    attacks: family.shared.attacks,
    notes: family.shared.notes,
    alsoSee: family.shared.alsoSee,
  } : {
    description: pet.description,
    imageUrl: pet.imageUrl,
    alternativeImages: pet.alternativeImages,
    element: pet.elements[0],
    resists: pet.resists,
    rarity: pet.rarity,
    attacks: pet.attacks,
    notes: pet.notes,
    alsoSee: pet.alsoSee,
  }
  
  // Use displayData.alsoSee for related pets (works for both single and multi-variant)
  const relatedPets = useRelatedPets(displayData.alsoSee ?? [])
  
  // Build array of all images (main + alternatives)
  const allImages: Array<{ url: string; caption: string }> = []
  if (displayData.imageUrl) {
    allImages.push({ url: displayData.imageUrl, caption: 'Main Image' })
  }
  if (displayData.alternativeImages) {
    allImages.push(...displayData.alternativeImages)
  }
  
  // Currently displayed image
  const currentImage = allImages[activeImageIndex]

  // Strip everything from "Thanks to" onwards — attribution lines, not content
  const cleanedNotes = displayData.notes
    ? (() => {
        // Handle both newline-separated (new) and " • "-separated (legacy) formats
        const separator = displayData.notes.includes('\n') ? '\n' : ' • '
        const bullets = displayData.notes.split(separator)
        const cutoff = bullets.findIndex(n => /^Thanks\s+to\b/i.test(n.trim()))
        const kept = cutoff >= 0 ? bullets.slice(0, cutoff) : bullets
        const result = kept.filter(n => n.trim().length > 0).join(separator)
        return result || undefined
      })()
    : undefined

  const stats = [
    { label: 'Level', value: pet.level },
    { label: 'Damage', value: pet.damage },
    { label: 'Stats', value: pet.stats },
    { label: 'Resists', value: pet.resists },
    { label: 'Rarity', value: pet.rarity },
  ].filter(s => s.value && s.value !== 'Unknown' && s.value !== 'None' || s.label === 'Level')

  return (
    <main className="px-4 sm:px-6 py-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        {/* Meta pills */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          {pet.elements.map(code => (
            <ElementPill key={code} code={code} size="md" clickable />
          ))}
          {pet.traits.map(code => (
            <ElementPill key={code} code={code} size="md" />
          ))}
          <AccessPills daRequired={pet.daRequired} dcRequired={dcRequired} dmRequired={dmRequired} filterBase="/pets" />
          
          {/* Multiple Versions pill for multi-variant items */}
          {isMultiVariant && family && (
            <span className="inline-block text-xs font-semibold px-3 py-1.5 rounded-full bg-gold-bright text-bg-base cursor-default">
              Multiple Versions
            </span>
          )}
          
          <span className="inline-block text-xs font-medium px-2.5 py-1 rounded-full bg-bg-overlay text-text-muted capitalize ml-auto">
            {pet.type}
          </span>
        </div>

        {/* Display family name with level range for multi-variant, regular name for single */}
        <h1 className="text-2xl font-bold text-text-primary mb-2">
          {isMultiVariant && family ? (
            family.isMultiPost ? family.familyName : `${family.familyName} (${family.levelRange})`
          ) : pet.name}
        </h1>
        <p className="text-text-secondary text-sm italic leading-relaxed mb-2">{displayData.description}</p>

        {pet.releaseDate && pet.releaseDate !== 'Unknown' && (
          <p className="text-text-muted text-xs">Released: {pet.releaseDate}</p>
        )}
      </div>

      {/* Pet image */}
      {currentImage ? (
        <div className="mb-6">
          <PetImage src={currentImage.url} name={pet.name} />
          {/* Image toggle - only show if multiple images exist */}
          {allImages.length > 1 && (
            <div className="max-w-xs mx-auto mt-2">
              <div className="flex gap-2 justify-center">
                {allImages.map((_image, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${
                      idx === activeImageIndex
                        ? 'bg-gold text-bg-base font-medium'
                        : 'bg-bg-overlay text-text-secondary hover:bg-bg-elevated'
                    }`}
                  >
                    {idx === 0 ? 'Main' : `Alt ${idx}`}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="mb-6 w-full max-w-xs mx-auto aspect-square bg-bg-elevated border border-border-default rounded-xl flex items-center justify-center">
          <Shield className="w-16 h-16 text-border-hover" aria-hidden="true" />
        </div>
      )}

      {/* Stats - show for single-variant items in table format (Pets only) */}
      {!isMultiVariant && !isGuest && stats.length > 0 && (
        <section className="mb-5">
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle px-4 sm:px-0">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="border-b border-border-default">
                    <th className="sticky left-0 bg-bg-base px-4 py-2 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
                      Level
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
                      Damage
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
                      {/* Dynamic header based on statsType from pet data */}
                      {pet.statsType === 'bonuses' ? 'Bonuses' : "Pet's Stats"}
                    </th>
                    <th className="px-4 py-2 text-center" title="Dragon Amulet Required">
                      <img 
                        src="https://github.com/DF-Pedia/DF-Pedia/blob/master/tags_banners/Banner-DragonAmulet.png?raw=true" 
                        alt="DA" 
                        className="w-4 h-4 mx-auto"
                      />
                    </th>
                    <th className="px-4 py-2 text-center" title="Dragon Coins">
                      <img 
                        src="https://github.com/DF-Pedia/DF-Pedia/blob/master/weapons/DragonCoin.png?raw=true" 
                        alt="DC" 
                        className="w-4 h-4 mx-auto"
                      />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default">
                  <tr className="hover:bg-bg-surface transition-colors">
                    <td className="sticky left-0 bg-bg-base hover:bg-bg-surface transition-colors px-4 py-3 text-sm text-text-secondary font-medium">
                      {pet.level}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary whitespace-pre-line">
                      {pet.damage}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {pet.stats}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {pet.daRequired ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-gold text-bg-base text-xs font-bold">
                          ✓
                        </span>
                      ) : (
                        <span className="text-text-muted text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {dcRequired ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-amber-500 text-white text-xs font-bold">
                          ✓
                        </span>
                      ) : (
                        <span className="text-text-muted text-xs">—</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
      
      {/* Guest Stats Section - show for guests */}
      {isGuest && guest?.guestStats && (
        <GuestStatsSection stats={guest.guestStats} />
      )}
      
      {/* Level Stats Table - only for multi-variant items */}
      {isMultiVariant && family && (
        <section className="mb-5">
          <LevelStatsTable 
            levels={family.levelVariants}
            hideVariantColumn={
              // Hide variant column if all levelDisplay values match levelNumber (no roman numerals)
              family.levelVariants.every(lv => lv.levelDisplay === lv.levelNumber.toString())
            }
          />
        </section>
      )}
      
      {/* Level selector and rarity - only for multi-variant items */}
      {isMultiVariant && family && family.levelVariants.length > 1 && (
        <section className="mb-5">
          <LevelSelector
            levels={family.levelVariants}
            activeIndex={activeIndex}
            onChange={handleLevelChange}
          />
        </section>
      )}
      
      {/* Rarity - positioned after level selector for multi-variants, after stats for single */}
      {(() => {
        // For multi-variant, use level-specific rarity; for single, use pet rarity
        const displayRarity = isMultiVariant && family 
          ? family.levelVariants[activeIndex].rarity || family.shared.rarity
          : pet.rarity || family?.shared.rarity
        
        if (!displayRarity || displayRarity === 'Unknown') return null
        
        return (
          <section aria-labelledby="rarity-heading" className="mb-5">
            <h2 id="rarity-heading" className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
              Rarity
            </h2>
            <div className="flex gap-2">
              <span className="inline-block text-sm px-3 py-1.5 rounded-md bg-bg-overlay text-text-secondary border border-border-default">
                {displayRarity}
              </span>
            </div>
          </section>
        )
      })()}

      {/* How to Obtain */}
      {isMultiVariant && family ? (
        /* Multi-variant obtain section */
        <section aria-labelledby="obtain-heading" className="mb-5 space-y-4">
          {/* Obtain cards for selected level */}
          <div className="space-y-3">
            {family.levelVariants[activeIndex].obtainVariants.map((variant, i) => {
              // Determine label based on number of variants
              const label =
                family.levelVariants[activeIndex].obtainVariants.length > 1
                  ? variant.priceType === 'free'
                    ? 'Free Option'
                    : variant.priceType === 'dc'
                      ? 'DC Option'
                      : variant.priceType === 'dm'
                        ? 'DM Option'
                        : `Method ${i + 1}`
                  : undefined
              
              return (
                <ObtainVariantCard
                  key={i}
                  variant={variant}
                  label={label}
                  isGuest={isGuest}
                />
              )
            })}
          </div>
        </section>
      ) : pet.obtainMethods.length > 0 ? (
        /* Single-variant obtain section - use standardized format */
        <section aria-labelledby="obtain-heading" className="mb-5">
          <div className="space-y-3">
            {pet.obtainMethods.map((method, i) => {
              const obtainVariant = {
                location: method.location,
                price: method.price,
                priceType: method.priceType,
                sellback: method.sellback,
                // Use ONLY per-method flags - do NOT fall back to pet-level flags
                // Per-method flags are authoritative; pet-level flags are just summaries
                daRequired: method.daRequired ?? false,
                ...(method.dcRequired ? { dcRequired: method.dcRequired } : {}),
                ...(method.dmRequired ? { dmRequired: method.dmRequired } : {}),
                ...(method.requiredItems ? { requiredItems: method.requiredItems } : {}),
              }
              
              const label = pet.obtainMethods.length > 1 ? `Method ${i + 1}` : undefined
              
              return (
                <ObtainVariantCard
                  key={i}
                  variant={obtainVariant}
                  label={label}
                  isGuest={isGuest}
                />
              )
            })}
          </div>
        </section>
      ) : null}

      {/* Evolutions */}
      <PetEvolutions evolutions={pet.evolutions} fromUrl={backUrl} />

      {/* Attacks - use GuestAttacks for guests, PetAttacks for pets */}
      {isGuest && guest ? (
        <GuestAttacks attacks={guest.attacks} />
      ) : (
        <PetAttacks attacks={displayData.attacks ?? []} />
      )}

      {/* Notes - show shared notes for multi-variant (always visible), and/or level-specific notes */}
      {(() => {
        // For multi-variant items
        if (isMultiVariant && family) {
          const activeLevel = family.levelVariants[activeIndex]
          
          // Clean shared notes (remove attribution)
          const cleanedSharedNotes = family.shared.notes ? (() => {
            const separator = family.shared.notes.includes('\n') ? '\n' : ' • '
            const bullets = family.shared.notes.split(separator)
            const cutoff = bullets.findIndex(n => /^Thanks\s+to\b/i.test(n.trim()))
            const kept = cutoff >= 0 ? bullets.slice(0, cutoff) : bullets
            const result = kept.filter(n => n.trim().length > 0).join(separator)
            return result || undefined
          })() : undefined
          
          // Clean level-specific notes (remove attribution)
          const cleanedLevelNotes = activeLevel.notes ? (() => {
            const separator = activeLevel.notes.includes('\n') ? '\n' : ' • '
            const bullets = activeLevel.notes.split(separator)
            const cutoff = bullets.findIndex(n => /^Thanks\s+to\b/i.test(n.trim()))
            const kept = cutoff >= 0 ? bullets.slice(0, cutoff) : bullets
            const result = kept.filter(n => n.trim().length > 0).join(separator)
            return result || undefined
          })() : undefined
          
          // If neither exists, don't render
          if (!cleanedSharedNotes && !cleanedLevelNotes) return null
          
          return (
            <section className="bg-bg-surface/60 border border-border-default rounded-lg p-4 mb-5">
              <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
                Other Information
              </h2>
              {cleanedSharedNotes && <NotesList notes={cleanedSharedNotes} />}
              {cleanedSharedNotes && cleanedLevelNotes && <div className="my-3 border-t border-border-default" />}
              {cleanedLevelNotes && (
                <>
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                    Level {activeLevel.levelDisplay} Notes
                  </p>
                  <NotesList notes={cleanedLevelNotes} />
                </>
              )}
            </section>
          )
        }
        
        // For single-variant items, use cleanedNotes
        if (!cleanedNotes) return null
        
        return (
          <section className="bg-bg-surface/60 border border-border-default rounded-lg p-4 mb-5">
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
              Other Information
            </h2>
            <NotesList notes={cleanedNotes} />
          </section>
        )
      })()}

      {/* Source */}
      <section aria-labelledby="source-heading" className="mb-5">
        <h2 id="source-heading" className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
          Source
        </h2>
        <a
          href={pet.forumUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between bg-gold/10 border-l-4 border-gold rounded-lg p-4 min-h-[56px] hover:bg-gold/15 transition-colors"
        >
          <div>
            <span className="text-gold text-xs font-medium block mb-0.5">Primary Source</span>
            <span className="text-text-primary text-sm font-medium">
              DF Encyclopedia: {isMultiVariant && family ? family.familyName : pet.name}
            </span>
          </div>
          <ExternalLink className="w-4 h-4 text-text-muted flex-shrink-0 ml-3" aria-hidden="true" />
        </a>
      </section>

      {/* Tags */}
      {pet.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-8" aria-label="Tags">
          {pet.tags.map(tag => (
            <span key={tag} className="bg-bg-overlay text-text-muted text-xs px-2.5 py-1 rounded-full border border-border-subtle">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Also See — related pets from forum data */}
      {relatedPets.length > 0 && (
        <section aria-labelledby="related-heading" className="border-t border-border-default pt-6">
          <h2 id="related-heading" className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
            Also See
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {relatedPets.map(related => {
              const section = related.type === 'pet' ? 'pets' : 'guests'
              return (
                <li key={related.id}>
                  <PetCard
                    pet={related}
                    toUrl={`/${section}/${related.slug}?from=${encodeURIComponent(backUrl)}`}
                    replace
                  />
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </main>
  )
}
