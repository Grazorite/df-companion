import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Shield, ImageOff } from 'lucide-react'
import type { Pet, Guest } from '../../types/pet'
import type { ItemFamily, LevelVariant } from '../../types/item'
import { getDisplayFamilyName, getLevelVariantLabels, hasSameLevelVariants, hasTitleDrivenVariantNames, isSingleVariant } from '../../utils/variantHelpers'
import { normalizeDisplayText } from '../../utils/displayText'
import ElementPill from '../shared/ElementPill'
import AccessPills from '../shared/AccessPills'
import NotesList from '../shared/NotesList'
import LevelStatsTable from '../shared/LevelStatsTable'
import LevelSelector from '../shared/LevelSelector'
import ObtainSection from '../shared/ObtainSection'
import SourceLinksCard from '../shared/SourceLinksCard'
import CollapsibleSection from '../shared/CollapsibleSection'
import MetadataChipSection from '../shared/MetadataChipSection'
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

function isItemFamily(item: Pet | ItemFamily): item is ItemFamily {
  return 'levelVariants' in item && 'familyName' in item
}

function normalizeSourceVariantLabel(label: string) {
  return normalizeDisplayText(label)
    .replace(/\s+\((?:DA|DC|D-Amulet|D-Coins?|Normal)\)$/i, '')
    .trim()
}

