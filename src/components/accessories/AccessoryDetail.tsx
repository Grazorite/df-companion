import { useEffect, useMemo, useState } from 'react'
import type { Accessory, AccessoryEntry, AccessoryFamily } from '../../types/accessory'
import { isAccessoryFamily } from '../../types/accessory'
import type { LevelVariant, ObtainVariant } from '../../types/item'
import type { GuestAttack } from '../../types/pet'
import { normalizeDisplayText } from '../../utils/displayText'
import { getDisplayFamilyName, isSingleVariant } from '../../utils/variantHelpers'
import ElementPill from '../shared/ElementPill'
import AccessPills from '../shared/AccessPills'
import NotesList from '../shared/NotesList'
import LevelSelector from '../shared/LevelSelector'
import ObtainVariantCard from '../shared/ObtainVariantCard'
import SourceLinksCard from '../shared/SourceLinksCard'
import CollapsibleSection from '../shared/CollapsibleSection'
import AccessoryStatsTable from './AccessoryStatsTable'
import GuestAttacks from '../guests/GuestAttacks'

interface AccessoryDetailProps {
  accessory: AccessoryEntry
  filterBase: string
}

function AccessoryImage({ src, name }: { src: string; name: string }) {
  const [broken, setBroken] = useState(false)

  if (!src || broken) return null

  return (
    <img
      src={src}
      alt={name}
      loading="lazy"
      onError={() => setBroken(true)}
      className="max-w-xs w-full mx-auto rounded-xl border border-border-default shadow-medium img-fade"
    />
  )
}

function buildSingleVariant(entry: Accessory): ObtainVariant[] {
  return entry.obtainMethods
}

function buildSingleAccessoryLevel(entry: Accessory): LevelVariant {
  return {
    levelNumber: 1,
    levelDisplay: entry.level || '1',
    ...(entry.level && /^\d+$/.test(entry.level.trim())
      ? { actualLevel: Number.parseInt(entry.level.trim(), 10) }
      : {}),
    name: entry.name,
    damage: '',
    stats: entry.stats ?? 'None',
    resists: entry.resists ?? 'None',
    obtainVariants: entry.obtainMethods,
    sourceUrl: entry.forumUrl,
    ...(entry.description ? { description: entry.description } : {}),
    ...(entry.imageUrl ? { imageUrl: entry.imageUrl } : {}),
    ...(entry.alternativeImages ? { alternativeImages: entry.alternativeImages } : {}),
    ...(entry.elements[0] ? { element: entry.elements[0] } : {}),
    ...(entry.attacks ? { attacks: entry.attacks } : {}),
    ...(entry.rarity ? { rarity: entry.rarity } : {}),
    ...(entry.notes ? { notes: entry.notes } : {}),
  }
}

function getAccessoryNotes(
  family: AccessoryFamily | undefined,
  singleAccessory: Accessory | undefined,
  activeIndex: number
): string | undefined {
  if (!family) return singleAccessory?.notes

  const levelNotes = family.levelVariants[activeIndex]?.notes?.trim()
  const sharedNotes = family.shared.notes?.trim()

  if (levelNotes && sharedNotes && levelNotes !== sharedNotes) {
    return `${sharedNotes}\n${levelNotes}`
  }

  return levelNotes ?? sharedNotes
}

function isCapeOrHelmLike(value?: string): boolean {
  return Boolean(value && /\b(?:cape|cloak|wing|wings|helm|helmet|hat|hood|mask|circlet)\b/i.test(value))
}

function shouldDisplayAccessoryImages(
  accessory: AccessoryEntry,
  family: AccessoryFamily | undefined,
  singleAccessory: Accessory | undefined,
  activeLevel: LevelVariant | undefined
): boolean {
  if (accessory.subtype === 'cape-wing' || accessory.subtype === 'helm') return true
  if (accessory.subtype !== 'artifact') return false

  return [
    family?.familyName,
    family?.itemType,
    family?.equipSlot,
    family?.category,
    activeLevel?.name,
    singleAccessory?.name,
    singleAccessory?.itemType,
    singleAccessory?.equipSpot,
    singleAccessory?.category,
  ].some(isCapeOrHelmLike)
}

