import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type {
  Accessory,
  AccessoryEntry,
  AccessoryFamily,
  AccessorySubtype,
} from '../../types/accessory'
import { isAccessoryFamily } from '../../types/accessory'
import type { LevelVariant, ObtainVariant } from '../../types/item'
import type { GuestAttack } from '../../types/pet'
import {
  getAccessoryArmorCustomization,
  useAccessoryRelatedItems,
  type AccessoryRelatedItem,
} from '../../hooks/useAccessories'
import { displayTitle, normalizeDisplayText } from '../../utils/displayText'
import { buildDisplayImages } from '../../utils/imageLabels'
import {
  getDisplayFamilyName,
  isSingleVariant,
  normalizeRomanDisplay,
} from '../../utils/variantHelpers'
import ElementPill from '../shared/ElementPill'
import AccessPills from '../shared/AccessPills'
import LevelSelector from '../shared/LevelSelector'
import ObtainSection from '../shared/ObtainSection'
import SourceLinksCard from '../shared/SourceLinksCard'
import CollapsibleSection from '../shared/CollapsibleSection'
import MetadataChipSection from '../shared/MetadataChipSection'
import OtherInformationSection from '../shared/OtherInformationSection'
import DetailTypePill from '../shared/DetailTypePill'
import ItemImage from '../shared/ItemImage'
import { buildFilterLink } from '../../utils/filterLinks'
import { notesIndicateInvisibleItem } from '../../utils/imageVisibility'
import AccessoryStatsTable from './AccessoryStatsTable'
import AccessoryCard from './AccessoryCard'
import GuestAttacks from '../guests/GuestAttacks'

const ACCESSORY_SUBTYPE_LABELS: Record<AccessorySubtype, string> = {
  artifact: 'Artifact',
  belt: 'Belt',
  bracer: 'Bracer',
  'cape-wing': 'Cape/Wing',
  helm: 'Helm',
  necklace: 'Necklace',
  ring: 'Ring',
  trinket: 'Trinket',
}

const INTENTIONALLY_IMAGELESS_ACCESSORY_SLUGS = new Set([
  'accessory-cloak-of-shadows',
  'accessory-invisible-cape',
  'accessory-invisible-helm',
  'accessory-mantle-of-shadows',
  'accessory-wrap-of-shadows',
])

interface AccessoryDetailProps {
  accessory: AccessoryEntry
  filterBase: string
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
    ...(entry.itemType ? { itemType: entry.itemType } : {}),
    ...(entry.rarity ? { rarity: entry.rarity } : {}),
    ...(entry.notes ? { notes: entry.notes } : {}),
  }
}

function isCapeOrHelmLike(value?: string): boolean {
  return Boolean(
    value &&
    /\b(?:back|cape|cloak|head|wing|wings|helm|helmet|hat|hood|mask|circlet)\b/i.test(value)
  )
}

function normalizeSourceVariantLabel(label: string) {
  return normalizeRomanDisplay(
    displayTitle(
      normalizeDisplayText(label)
        .replace(/^DF Encyclopedia:\s*/i, '')
        .replace(/\s+\((?:DA|DC|D-Amulet|D-Coins?|Normal)\)$/i, '')
        .trim()
    )
  )
}

function getLevelSourceSuffix(level: LevelVariant): string {
  const levelLabel = String(level.actualLevel ?? level.levelDisplay).trim()
  if (!levelLabel || levelLabel.toLowerCase() === 'unknown') return ''
  return levelLabel.toLowerCase() === 'as player' ? 'As player' : `Level ${levelLabel}`
}

