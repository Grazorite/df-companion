import { useEffect, useMemo, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import type { Accessory, AccessoryEntry, AccessoryFamily } from '../../types/accessory'
import { isAccessoryFamily } from '../../types/accessory'
import type { LevelVariant, ObtainVariant } from '../../types/item'
import type { GuestAttack } from '../../types/pet'
import { useRelatedAccessories } from '../../hooks/useAccessories'
import { displayTitle, normalizeDisplayText } from '../../utils/displayText'
import { getDisplayFamilyName, isSingleVariant } from '../../utils/variantHelpers'
import ElementPill from '../shared/ElementPill'
import AccessPills from '../shared/AccessPills'
import NotesList from '../shared/NotesList'
import LevelSelector from '../shared/LevelSelector'
import ObtainSection from '../shared/ObtainSection'
import SourceLinksCard from '../shared/SourceLinksCard'
import CollapsibleSection from '../shared/CollapsibleSection'
import MetadataChipSection from '../shared/MetadataChipSection'
import AccessoryStatsTable from './AccessoryStatsTable'
import AccessoryCard from './AccessoryCard'
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

function nonEmptyAlternativeImages(
  images?: Array<{ url: string; caption: string }>
): Array<{ url: string; caption: string }> | undefined {
  return images && images.length > 0 ? images : undefined
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
  return Boolean(
    value &&
    /\b(?:back|cape|cloak|head|wing|wings|helm|helmet|hat|hood|mask|circlet)\b/i.test(value)
  )
}

function normalizeSourceVariantLabel(label: string) {
  return displayTitle(
    normalizeDisplayText(label)
      .replace(/^DF Encyclopedia:\s*/i, '')
      .replace(/\s+\((?:DA|DC|D-Amulet|D-Coins?|Normal)\)$/i, '')
      .trim()
  )
}

function getLevelSourceSuffix(level: LevelVariant): string {
  const levelLabel = String(level.actualLevel ?? level.levelDisplay).trim()
  if (!levelLabel || levelLabel.toLowerCase() === 'unknown') return ''
  return levelLabel.toLowerCase() === 'as player' ? 'As player' : `Level ${levelLabel}`
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

function ArtifactMetadataStrip({ modifies, equipSpot }: { modifies?: string; equipSpot?: string }) {
  const values = [
    modifies ? { label: 'Modifies', value: modifies } : null,
    equipSpot ? { label: 'Equip Spot', value: equipSpot } : null,
  ].filter((entry): entry is { label: string; value: string } => Boolean(entry))

  if (values.length === 0) return null

  return (
    <section className="mb-8">
      <div className="bg-bg-surface border border-border-default rounded-lg p-4">
        <div
          className={`grid gap-4 text-center ${values.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}
        >
          {values.map((item) => (
            <div key={item.label}>
              <p className="text-xs text-text-muted uppercase tracking-wider mb-1">{item.label}</p>
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
  const activeLevel = family
    ? family.levelVariants[Math.min(activeIndex, family.levelVariants.length - 1)]
    : undefined

  useEffect(() => {
    setActiveImageIndex(0)
  }, [activeIndex])

  const title = family
    ? getDisplayFamilyName(family)
    : displayTitle(singleAccessory?.name ?? 'Accessory')
  const description = family
    ? (activeLevel?.description ?? family.shared.description)
    : singleAccessory?.description
  const imageUrl = family
    ? (family.shared.imageUrl ?? activeLevel?.imageUrl)
    : singleAccessory?.imageUrl
  const altImages = family
    ? (family.shared.alternativeImages ?? nonEmptyAlternativeImages(activeLevel?.alternativeImages))
    : singleAccessory?.alternativeImages
  const shouldShowImages = shouldDisplayAccessoryImages(
    accessory,
    family,
    singleAccessory,
    activeLevel
  )
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
    ? (activeLevel?.obtainVariants ?? [])
    : singleAccessory
      ? buildSingleVariant(singleAccessory)
      : []
  const rarity = family ? (activeLevel?.rarity ?? family.shared.rarity) : singleAccessory?.rarity
  const ability = family ? family.shared.ability : singleAccessory?.ability
  const artifactModifies = family ? family.modifies : singleAccessory?.modifies
  const artifactEquipSpot = family ? family.equipSlot : singleAccessory?.equipSpot
  const attacks = family
    ? ((activeLevel?.attacks ?? family.shared.attacks) as GuestAttack[] | undefined)
    : singleAccessory?.attacks
  const displayLevels = useMemo(
    () =>
      family
        ? family.levelVariants
        : singleAccessory
          ? [buildSingleAccessoryLevel(singleAccessory)]
          : [],
    [family, singleAccessory]
  )
  const sourceLinks = useMemo(() => {
    if (!family) {
      return [
        {
          url: accessory.forumUrl,
          label: title,
        },
      ]
    }

    const baseSourceLabels = family.levelVariants.map((level) =>
      normalizeSourceVariantLabel(level.name)
    )
    const uniqueBaseSourceLabels = new Set(baseSourceLabels.map((label) => label.toLowerCase()))
    const uniqueLevelLabels = new Set(
      family.levelVariants
        .map((level) =>
          String(level.actualLevel ?? level.levelDisplay ?? '')
            .trim()
            .toLowerCase()
        )
        .filter(Boolean)
    )
    const shouldAppendLevelToSource =
      family.levelVariants.length > 1 &&
      uniqueBaseSourceLabels.size === 1 &&
      uniqueLevelLabels.size > 1
    const seen = new Set<string>()
    const links = family.levelVariants.flatMap((level) => {
      const sourceUrl = level.sourceUrl ?? family.forumUrl
      const levelSuffix = getLevelSourceSuffix(level)
      const baseLabel = normalizeSourceVariantLabel(level.name)
      const label =
        shouldAppendLevelToSource && levelSuffix ? `${baseLabel} (${levelSuffix})` : baseLabel
      const key = [sourceUrl, label, String(level.actualLevel ?? level.levelDisplay ?? '')]
        .join('|')
        .toLowerCase()

      if (seen.has(key)) return []
      seen.add(key)
      return [{ url: sourceUrl, label }]
    })

    for (const source of family.familySources ?? []) {
      if (family.levelVariants.some((level) => (level.sourceUrl ?? family.forumUrl) === source.url))
        continue

      const label = normalizeSourceVariantLabel(source.variantLabel ?? source.title)
      const key = `${source.url}|${label}`.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      links.push({ url: source.url, label })
    }

    return links
  }, [accessory.forumUrl, family, title])
  const alsoSeeRefs = useMemo(() => {
    const currentSlugs = new Set(
      family ? [family.slug, ...(family.aliasSlugs ?? [])] : [singleAccessory?.slug ?? accessory.slug]
    )
    const refs = family ? (family.shared.alsoSee ?? []) : (singleAccessory?.alsoSee ?? [])

    return refs.filter((ref) => !currentSlugs.has(ref.slug))
  }, [accessory.slug, family, singleAccessory])
  const { relatedAccessories } = useRelatedAccessories(alsoSeeRefs)

  return (
    <main className="px-4 sm:px-6 py-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          {accessory.elements.map((code) => (
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

      <MetadataChipSection label="Rarity" value={rarity} className="mb-8" />

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

      <ObtainSection variants={obtainMethods} className="mb-8" />

      {attacks && attacks.length > 0 && <GuestAttacks attacks={attacks} />}

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

      <section className="mb-5">
        <SourceLinksCard links={sourceLinks} />
      </section>

      {relatedAccessories.length > 0 && (
        <section aria-labelledby="related-heading" className="border-t border-border-default pt-6">
          <h2
            id="related-heading"
            className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3"
          >
            Also See
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {relatedAccessories.map(({ ref, entry }) =>
              entry ? (
                <li key={`${ref.slug}-${ref.url ?? 'route'}`}>
                  <AccessoryCard accessory={entry} />
                </li>
              ) : ref.url ? (
                <li key={`${ref.slug}-${ref.url}`}>
                  <a
                    href={ref.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 bg-bg-surface border border-border-default rounded-lg p-4 h-[120px] text-sm font-semibold text-gold hover:text-gold-bright hover:border-border-hover transition-colors"
                  >
                    <span>{displayTitle(ref.name)}</span>
                    <ExternalLink className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                  </a>
                </li>
              ) : (
                <li
                  key={`${ref.slug}-unresolved`}
                  className="bg-bg-surface border border-border-default rounded-lg p-4 h-[120px] text-sm font-semibold text-text-secondary"
                >
                  {displayTitle(ref.name)}
                </li>
              )
            )}
          </ul>
        </section>
      )}
    </main>
  )
}
