import { useEffect, useMemo, useState } from 'react'
import type { LevelVariant, ObtainVariant } from '../../types/item'
import type { Weapon, WeaponEntry, WeaponFamily } from '../../types/weapon'
import { isWeaponFamily } from '../../types/weapon'
import { useRelatedWeapons } from '../../hooks/useWeapons'
import { displayTitle, normalizeDisplayText } from '../../utils/displayText'
import { buildDisplayImages } from '../../utils/imageLabels'
import { getDisplayFamilyName, isSingleVariant } from '../../utils/variantHelpers'
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

export default function WeaponDetail({ weapon, filterBase }: WeaponDetailProps) {
  const family = isWeaponFamily(weapon) ? (weapon as WeaponFamily) : undefined
  const singleWeapon = family ? undefined : (weapon as Weapon)
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
  const allImages = useMemo(
    () => buildDisplayImages({ imageUrl, alternativeImages: altImages, mainCaption: title }),
    [altImages, imageUrl, title]
  )
  const currentImage = allImages[activeImageIndex]
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
  const displayLevels = useMemo(
    () =>
      family ? family.levelVariants : singleWeapon ? [buildSingleWeaponLevel(singleWeapon)] : [],
    [family, singleWeapon]
  )
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
  }, [family, title, weapon.forumUrl])
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

      {currentImage && (
        <div className="mb-8">
          <WeaponImage src={currentImage.url} name={currentImage.caption ?? title} />
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

      {displayLevels.length > 0 && (
        <section className="mb-8 space-y-6">
          <CollapsibleSection title="Stats by Level">
            <WeaponStatsTable levels={displayLevels} familyName={family?.familyName} />
          </CollapsibleSection>
          {family && family.levelVariants.length > 1 && (
            <LevelSelector
              levels={family.levelVariants}
              activeIndex={activeIndex}
              onChange={setActiveIndex}
              familyName={family.familyName}
              itemType="weapon"
            />
          )}
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