function getForumMessageId(url: string): string | undefined {
  return url.match(/[?&]m=(\d+)/i)?.[1]
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

function shouldSuppressMissingImagePlaceholder(
  accessory: AccessoryEntry,
  notes: Array<string | undefined> = []
): boolean {
  const slugs = [
    accessory.slug,
    ...(isAccessoryFamily(accessory) ? (accessory.aliasSlugs ?? []) : []),
  ]
  return (
    slugs.some((slug) => INTENTIONALLY_IMAGELESS_ACCESSORY_SLUGS.has(slug)) ||
    notesIndicateInvisibleItem(...notes)
  )
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

function ArmorCustomizationMetadataStrip({
  modifies,
  appearance,
}: {
  modifies?: string
  appearance?: string
}) {
  const values = [
    modifies ? { label: 'Modifies', value: modifies } : null,
    appearance ? { label: 'Appearance', value: appearance } : null,
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

  // The image selector is independent from the level/variant selector for
  // accessories: switching variants must not move the image. Only reset the image
  // to the first one when navigating to a different entry, and clamp the index if
  // the available image set shrinks. (Weapons intentionally link the two selectors
  // under their own conditions; accessories do not.)
  const entryKey = family?.slug ?? singleAccessory?.slug ?? accessory.slug
  const initializedImageEntryKey = useRef<string | undefined>(undefined)

  const title = family
    ? getDisplayFamilyName(family)
    : displayTitle(singleAccessory?.name ?? 'Accessory')
  const description = family
    ? (activeLevel?.description ?? family.shared.description)
    : singleAccessory?.description
  const familyHasVariantImages = Boolean(
    family?.levelVariants.some((level) => level.imageUrl || level.alternativeImages?.length)
  )
  const imageUrl = family
    ? familyHasVariantImages
      ? (activeLevel?.imageUrl ?? family.shared.imageUrl)
      : (family.shared.imageUrl ?? activeLevel?.imageUrl)
    : singleAccessory?.imageUrl
  const altImages = family
    ? familyHasVariantImages
      ? nonEmptyAlternativeImages(activeLevel?.alternativeImages)
      : (family.shared.alternativeImages ??
        nonEmptyAlternativeImages(activeLevel?.alternativeImages))
    : singleAccessory?.alternativeImages
  const shouldShowImages = shouldDisplayAccessoryImages(
    accessory,
    family,
    singleAccessory,
    activeLevel
  )
  const allImages = useMemo(() => {
    if (!shouldShowImages) return []
    return buildDisplayImages({
      imageUrl,
      alternativeImages: altImages,
      mainCaption: title,
    })
  }, [altImages, imageUrl, shouldShowImages, title])

  useEffect(() => {
    if (initializedImageEntryKey.current !== entryKey) {
      initializedImageEntryKey.current = entryKey
      setActiveImageIndex(0)
      setActiveIndex(0)
      return
    }
    // Clamp if the image set shrank (e.g. variant-specific images changed)
    setActiveImageIndex((current) => (current < allImages.length ? current : 0))
  }, [entryKey, allImages.length])

  const currentImage = allImages[activeImageIndex]
  const showMissingImagePlaceholder =
    shouldShowImages &&
    allImages.length === 0 &&
    !shouldSuppressMissingImagePlaceholder(accessory, [
      family?.shared.notes,
      activeLevel?.notes,
      singleAccessory?.notes,
    ])

  const access = family
    ? { da: family.hasDA, dc: family.hasDC, dm: family.hasDM }
    : {
        da: singleAccessory?.daRequired ?? false,
        dc: singleAccessory?.dcRequired ?? false,
        dm: singleAccessory?.dmRequired ?? false,
      }

  const obtainMethods = family
    ? (activeLevel?.obtainVariants ?? [])
    : singleAccessory
      ? buildSingleVariant(singleAccessory)
      : []
  const rarity = family ? (activeLevel?.rarity ?? family.shared.rarity) : singleAccessory?.rarity
  const ability = family ? family.shared.ability : singleAccessory?.ability
  const artifactModifies = family ? family.modifies : singleAccessory?.modifies
  const artifactEquipSpot = family ? family.equipSlot : singleAccessory?.equipSpot
  const trinketSkillEffectTypes = family
    ? family.trinketSkillEffectTypes
    : singleAccessory?.trinketSkillEffectTypes
  const detailTypeLabel =
    activeLevel?.itemType ??
    family?.itemType ??
    singleAccessory?.itemType ??
    ACCESSORY_SUBTYPE_LABELS[accessory.subtype]
  const armorCustomization = getAccessoryArmorCustomization(accessory)
  const attacks = family
    ? ((activeLevel?.attacks ?? family.shared.attacks) as GuestAttack[] | undefined)
    : singleAccessory?.attacks
  const trinketSkillHeading =
    attacks && attacks.length > 1 ? `Trinket Skills (${attacks.length})` : 'Trinket Skill'
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
      const sourceMessageId = getForumMessageId(source.url)
      if (
        sourceMessageId &&
        family.levelVariants.some(
          (level) => getForumMessageId(level.sourceUrl ?? family.forumUrl) === sourceMessageId
        )
      ) {
        continue
      }

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
      family
        ? [family.slug, ...(family.aliasSlugs ?? [])]
        : [singleAccessory?.slug ?? accessory.slug]
    )
    const refs = family ? (family.shared.alsoSee ?? []) : (singleAccessory?.alsoSee ?? [])

    return refs.filter((ref) => !currentSlugs.has(ref.slug))
  }, [accessory.slug, family, singleAccessory])
  const { relatedAccessories } = useAccessoryRelatedItems(accessory, alsoSeeRefs)
  const resolvedRelatedAccessories = relatedAccessories.filter(
    (related): related is AccessoryRelatedItem & { entry: AccessoryEntry } => Boolean(related.entry)
  )

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
            <Link
              to={buildFilterLink(filterBase, 'access', 'multi')}
              className="inline-block text-xs font-semibold px-3 py-1.5 rounded-full bg-gold-bright text-bg-base transition-opacity hover:opacity-80"
            >
              Multiple Versions
            </Link>
          )}
          <DetailTypePill label={detailTypeLabel} />
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
        {trinketSkillEffectTypes && trinketSkillEffectTypes.length > 0 && (
          <p className="text-xs text-text-muted mt-2">
            Effect Type{trinketSkillEffectTypes.length === 1 ? '' : 's'}:{' '}
            {trinketSkillEffectTypes.join(', ')}
          </p>
        )}
      </div>

      {family && family.levelVariants.length > 1 && (
        <section className="mb-8">
          <LevelSelector
            levels={family.levelVariants}
            activeIndex={activeIndex}
            onChange={setActiveIndex}
            familyName={family.familyName}
            itemType="accessory"
          />
        </section>
      )}

      {(currentImage || showMissingImagePlaceholder) && (
        <div className="mb-8">
          <ItemImage
            src={currentImage?.url}
            alt={currentImage?.caption ?? title}
            showPlaceholder={showMissingImagePlaceholder}
          />
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

      {accessory.subtype === 'artifact' && !armorCustomization && (
        <ArtifactMetadataStrip modifies={artifactModifies} equipSpot={artifactEquipSpot} />
      )}

      {armorCustomization && (
        <ArmorCustomizationMetadataStrip
          modifies={armorCustomization.modifies}
          appearance={armorCustomization.appearance}
        />
      )}

      {displayLevels.length > 0 && (
        <section className="mb-8 space-y-6">
          <CollapsibleSection title="Stats by Level">
            <AccessoryStatsTable levels={displayLevels} familyName={family?.familyName} />
          </CollapsibleSection>
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

      {attacks && attacks.length > 0 && (
        <GuestAttacks
          attacks={attacks}
          heading={trinketSkillHeading}
          imageLabel="Ability Image"
        />
      )}

      <OtherInformationSection
        notes={singleAccessory?.notes}
        sharedNotes={family?.shared.notes}
        activeVariantNotes={activeLevel?.notes}
        allVariantNotes={family?.levelVariants.map((level) => level.notes)}
      />

      <section className="mb-5">
        <SourceLinksCard links={sourceLinks} />
      </section>

      {resolvedRelatedAccessories.length > 0 && (
        <section aria-labelledby="related-heading" className="border-t border-border-default pt-6">
          <h2
            id="related-heading"
            className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3"
          >
            Also See
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {resolvedRelatedAccessories.map(({ ref, entry, relation, scope }) => (
              <li key={`${entry.slug}-${ref?.url ?? relation}`}>
                <AccessoryCard
                  accessory={entry}
                  badgeLabel={
                    scope === 'cross-subtype' ? ACCESSORY_SUBTYPE_LABELS[entry.subtype] : undefined
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
