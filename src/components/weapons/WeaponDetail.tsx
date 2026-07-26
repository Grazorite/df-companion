import { useEffect, useMemo, useRef, useState } from 'react'
import { ImageOff } from 'lucide-react'
import type { LevelVariant, ObtainVariant } from '../../types/item'
import type { Weapon, WeaponEntry, WeaponFamily, WeaponSpecial } from '../../types/weapon'
import { isWeaponFamily } from '../../types/weapon'
import { useRelatedWeapons } from '../../hooks/useWeapons'
import { displayTitle, normalizeDisplayText } from '../../utils/displayText'
import {
  buildDisplayImages,
  inferImageCaptionFromUrl,
  normalizeImageCaption,
} from '../../utils/imageLabels'
import {
  getDisplayFamilyName,
  getLevelVariantLabels,
  isSingleVariant,
  obtainVariantHasDC,
} from '../../utils/variantHelpers'
import { getWeaponDisplayName } from '../../hooks/useWeapons'
import AccessPills from '../shared/AccessPills'
import CollapsibleSection from '../shared/CollapsibleSection'
import ElementPill from '../shared/ElementPill'
import LevelSelector from '../shared/LevelSelector'
import MetadataChipSection from '../shared/MetadataChipSection'
import ObtainSection from '../shared/ObtainSection'
import OtherInformationSection from '../shared/OtherInformationSection'
import SourceLinksCard from '../shared/SourceLinksCard'
import WeaponCard from './WeaponCard'
import WeaponStatsTable from './WeaponStatsTable'

interface WeaponDetailProps {
  weapon: WeaponEntry
  filterBase: string
}