function buildCardPet(item: Pet | ItemFamily): Pet {
  if (!isItemFamily(item)) return item

  const firstLevel = item.levelVariants[0]

  return {
    id: item.id,
    name: firstLevel?.name ?? item.familyName,
    slug: item.slug,
    type: item.type as 'pet' | 'guest',
    description: item.shared.description,
    daRequired: item.hasDA,
    dcRequired: item.hasDC,
    dmRequired: item.hasDM,
    elements: item.elements,
    traits: [],
    level: item.levelRange,
    damage: firstLevel?.damage ?? 'Unknown',
    stats: firstLevel?.stats ?? 'None',
    resists: firstLevel?.resists ?? item.shared.resists ?? 'None',
    obtainMethods: (firstLevel?.obtainVariants ?? []).map(variant => ({
      location: variant.location,
      price: variant.price,
      priceType: variant.priceType,
      requiredItems: variant.requiredItems,
      sellback: variant.sellback ?? '0 Gold',
      requirements: variant.requirements,
      daRequired: variant.daRequired,
      dcRequired: variant.dcRequired,
      dmRequired: variant.dmRequired,
    })),
    attacks: item.type === 'guest'
      ? []
      : ((item.shared.attacks as Pet['attacks'] | undefined) ?? []),
    rarity: firstLevel?.rarity ?? item.shared.rarity ?? '1',
    evolutions: [],
    releaseDate: item.releaseDate ?? '',
    imageUrl: firstLevel?.imageUrl ?? item.shared.imageUrl,
    ...(firstLevel?.alternativeImages || item.shared.alternativeImages
      ? { alternativeImages: firstLevel?.alternativeImages ?? item.shared.alternativeImages }
      : {}),
    forumUrl: item.forumUrl,
    notes: firstLevel?.notes ?? item.shared.notes,
    alsoSee: item.shared.alsoSee?.map(ref => ({
      name: ref.name,
      slug: ref.slug,
      type: ref.type as 'pet' | 'guest',
    })) ?? [],
    tags: item.tags,
  }
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

function shouldSplitObtainVariantRows(level: LevelVariant): boolean {
  if (level.obtainVariants.length <= 1) return false
  const hasDc = level.obtainVariants.some(variant => variant.priceType === 'dc')
  const hasNonDc = level.obtainVariants.some(variant => variant.priceType !== 'dc')
  return hasDc && hasNonDc
}

function expandDisplayLevelVariants(levels: LevelVariant[]): LevelVariant[] {
  return levels
    .flatMap(level =>
      shouldSplitObtainVariantRows(level)
        ? level.obtainVariants.map(obtainVariant => ({
            ...level,
            obtainVariants: [obtainVariant],
          }))
        : [level]
    )
    .map((level, index) => ({
      ...level,
      levelNumber: index + 1,
    }))
}

export default function PetDetail({ pet, backUrl, family }: PetDetailProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  
  // Check if this is a guest
  const isGuest = pet.type === 'guest'
  const guest = isGuest ? (pet as unknown as Guest) : undefined
  
  // Alternative image toggle state
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  
  // Determine if we're using multi-variant display
  const isMultiVariant = family && !isSingleVariant(family)
  const isDragonFamily = family?.slug === 'pet-dragon'
  const displayLevels = useMemo(
    () => family ? expandDisplayLevelVariants(family.levelVariants) : [],
    [family]
  )
  const sameLevelVariants = displayLevels.length > 0 ? hasSameLevelVariants({ ...(family as ItemFamily), levelVariants: displayLevels }) : false
  const displayFamilyName = family ? getDisplayFamilyName(family) : undefined
  const useTitleDrivenVariantNames = family && displayFamilyName
    ? hasTitleDrivenVariantNames(displayLevels, displayFamilyName)
    : false
  
  // Parse level URL param for multi-variant display
  const levelParam = searchParams.get('level')
  const activeIndex = useMemo(() => {
    if (!isMultiVariant || !family || !levelParam) return 0

    const variantMatch = levelParam.match(/^variant-(\d+)$/i)
    if (variantMatch) {
      const variantNumber = Number.parseInt(variantMatch[1], 10)
      const variantIndex = displayLevels.findIndex(lv => lv.levelNumber === variantNumber)
      return variantIndex >= 0 ? variantIndex : 0
    }
    
    // Match by exact level number first, then exact display/name fallbacks for legacy URLs.
    const idx = displayLevels.findIndex(
      lv =>
        String(lv.levelNumber) === levelParam ||
        lv.levelDisplay.toLowerCase() === levelParam.toLowerCase() ||
        lv.name.toLowerCase() === levelParam.toLowerCase()
    )
    return idx >= 0 ? idx : 0
  }, [levelParam, isMultiVariant, family, displayLevels])
  
  // Handler for level selection
  const handleLevelChange = (index: number) => {
    if (!family) return
    setSearchParams(
      prev => {
        const nextParams = new URLSearchParams(prev)
        nextParams.set('level', `variant-${displayLevels[index].levelNumber}`)
        return nextParams
      },
      { replace: true }
    )
  }

  const activeLevel = isMultiVariant && family ? displayLevels[activeIndex] : undefined

  useEffect(() => {
    setActiveImageIndex(0)
  }, [activeIndex])
  
  // Use shared data if available, otherwise fall back to Pet data
  const displayData = useMemo(() => family ? {
    description: isDragonFamily
      ? `${activeLevel?.variantName ?? 'Baby'} Dragon`
      : activeLevel?.description ?? family.shared.description,
    imageUrl: activeLevel?.imageUrl ?? family.shared.imageUrl,
    alternativeImages: activeLevel?.alternativeImages ?? family.shared.alternativeImages,
    element: activeLevel?.element ?? family.shared.element,
    resists: activeLevel?.resists ?? family.shared.resists,
    rarity: activeLevel?.rarity ?? family.shared.rarity,
    attacks: activeLevel?.attacks ?? family.shared.attacks,
    notes: activeLevel?.notes ?? family.shared.notes,
    alsoSee: family.shared.alsoSee,
    sourceUrl: activeLevel?.sourceUrl ?? family.forumUrl,
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
    sourceUrl: pet.forumUrl,
  }, [activeLevel, family, isDragonFamily, pet])
  const displayAccess = family
    ? {
        daRequired: family.hasDA,
        dcRequired: family.hasDC,
        dmRequired: family.hasDM,
      }
    : {
        daRequired: pet.daRequired,
        dcRequired: pet.dcRequired ?? false,
        dmRequired: pet.dmRequired ?? false,
      }

  const displayGuestStats = isGuest
    ? activeLevel?.guestStats ?? guest?.guestStats
    : undefined
  const displayGuestAttacks = isGuest
    ? ((displayData.attacks as Guest['attacks'] | undefined) ?? guest?.attacks ?? [])
    : []
  
  // Use displayData.alsoSee for related pets (works for both single and multi-variant)
  const relatedPets = useRelatedPets(displayData.alsoSee ?? [])
  
  // Build array of all images (main + alternatives)
  const allImages = useMemo(() => {
    const images: Array<{ url: string; caption: string }> = []
    if (displayData.imageUrl) {
      images.push({ url: displayData.imageUrl, caption: displayFamilyName ?? pet.name })
    }
    if (displayData.alternativeImages) {
      images.push(...displayData.alternativeImages.map(image => ({
        url: image.url,
        caption: image.caption || 'Alternative Image',
      })))
    }
    return images
  }, [displayData.alternativeImages, displayData.imageUrl, displayFamilyName, pet.name])

  useEffect(() => {
    if (allImages.length <= 1) {
      setActiveImageIndex(0)
      return
    }

    const levelLabel = activeLevel?.name ?? ''
    const normalizedLevelName = levelLabel.replace(/\s+\((?:dc|d-coins?)\)$/i, '').trim()
    const isBaseFamilyVariant = Boolean(displayFamilyName && normalizedLevelName === displayFamilyName)

    if (isBaseFamilyVariant) {
      setActiveImageIndex(0)
      return
    }

    const variantSelectorLabel = activeLevel && displayFamilyName && family
      ? getLevelVariantLabels(displayLevels, displayFamilyName, family.type)[activeIndex]
      : undefined
    const variantHint = variantSelectorLabel?.replace(/\s*\([^)]*\)\s*$/, '').trim()
      || (displayFamilyName
        ? levelLabel
            .replace(displayFamilyName, '')
            .replace(/\(dc\)/i, '')
            .trim()
        : levelLabel.replace(/\(dc\)/i, '').trim())
    const matchingAltIndex = allImages.findIndex((image, index) =>
      index > 0 &&
      ((variantHint && image.caption.toLowerCase().includes(variantHint.toLowerCase())) ||
        (levelLabel && image.caption.toLowerCase().includes(levelLabel.toLowerCase().replace(/\(dc\)/i, '').trim())))
    )

    setActiveImageIndex(matchingAltIndex >= 0 ? matchingAltIndex : 0)
  }, [activeIndex, activeLevel, allImages, displayFamilyName, displayLevels, family])
  
  // Currently displayed image
  const currentImage = allImages[activeImageIndex]
  const displayedRequirements = useMemo(() => {
    const requirementSet = new Set<string>()
    const obtainSources = isMultiVariant && family
      ? displayLevels[activeIndex].obtainVariants
      : pet.obtainMethods

    for (const method of obtainSources) {
      const requirement = method.requirements?.trim()
      if (!requirement || requirement.toLowerCase() === 'none') continue
      requirementSet.add(requirement)
    }

    return [...requirementSet]
  }, [activeIndex, displayLevels, family, isMultiVariant, pet.obtainMethods])

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
    (() => {
      if (pet.rarity?.includes(':')) {
        const [label, ...rest] = pet.rarity.split(':')
        return { label: label.trim(), value: rest.join(':').trim() }
      }
      return { label: 'Rarity', value: pet.rarity }
    })(),
  ].filter(s => s.value && s.value !== 'Unknown' && s.value !== 'None' || s.label === 'Level')

  const sourceLinks = useMemo(() => {
    if (!family) {
      return [
        {
          url: displayData.sourceUrl,
          label: pet.name,
        },
      ]
    }

    const baseSourceLabels = family.levelVariants.map(level => normalizeSourceVariantLabel(level.name))
    const uniqueBaseSourceLabels = new Set(baseSourceLabels.map(label => label.toLowerCase()))
    const uniqueLevelLabels = new Set(
      family.levelVariants
        .map(level => String(level.actualLevel ?? level.levelDisplay ?? '').trim().toLowerCase())
        .filter(Boolean)
    )
    const shouldAppendLevelToSource =
      family.levelVariants.length > 1 && uniqueBaseSourceLabels.size === 1 && uniqueLevelLabels.size > 1

    const seenSourceVariantKeys = new Set<string>()
    const sourceLinksByVariant = family.levelVariants.flatMap(level => {
      const sourceUrl = level.sourceUrl ?? family.forumUrl

      const levelLabel = String(level.actualLevel ?? level.levelDisplay).trim()
      const levelSuffix = levelLabel && levelLabel.toLowerCase() !== 'unknown'
        ? levelLabel.toLowerCase() === 'as player'
          ? 'As player'
          : `Level ${levelLabel}`
        : ''
      const baseLabel = normalizeSourceVariantLabel(level.name)
      const sourceLabel = shouldAppendLevelToSource && levelSuffix
        ? `${baseLabel} (${levelSuffix})`
        : baseLabel
      const sourceKey = [
        sourceUrl,
        sourceLabel,
        String(level.actualLevel ?? level.levelDisplay ?? ''),
        level.damage ?? '',
        level.stats ?? '',
        level.resists ?? '',
      ].join('|').toLowerCase()

      if (seenSourceVariantKeys.has(sourceKey)) return []
      seenSourceVariantKeys.add(sourceKey)

      return [{ url: sourceUrl, label: sourceLabel }]
    })

    const seenLabels = new Set(sourceLinksByVariant.map(link => `${link.url}:${link.label}`))
    const unmatchedSources = (family.familySources ?? [])
      .filter(link => !family.levelVariants.some(level => (level.sourceUrl ?? family.forumUrl) === link.url))
      .map(link => ({
        url: link.url,
        label: link.variantLabel ?? link.title,
      }))
      .filter(link => {
        const key = `${link.url}:${link.label}`
        if (seenLabels.has(key)) return false
        seenLabels.add(key)
        return true
      })

    return [...sourceLinksByVariant, ...unmatchedSources]
  }, [displayData.sourceUrl, family, pet.name])

  return (
    <main className="px-4 sm:px-6 py-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        {/* Meta pills */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          {pet.elements.map(code => (
            <ElementPill key={code} code={code} size="md" clickable filterBase="/pets" />
          ))}
          {pet.traits.map(code => (
            <ElementPill key={code} code={code} size="md" />
          ))}
          <AccessPills daRequired={displayAccess.daRequired} dcRequired={displayAccess.dcRequired} dmRequired={displayAccess.dmRequired} filterBase="/pets" />
          
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
            isDragonFamily
              ? '<Dragon> (Baby, Toddler, Kid)'
              : isGuest
                ? displayFamilyName
              : family.isMultiPost || sameLevelVariants
                ? displayFamilyName
                : `${displayFamilyName} (${family.levelRange})`
          ) : pet.name}
        </h1>
        {displayData.description && (
          <p className="text-text-secondary text-sm italic leading-relaxed mb-2">
            {normalizeDisplayText(displayData.description)}
          </p>
        )}

        {pet.releaseDate && pet.releaseDate !== 'Unknown' && (
          <p className="text-text-muted text-xs">Released: {pet.releaseDate}</p>
        )}
      </div>

      {/* Pet image */}
      {currentImage ? (
        <div className="mb-6">
          <PetImage src={currentImage.url} name={pet.name} />
          {allImages.length > 1 && currentImage.caption && (
            <p className="max-w-xs mx-auto mt-2 text-center text-xs text-text-secondary">
              {currentImage.caption}
            </p>
          )}
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
                      {displayAccess.dcRequired ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-amber-500 text-bg-base text-xs font-bold">
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
      {isGuest && displayGuestStats && (
        <GuestStatsSection stats={displayGuestStats} />
      )}
      
      {/* Level Stats Table - only for multi-variant items */}
      {isMultiVariant && family && !isGuest && (
        <section className="mb-5">
          <CollapsibleSection title="Stats by Level">
            <LevelStatsTable 
              levels={displayLevels}
              familyName={displayFamilyName}
              hideVariantColumn={
                !sameLevelVariants &&
                !displayLevels.some(level => Boolean(level.variantName)) &&
                !useTitleDrivenVariantNames
              }
            />
          </CollapsibleSection>
        </section>
      )}
      
      {/* Level selector and rarity - only for multi-variant items */}
      {isMultiVariant && family && displayLevels.length > 1 && (
        <section className="mb-5">
          <LevelSelector
            levels={displayLevels}
            activeIndex={activeIndex}
            onChange={handleLevelChange}
            familyName={displayFamilyName}
            itemType={family.type}
          />
        </section>
      )}
      
      {/* Rarity - positioned after level selector for multi-variants, after stats for single */}
      {(() => {
        // For multi-variant, use level-specific rarity; for single, use pet rarity
        const displayRarity = isMultiVariant && family 
          ? displayLevels[activeIndex].rarity || family.shared.rarity
          : pet.rarity || family?.shared.rarity
        
        if (!displayRarity || displayRarity === 'Unknown') return null
        
        const metadataLabel = displayRarity.includes(':')
          ? displayRarity.split(':')[0].trim()
          : 'Rarity'
        const metadataValue = displayRarity.includes(':')
          ? displayRarity.split(':').slice(1).join(':').trim()
          : displayRarity

        return <MetadataChipSection label={metadataLabel} value={metadataValue} />
      })()}

      {/* How to Obtain */}
      {isMultiVariant && family ? (
        <ObtainSection
          variants={displayLevels[activeIndex].obtainVariants}
          isGuest={isGuest}
          locationOnly={isDragonFamily}
        />
      ) : pet.obtainMethods.length > 0 ? (
        <ObtainSection
          variants={pet.obtainMethods.map(method => ({
            location: method.location,
            price: method.price ?? 'N/A',
            priceType: method.priceType,
            sellback: method.sellback,
            ...(method.requirements ? { requirements: method.requirements } : {}),
            // Use ONLY per-method flags - do NOT fall back to pet-level flags
            // Per-method flags are authoritative; pet-level flags are just summaries
            daRequired: method.daRequired ?? false,
            ...(method.dcRequired ? { dcRequired: method.dcRequired } : {}),
            ...(method.dmRequired ? { dmRequired: method.dmRequired } : {}),
            ...(method.requiredItems ? { requiredItems: method.requiredItems } : {}),
          }))}
          isGuest={isGuest}
        />
      ) : null}

      {displayedRequirements.length > 0 && !isGuest && (
        <section aria-labelledby="requirements-heading" className="mb-5">
          <div className="bg-bg-surface/60 border border-border-default rounded-lg p-4 space-y-3">
            <h2 id="requirements-heading" className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Requirements
            </h2>
            {displayedRequirements.map(requirement => (
              <p key={requirement} className="text-sm text-text-secondary leading-relaxed break-words">
                {normalizeDisplayText(requirement)}
              </p>
            ))}
          </div>
        </section>
      )}

      {/* Evolutions */}
      <PetEvolutions evolutions={pet.evolutions} fromUrl={backUrl} />

      {/* Attacks - use GuestAttacks for guests, PetAttacks for pets */}
      {isGuest && guest ? (
        <GuestAttacks attacks={displayGuestAttacks} />
      ) : (
        <PetAttacks attacks={(displayData.attacks as Pet['attacks'] | undefined) ?? []} />
      )}

      {/* Notes - show shared notes for multi-variant (always visible), and/or level-specific notes */}
      {(() => {
        // For multi-variant items
        if (isMultiVariant && family) {
          const activeLevel = displayLevels[activeIndex]
          const shouldShowSharedNotes =
            family.familyOrigin !== 'cross-post' ||
            displayLevels.every(level => (level.notes ?? undefined) === (family.shared.notes ?? undefined))
          
          // Clean shared notes (remove attribution)
          const cleanedSharedNotes = shouldShowSharedNotes && family.shared.notes ? (() => {
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
          const dedupedLevelNotes = cleanedLevelNotes && cleanedLevelNotes !== cleanedSharedNotes
            ? cleanedLevelNotes
            : undefined
          
          // If neither exists, don't render
          if (!cleanedSharedNotes && !dedupedLevelNotes) return null
          
          return (
            <section className="bg-bg-surface/60 border border-border-default rounded-lg p-4 mb-5">
              <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
                Other Information
              </h2>
              {cleanedSharedNotes && <NotesList notes={cleanedSharedNotes} />}
              {cleanedSharedNotes && dedupedLevelNotes && <div className="my-3 border-t border-border-default" />}
              {dedupedLevelNotes && <NotesList notes={dedupedLevelNotes} />}
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

      <section className="mb-5">
        <SourceLinksCard links={sourceLinks} />
      </section>

      {/* Also See — related pets from forum data */}
      {relatedPets.length > 0 && (
        <section aria-labelledby="related-heading" className="border-t border-border-default pt-6">
          <h2 id="related-heading" className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
            Also See
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {relatedPets.map(related => {
              const section = related.type === 'pet' ? 'pets' : 'guests'
              const relatedFamily = isItemFamily(related) ? related : undefined
              return (
                <li key={related.id}>
                  <PetCard
                    pet={buildCardPet(related)}
                    family={relatedFamily}
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