function ArtifactMetadataStrip({
  modifies,
  equipSpot,
}: {
  modifies?: string
  equipSpot?: string
}) {
  const values = [
    modifies ? { label: 'Modifies', value: modifies } : null,
    equipSpot ? { label: 'Equip Spot', value: equipSpot } : null,
  ].filter((entry): entry is { label: string; value: string } => Boolean(entry))

  if (values.length === 0) return null

  return (
    <section className="mb-8">
      <div className="bg-bg-surface border border-border-default rounded-lg p-4">
        <div className={`grid gap-4 text-center ${values.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {values.map(item => (
            <div key={item.label}>
              <p className="text-xs text-text-muted uppercase tracking-wider mb-1">
                {item.label}
              </p>
              <p className="text-sm font-medium text-text-primary">
                {normalizeDisplayText(item.value)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default function AccessoryDetail({ accessory, filterBase }: AccessoryDetailProps) {
  const family = isAccessoryFamily(accessory) ? (accessory as AccessoryFamily) : undefined
  const singleAccessory = family ? undefined : (accessory as Accessory)
  const [activeIndex, setActiveIndex] = useState(0)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const isMultiVariant = family && !isSingleVariant(family)
  const activeLevel = family ? family.levelVariants[Math.min(activeIndex, family.levelVariants.length - 1)] : undefined

  useEffect(() => {
    setActiveImageIndex(0)
  }, [activeIndex])

  const title = family ? getDisplayFamilyName(family) : singleAccessory?.name ?? 'Accessory'
  const description = family
    ? activeLevel?.description ?? family.shared.description
    : singleAccessory?.description
  const imageUrl = family ? activeLevel?.imageUrl ?? family.shared.imageUrl : singleAccessory?.imageUrl
  const altImages = family
    ? activeLevel?.alternativeImages ?? family.shared.alternativeImages
    : singleAccessory?.alternativeImages
  const shouldShowImages = shouldDisplayAccessoryImages(accessory, family, singleAccessory, activeLevel)
  const allImages = useMemo(() => {
    if (!shouldShowImages) return []
    const images: Array<{ url: string; caption: string }> = []
    if (imageUrl) images.push({ url: imageUrl, caption: title })
    if (altImages) images.push(...altImages)
    return images
  }, [altImages, imageUrl, shouldShowImages, title])
  const currentImage = allImages[activeImageIndex]

  const access = family
    ? { da: family.hasDA, dc: family.hasDC, dm: family.hasDM }
    : {
        da: singleAccessory?.daRequired ?? false,
        dc: singleAccessory?.dcRequired ?? false,
        dm: singleAccessory?.dmRequired ?? false,
      }

  const notes = getAccessoryNotes(family, singleAccessory, activeIndex)
  const obtainMethods = family
    ? activeLevel?.obtainVariants ?? []
    : singleAccessory
      ? buildSingleVariant(singleAccessory)
      : []
  const rarity = family ? activeLevel?.rarity ?? family.shared.rarity : singleAccessory?.rarity
  const ability = family ? family.shared.ability : singleAccessory?.ability
  const artifactModifies = family ? family.modifies : singleAccessory?.modifies
  const artifactEquipSpot = family ? family.equipSlot : singleAccessory?.equipSpot
  const attacks = family
    ? ((activeLevel?.attacks ?? family.shared.attacks) as GuestAttack[] | undefined)
    : singleAccessory?.attacks
  const displayLevels = useMemo(
    () => (family ? family.levelVariants : singleAccessory ? [buildSingleAccessoryLevel(singleAccessory)] : []),
    [family, singleAccessory]
  )
  const sourceLinks = family?.familySources?.length
    ? family.familySources.map(link => ({
        url: link.url,
        label: link.variantLabel ?? link.title,
      }))
    : [
        {
          url: accessory.forumUrl,
          label: `DF Encyclopedia: ${title}`,
        },
      ]

  return (
    <main className="px-4 sm:px-6 py-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          {accessory.elements.map(code => (
            <ElementPill key={code} code={code} size="md" clickable filterBase={filterBase} />
          ))}
          <AccessPills
            daRequired={access.da}
            dcRequired={access.dc}
            dmRequired={access.dm}
            filterBase={filterBase}
          />
          {isMultiVariant && (
            <span className="inline-block text-xs font-semibold px-3 py-1.5 rounded-full bg-gold-bright text-bg-base cursor-default">
              Multiple Versions
            </span>
          )}
        </div>

        <h1 className="text-3xl font-bold text-text-primary mb-3">{title}</h1>
        {description && (
          <p className="text-text-secondary italic leading-relaxed mb-3">
            {normalizeDisplayText(description)}
          </p>
        )}
        {!!accessory.releaseDate && (
          <p className="text-sm text-text-muted">Released: {accessory.releaseDate}</p>
        )}
      </div>

      {currentImage && (
        <div className="mb-8">
          <AccessoryImage src={currentImage.url} name={currentImage.caption ?? title} />
          {allImages.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            {allImages.map((image, index) => (
              <button
                key={`${image.url}-${index}`}
                onClick={() => setActiveImageIndex(index)}
                className={`min-h-11 px-4 py-2 rounded-lg text-sm transition-colors ${
                  activeImageIndex === index
                    ? 'bg-gold text-bg-base'
                    : 'bg-bg-surface border border-border-default text-text-secondary hover:text-text-primary hover:border-border-hover'
                }`}
              >
                {image.caption}
              </button>
            ))}
          </div>
          )}
        </div>
      )}

      {accessory.subtype === 'artifact' && (
        <ArtifactMetadataStrip modifies={artifactModifies} equipSpot={artifactEquipSpot} />
      )}

      {displayLevels.length > 0 && (
        <section className="mb-8 space-y-6">
          <CollapsibleSection title="Stats by Level">
            <AccessoryStatsTable levels={displayLevels} familyName={family?.familyName} />
          </CollapsibleSection>
          {family && family.levelVariants.length > 1 && (
            <LevelSelector
              levels={family.levelVariants}
              activeIndex={activeIndex}
              onChange={setActiveIndex}
              familyName={family.familyName}
              itemType="accessory"
            />
          )}
        </section>
      )}

      {rarity && rarity !== 'Unknown' && (
        <section aria-labelledby="rarity-heading" className="mb-8">
          <h2
            id="rarity-heading"
            className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3"
          >
            Rarity
          </h2>
          <div className="flex gap-2">
            <span className="inline-block text-sm px-3 py-1.5 rounded-md bg-bg-overlay text-text-secondary border border-border-default">
              {normalizeDisplayText(rarity)}
            </span>
          </div>
        </section>
      )}

      {ability && (!attacks || attacks.length === 0) && (
        <section className="mb-8">
          <div className="bg-bg-surface border border-border-default rounded-lg p-5">
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
              Ability
            </h2>
            <p className="text-sm text-text-primary whitespace-pre-line">
              {normalizeDisplayText(ability)}
            </p>
          </div>
        </section>
      )}

      {obtainMethods.length > 0 && (
        <section className="mb-8 space-y-4">
          {obtainMethods.map((method, index) => (
            <ObtainVariantCard
              key={`${method.location}-${index}`}
              variant={method}
              label={obtainMethods.length > 1 ? `Method ${index + 1}` : undefined}
            />
          ))}
        </section>
      )}

      {attacks && attacks.length > 0 && (
        <GuestAttacks attacks={attacks} />
      )}

      {notes && (
        <section className="mb-8">
          <div className="bg-bg-surface border border-border-default rounded-lg p-5">
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
              Other Information
            </h2>
            <NotesList notes={notes} />
          </div>
        </section>
      )}

      <SourceLinksCard links={sourceLinks} />
    </main>
  )
}