function WeaponImage({ src, name }: { src: string; name: string }) {
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

function WeaponSpecialButton({ imageUrl, name }: { imageUrl?: string; name: string }) {
  const [broken, setBroken] = useState(false)

  if (!imageUrl || broken) {
    return (
      <div className="w-16 h-20 bg-bg-elevated border border-border-default rounded flex items-center justify-center">
        <ImageOff className="w-6 h-6 text-text-muted" />
      </div>
    )
  }

  return (
    <img
      src={imageUrl}
      alt={`${name} button`}
      loading="lazy"
      onError={() => setBroken(true)}
      className="w-16 h-20 object-contain rounded border border-border-default shadow-subtle"
    />
  )
}

function WeaponSpecialCard({ special }: { special: WeaponSpecial }) {
  const title = special.activation === 'manual' ? 'Manual' : 'On Hit'

  return (
    <section className="mb-5">
      <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
        Weapon Special
      </h2>
      <div className="bg-bg-surface border border-border-default rounded-lg overflow-hidden">
        <div className="w-full flex items-center gap-4 p-4 text-left">
          <div className="flex-shrink-0">
            <WeaponSpecialButton imageUrl={special.imageUrl} name={title} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
            {special.trigger && (
              <p className="text-xs text-text-secondary italic mt-1 line-clamp-3 whitespace-pre-line break-words leading-relaxed">
                {normalizeDisplayText(special.trigger)}
              </p>
            )}
          </div>
        </div>

        <div className="px-4 pb-4 pt-0 border-t border-border-default">
          {special.effect && (
            <p className="text-text-secondary text-sm leading-relaxed mt-3 mb-4 whitespace-pre-line">
              {normalizeDisplayText(special.effect)}
            </p>
          )}

          {special.activation === 'manual' && (
            <div className="grid grid-cols-2 gap-2 text-center bg-bg-base rounded-lg p-3">
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">
                  Cooldown
                </p>
                <p className="text-xs font-medium text-text-secondary">
                  {special.cooldown || '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">
                  Charge Time
                </p>
                <p className="text-xs font-medium text-text-secondary">
                  {special.chargeTime || '—'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function buildSingleVariant(entry: Weapon): ObtainVariant[] {
  return entry.obtainMethods
}

function buildSingleWeaponLevel(entry: Weapon): LevelVariant {
  return {
    levelNumber: 1,
    levelDisplay: entry.level || '1',
    ...(entry.level && /^\d+$/.test(entry.level.trim())
      ? { actualLevel: Number.parseInt(entry.level.trim(), 10) }
      : {}),
    name: entry.name,
    damage: entry.damage ?? 'Unknown',
    stats: entry.stats ?? 'None',
    resists: entry.resists ?? 'None',
    obtainVariants: entry.obtainMethods,
    sourceUrl: entry.forumUrl,
    ...(entry.description ? { description: entry.description } : {}),
    ...(entry.imageUrl ? { imageUrl: entry.imageUrl } : {}),
    ...(entry.alternativeImages ? { alternativeImages: entry.alternativeImages } : {}),
    ...(entry.elements[0] ? { element: entry.elements[0] } : {}),
    ...(entry.rarity ? { rarity: entry.rarity } : {}),
    ...(entry.notes ? { notes: entry.notes } : {}),
  }
}

function nonEmptyAlternativeImages(
  images?: Array<{ url: string; caption: string }>
): Array<{ url: string; caption: string }> | undefined {
  return images && images.length > 0 ? images : undefined
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
  return `Level ${levelLabel}`
}

function getDefaultImageIndex(images: Array<{ url: string; caption: string }>): number {
  const defaultIndex = images.findIndex((image) => /\bdefault\b/i.test(image.caption))
  return defaultIndex >= 0 ? defaultIndex : 0
}

function getSelectorSyncLabel(label?: string): string {
  return normalizeDisplayText(label ?? '')
    .replace(/\s+\((?:default|clicked|clicked appearance)\)$/i, '')
    .trim()
    .toLowerCase()
}

function getPreferredImageIndexForVariant(
  images: Array<{ url: string; caption: string }>,
  variantLabel?: string
): number | undefined {
  const syncLabel = getSelectorSyncLabel(variantLabel)
  if (!syncLabel) return undefined

  const candidateIndexes = images.flatMap((image, index) =>
    getSelectorSyncLabel(image.caption) === syncLabel ? [index] : []
  )
  if (candidateIndexes.length === 0) return undefined

  return (
    candidateIndexes.find((index) => /\bdefault\b/i.test(images[index].caption)) ??
    candidateIndexes.find(
      (index) => normalizeDisplayText(images[index].caption).toLowerCase() === syncLabel
    ) ??
    candidateIndexes[0]
  )
}

function getStatsIdentity(level: LevelVariant): string {
  return [level.damage, level.stats, level.resists, level.rarity, level.element].join('|')
}

function getStatsRowKey(level: LevelVariant): string {
  const hasDA = level.obtainVariants.some((variant) => variant.daRequired)
  const hasDC = level.obtainVariants.some(obtainVariantHasDC)
  const hasDM = level.obtainVariants.some((variant) => variant.dmRequired || variant.priceType === 'dm')

  return [
    level.levelDisplay,
    level.actualLevel ?? '',
    getStatsIdentity(level),
    hasDA ? 'da' : '',
    hasDC ? 'dc' : '',
    hasDM ? 'dm' : '',
  ].join('|')
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

export default function WeaponDetail({ weapon, filterBase }: WeaponDetailProps) {
  const family = isWeaponFamily(weapon) ? (weapon as WeaponFamily) : undefined
  const singleWeapon = family ? undefined : (weapon as Weapon)
  const [activeIndex, setActiveIndex] = useState(0)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const initializedEntryKey = useRef<string | undefined>(undefined)
  const isMultiVariant = family && !isSingleVariant(family)
  const activeLevel = family
    ? family.levelVariants[Math.min(activeIndex, family.levelVariants.length - 1)]
    : undefined

  const title = family
    ? getWeaponDisplayName(getDisplayFamilyName(family))
    : getWeaponDisplayName(singleWeapon?.name ?? 'Weapon')
  const description = family
    ? (activeLevel?.description ?? family.shared.description)
    : singleWeapon?.description
  const imageUrl = family
    ? (family.shared.imageUrl ?? activeLevel?.imageUrl)
    : singleWeapon?.imageUrl
  const altImages = family
    ? (family.shared.alternativeImages ?? nonEmptyAlternativeImages(activeLevel?.alternativeImages))
    : singleWeapon?.alternativeImages
  const allImages = useMemo(() => {
    const validAltImages = altImages?.filter((image) => image.url) ?? []
    if (imageUrl && validAltImages.some((image) => image.url === imageUrl)) {
      return validAltImages.map((image, index) => ({
        url: image.url,
        caption:
          normalizeImageCaption(image.caption) ??
          inferImageCaptionFromUrl(image.url) ??
          `Alternative ${index + 1}`,
      }))
    }
    return buildDisplayImages({ imageUrl, alternativeImages: altImages, mainCaption: title })
  }, [altImages, imageUrl, title])
  const defaultImageIndex = useMemo(() => getDefaultImageIndex(allImages), [allImages])
  const currentImage = allImages[activeImageIndex] ?? allImages[defaultImageIndex]
  const useLevelOnlyLabels =
    family !== undefined && family.levelVariants.every((level) => !level.variantName)
  const variantLabels = useMemo(() => {
    if (!family) return []
    if (useLevelOnlyLabels) {
      return family.levelVariants.map((level) => String(level.actualLevel ?? level.levelDisplay))
    }
    return getLevelVariantLabels(family.levelVariants, family.familyName, 'weapon')
  }, [family, useLevelOnlyLabels])
  const imageVariantIndexes = useMemo(() => {
    const labelCounts = new Map<string, number>()
    for (const label of variantLabels) {
      const syncLabel = getSelectorSyncLabel(label)
      if (!syncLabel) continue
      labelCounts.set(syncLabel, (labelCounts.get(syncLabel) ?? 0) + 1)
    }

    return allImages.map((image) => {
      const imageSyncLabel = getSelectorSyncLabel(image.caption)
      if (!imageSyncLabel || labelCounts.get(imageSyncLabel) !== 1) return undefined
      const variantIndex = variantLabels.findIndex(
        (label) => getSelectorSyncLabel(label) === imageSyncLabel
      )
      return variantIndex >= 0 ? variantIndex : undefined
    })
  }, [allImages, variantLabels])
  const preferredImageIndexesByVariant = useMemo(
    () =>
      variantLabels.map((label) => getPreferredImageIndexForVariant(allImages, label)),
    [allImages, variantLabels]
  )
  const entryKey = family?.slug ?? singleWeapon?.slug ?? weapon.slug
  const defaultVariantIndex = imageVariantIndexes[defaultImageIndex]

  useEffect(() => {
    if (initializedEntryKey.current === entryKey) return
    initializedEntryKey.current = entryKey
    setActiveIndex(defaultVariantIndex ?? 0)
    setActiveImageIndex(defaultImageIndex)
  }, [defaultImageIndex, defaultVariantIndex, entryKey])

  useEffect(() => {
    if (!family || variantLabels.length === 0) return
    const currentImageVariantIndex = imageVariantIndexes[activeImageIndex]
    if (currentImageVariantIndex === activeIndex) return

    setActiveImageIndex(preferredImageIndexesByVariant[activeIndex] ?? defaultImageIndex)
  }, [
    activeImageIndex,
    activeIndex,
    defaultImageIndex,
    family,
    imageVariantIndexes,
    preferredImageIndexesByVariant,
    variantLabels.length,
  ])
  const access = family
    ? { da: family.hasDA, dc: family.hasDC, dm: family.hasDM }
    : {
        da: singleWeapon?.daRequired ?? false,
        dc: singleWeapon?.dcRequired ?? false,
        dm: singleWeapon?.dmRequired ?? false,
      }
  const obtainMethods = family
    ? (activeLevel?.obtainVariants ?? [])
    : singleWeapon
      ? buildSingleVariant(singleWeapon)
      : []
  const rarity = family ? (activeLevel?.rarity ?? family.shared.rarity) : singleWeapon?.rarity
  const ability = family ? family.shared.ability : singleWeapon?.ability
  const weaponSpecial = family ? family.shared.weaponSpecial : singleWeapon?.weaponSpecial
  const armorCustomization = family
    ? family.shared.armorCustomization
    : singleWeapon?.armorCustomization
  const displayLevels = useMemo(
    () =>
      family ? family.levelVariants : singleWeapon ? [buildSingleWeaponLevel(singleWeapon)] : [],
    [family, singleWeapon]
  )
  const statsDisplayLevels = useMemo(() => {
    const statsIdentities = new Set(displayLevels.map(getStatsIdentity))
    if (statsIdentities.size === 1) return displayLevels.slice(0, 1)

    const seen = new Set<string>()
    return displayLevels.filter((level) => {
      const key = getStatsRowKey(level)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [displayLevels])
  const statsRowsWereCollapsed = statsDisplayLevels.length < displayLevels.length
  const sourceLinks = useMemo(() => {
    if (!family) return [{ url: weapon.forumUrl, label: title }]

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
      (useLevelOnlyLabels || uniqueBaseSourceLabels.size === 1) &&
      uniqueLevelLabels.size > 1
    const seen = new Set<string>()
    const links = family.levelVariants.flatMap((level) => {
      const sourceUrl = level.sourceUrl ?? family.forumUrl
      const levelSuffix = getLevelSourceSuffix(level)
      const baseLabel = useLevelOnlyLabels
        ? normalizeSourceVariantLabel(family.familyName)
        : normalizeSourceVariantLabel(level.name)
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
      if (
        family.levelVariants.some((level) => (level.sourceUrl ?? family.forumUrl) === source.url)
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
  }, [family, title, useLevelOnlyLabels, weapon.forumUrl])
  const alsoSeeRefs = useMemo(() => {
    const currentSlugs = new Set(
      family ? [family.slug, ...(family.aliasSlugs ?? [])] : [singleWeapon?.slug ?? weapon.slug]
    )
    const refs = family ? (family.shared.alsoSee ?? []) : (singleWeapon?.alsoSee ?? [])
    return refs.filter((ref) => !currentSlugs.has(ref.slug))
  }, [family, singleWeapon, weapon.slug])
  const { relatedWeapons } = useRelatedWeapons(alsoSeeRefs)
  const resolvedRelatedWeapons = relatedWeapons.flatMap((related) =>
    related.entry ? [{ ref: related.ref, entry: related.entry }] : []
  )

  return (
    <main className="px-4 sm:px-6 py-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          {weapon.elements.map((code) => (
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
        {!!weapon.releaseDate && (
          <p className="text-sm text-text-muted">Released: {weapon.releaseDate}</p>
        )}
      </div>

      {family && family.levelVariants.length > 1 && (
        <section className="mb-8">
          <LevelSelector
            levels={family.levelVariants}
            activeIndex={activeIndex}
            onChange={setActiveIndex}
            familyName={family.familyName}
            itemType="weapon"
            forceLevelLabels={useLevelOnlyLabels}
          />
        </section>
      )}

      {currentImage && (
        <div className="mb-8">
          <WeaponImage src={currentImage.url} name={currentImage.caption ?? title} />
          {allImages.length > 1 && (
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {allImages.map((image, index) => (
                <button
                  key={`${image.url}-${index}`}
                  onClick={() => {
                    setActiveImageIndex(index)
                    const variantIndex = imageVariantIndexes[index]
                    if (variantIndex !== undefined) setActiveIndex(variantIndex)
                  }}
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

      {armorCustomization && (
        <ArmorCustomizationMetadataStrip
          modifies={armorCustomization.modifies}
          appearance={armorCustomization.appearance}
        />
      )}

      {displayLevels.length > 0 && (
        <section className="mb-8 space-y-6">
          <CollapsibleSection title="Stats by Level">
            <WeaponStatsTable
              levels={statsDisplayLevels}
              familyName={family?.familyName}
              forceHideVariantColumn={statsRowsWereCollapsed}
              forceLevelLabels={useLevelOnlyLabels}
            />
          </CollapsibleSection>
        </section>
      )}

      <MetadataChipSection label="Rarity" value={rarity} className="mb-8" />

      {ability && (
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

      {weaponSpecial && <WeaponSpecialCard special={weaponSpecial} />}

      <ObtainSection variants={obtainMethods} className="mb-8" />

      <OtherInformationSection
        notes={singleWeapon?.notes}
        sharedNotes={family?.shared.notes}
        activeVariantNotes={activeLevel?.notes}
        allVariantNotes={family?.levelVariants.map((level) => level.notes)}
      />

      <section className="mb-5">
        <SourceLinksCard links={sourceLinks} />
      </section>

      {resolvedRelatedWeapons.length > 0 && (
        <section aria-labelledby="related-heading" className="border-t border-border-default pt-6">
          <h2
            id="related-heading"
            className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3"
          >
            Also See
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {resolvedRelatedWeapons.map(({ ref, entry }) => (
              <li key={`${entry.slug}-${ref.url ?? 'route'}`}>
                <WeaponCard weapon={entry} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
