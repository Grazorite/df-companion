import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ClassAbilityEntry, ClassAbilityItem } from '../../types/classAbility'
import { isClassAbilityFamily } from '../../types/classAbility'
import type { LevelVariant, MechanicsBlock, ObtainVariant } from '../../types/item'
import type { GuestAttack, GuestAttackSet, GuestStats } from '../../types/pet'
import { displayTitle, normalizeDescriptionText } from '../../utils/displayText'
import { buildDisplayImages } from '../../utils/imageLabels'
import { detailUrlWithFrom } from '../../utils/navigationContext'
import { useBadgeInlineLinksForItem } from '../../hooks/useBadgeRelations'
import {
  useArtifactInlineLinksForClass,
  useClassArtifactRelationsForClass,
} from '../../hooks/useClassArtifactRelations'
import { useClassDefaultWeaponRelationForClass } from '../../hooks/useClassDefaultWeaponRelations'
import { useClassAbilityRelatedItems } from '../../hooks/useClassAbilities'
import ClassAbilityCard from './ClassAbilityCard'
import AccessPills from '../shared/AccessPills'
import DetailTypePill from '../shared/DetailTypePill'
import DetailPageLayout from '../shared/DetailPageLayout'
import ExpandableImageList from '../shared/ExpandableImageList'
import ItemImage from '../shared/ItemImage'
import LevelSelector from '../shared/LevelSelector'
import MetricStrip from '../shared/MetricStrip'
import MetadataChipSection from '../shared/MetadataChipSection'
import NotesList from '../shared/NotesList'
import ObtainSection from '../shared/ObtainSection'
import OtherInformationSection from '../shared/OtherInformationSection'
import SourceLinksCard from '../shared/SourceLinksCard'
import GuestAttacks from '../guests/GuestAttacks'
import GuestStatsSection from '../guests/GuestStatsSection'
import { buildFilterLink } from '../../utils/filterLinks'

interface ClassAbilityDetailProps {
  item: ClassAbilityEntry
  subtypeLabel: string
  backUrl: string
  filterBase: string
}

const EMPTY_ATTACK_SETS: GuestAttackSet[] = []

function singleToVariant(item: ClassAbilityItem): LevelVariant {
  return {
    levelNumber: Number.parseInt(item.level ?? '0', 10) || 0,
    levelDisplay: item.level ?? '—',
    actualLevel: item.level ? Number.parseInt(item.level, 10) : undefined,
    name: item.name,
    damage: '—',
    stats: '—',
    obtainVariants: item.obtainMethods ?? [],
    sourceUrl: item.sourceUrl,
    description: item.description,
    imageUrl: item.imageUrl,
    alternativeImages: item.alternativeImages,
    rarity: item.rarity,
    effect: item.effect,
    effectType: item.effectType,
    equipsClass: item.equipsClass,
    equipsClassUrl: item.equipsClassUrl,
    defaultWeapon: item.defaultWeapon,
    defaultWeaponUrl: item.defaultWeaponUrl,
    guestStats: item.guestStats,
    attacks: item.attacks,
    attackSets: item.attackSets,
    mechanics: item.mechanics,
    dialogue: item.dialogue,
    notes: item.notes,
  }
}

function getObtainMethods(item: ClassAbilityEntry, activeVariant?: LevelVariant): ObtainVariant[] {
  if (isClassAbilityFamily(item)) return activeVariant?.obtainVariants ?? []
  return item.obtainMethods ?? []
}

function getSourceLinks(item: ClassAbilityEntry) {
  if (isClassAbilityFamily(item)) {
    return item.familySources?.length
      ? item.familySources.map((source) => ({ url: source.url, label: source.title }))
      : item.levelVariants.map((variant) => ({
          url: variant.sourceUrl ?? item.forumUrl,
          label: variant.name,
        }))
  }
  return [{ url: item.sourceUrl, label: item.name }]
}

function hasMeaningfulPriceOrSellback(methods: ObtainVariant[]): boolean {
  return methods.some(
    (method) =>
      (method.price && !/^(?:none|n\/?a)$/i.test(method.price.trim())) ||
      (method.sellback && !/^(?:none|n\/?a)$/i.test(method.sellback.trim()))
  )
}

function asGuestAttacks(attacks: LevelVariant['attacks']): GuestAttack[] | undefined {
  if (!attacks) return undefined
  const guestAttacks = attacks.filter(
    (attack): attack is GuestAttack =>
      'effect' in attack && 'manaCost' in attack && 'damageType' in attack && 'element' in attack
  )
  return guestAttacks.length > 0 ? guestAttacks : undefined
}

function usesEffectAccordion(name: string): boolean {
  return /^(?:Health Potion|Mana Potion)$/i.test(name.trim())
}

function cleanDialogue(dialogue: string | undefined): string | undefined {
  const cleaned = dialogue?.replace(/^Dialogue\s*\n(?=\s*quote:)/i, '').trim()
  return cleaned || undefined
}

function normalizeClassMechanicsTitle(value: string | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/^artifact:\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function ClassMechanicsSection({
  mechanics,
  hiddenTitle,
}: {
  mechanics?: MechanicsBlock[]
  hiddenTitle?: string
}) {
  const blocks = mechanics?.filter((block) => block.notes || block.images?.length)
  if (!blocks?.length) return null
  const normalizedHiddenTitle = normalizeClassMechanicsTitle(hiddenTitle)

  return (
    <section className="bg-bg-surface border border-border-default rounded-lg p-5 mb-5">
      <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
        Class Mechanics
      </h2>
      <div className="space-y-5">
        {blocks.map((block, index) => (
          <div key={`${block.title ?? 'mechanics'}-${index}`} className="space-y-3">
            {block.title &&
              normalizeClassMechanicsTitle(block.title) !== normalizedHiddenTitle && (
                <h3 className="text-sm font-semibold text-text-primary">{block.title}</h3>
              )}
            {block.images && block.images.length > 0 && (
              <div className="space-y-4">
                {block.images.map((image, imageIndex) => (
                  <figure
                    key={`${image.url}-${imageIndex}`}
                    className="flex flex-col items-center gap-2"
                  >
                    <img
                      src={image.url}
                      alt={image.caption}
                      loading="lazy"
                      className="max-w-full rounded border border-border-default"
                    />
                    <figcaption className="text-xs italic text-text-secondary text-center">
                      {image.caption}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
            {block.notes && <NotesList notes={block.notes} />}
          </div>
        ))}
      </div>
    </section>
  )
}

function classDisplayStats(stats: GuestStats | undefined): GuestStats | undefined {
  if (!stats) return undefined
  const rest = { ...stats }
  delete rest.level
  delete rest.damage
  delete rest.damageType
  delete rest.element
  return rest
}

export default function ClassAbilityDetail({
  item,
  subtypeLabel,
  backUrl,
  filterBase,
}: ClassAbilityDetailProps) {
  const family = isClassAbilityFamily(item) ? item : undefined
  const singleItem: ClassAbilityItem | undefined = isClassAbilityFamily(item) ? undefined : item
  const isArmor = item.subtype === 'class' && item.classSubcategory === 'armor'
  const isConsumable = item.subtype === 'consumable'
  const levels = useMemo(
    () => (family ? family.levelVariants : singleItem ? [singleToVariant(singleItem)] : []),
    [family, singleItem]
  )
  const [activeIndex, setActiveIndex] = useState(0)
  const activeVariant = levels[activeIndex] ?? levels[0]
  const name = family ? family.familyName : (singleItem?.name ?? 'Class / Ability')
  const releaseDate = family?.releaseDate ?? singleItem?.releaseDate
  const description = normalizeDescriptionText(
    activeVariant?.description ?? family?.shared.description ?? singleItem?.description
  )
  const imageUrl = activeVariant?.imageUrl ?? family?.shared.imageUrl ?? singleItem?.imageUrl
  const alternativeImages =
    activeVariant?.alternativeImages ?? family?.shared.alternativeImages ?? singleItem?.alternativeImages
  const effect = activeVariant?.effect ?? family?.shared.effect ?? singleItem?.effect
  const effectType =
    activeVariant?.effectType ?? family?.shared.effectType ?? singleItem?.effectType
  const equipsClass =
    activeVariant?.equipsClass ?? family?.shared.equipsClass ?? singleItem?.equipsClass
  const defaultWeapon =
    activeVariant?.defaultWeapon ?? family?.shared.defaultWeapon ?? singleItem?.defaultWeapon
  const defaultWeaponRelation = useClassDefaultWeaponRelationForClass(item.slug, defaultWeapon)
  const guestStats =
    activeVariant?.guestStats ?? family?.shared.guestStats ?? singleItem?.guestStats
  const displayedGuestStats = !isArmor && !isConsumable ? classDisplayStats(guestStats) : guestStats
  const baseMechanics =
    activeVariant?.mechanics ?? family?.shared.mechanics ?? singleItem?.mechanics
  const dialogue = cleanDialogue(
    activeVariant?.dialogue ?? family?.shared.dialogue ?? singleItem?.dialogue
  )
  const baseAttacks =
    asGuestAttacks(activeVariant?.attacks) ??
    asGuestAttacks(family?.shared.attacks) ??
    singleItem?.attacks
  const artifactAttackSets =
    activeVariant?.attackSets ?? family?.shared.attackSets ?? singleItem?.attackSets ?? EMPTY_ATTACK_SETS
  const attackOptions = useMemo(() => {
    if (isArmor || isConsumable) return []
    const options: Array<GuestAttackSet & { mechanics?: MechanicsBlock[] }> = []
    if (baseAttacks?.length) {
      options.push({
        id: 'base',
        label: 'Base',
        attacks: baseAttacks,
        ...(baseMechanics?.length ? { mechanics: baseMechanics } : {}),
      })
    }
    for (const set of artifactAttackSets) {
      options.push(set)
    }
    return options
  }, [artifactAttackSets, baseAttacks, baseMechanics, isArmor, isConsumable])
  const effectAttacks = isConsumable ? baseAttacks : undefined
  const [activeAttackSetId, setActiveAttackSetId] = useState('base')
  useEffect(() => {
    setActiveAttackSetId((current) =>
      attackOptions.some((option) => option.id === current) ? current : (attackOptions[0]?.id ?? 'base')
    )
  }, [attackOptions])
  const selectedAttackOption =
    attackOptions.find((option) => option.id === activeAttackSetId) ?? attackOptions[0]
  const selectedAttackSetNotes =
    selectedAttackOption && selectedAttackOption.id !== 'base'
      ? selectedAttackOption.notes
      : undefined
  const selectedMechanics =
    selectedAttackOption && selectedAttackOption.id !== 'base'
      ? selectedAttackOption.mechanics
      : baseMechanics
  const showEffectAccordion = usesEffectAccordion(name)
  const rarity = activeVariant?.rarity ?? family?.shared.rarity ?? singleItem?.rarity
  const level = activeVariant?.levelDisplay ?? singleItem?.level
  const obtainMethods = getObtainMethods(item, activeVariant)
  const showObtainPriceFields = hasMeaningfulPriceOrSellback(obtainMethods)
  const hasDA = family ? family.hasDA : singleItem?.daRequired
  const hasDC = family ? family.hasDC : singleItem?.dcRequired
  const hasDM = family ? family.hasDM : singleItem?.dmRequired
  const hasMerge = family ? family.hasMerge : singleItem?.hasMerge
  const hasMultiple = family ? family.levelVariants.length > 1 : false
  const armorMetrics = isArmor
    ? [
        { label: 'Level', value: level },
        { label: 'Rarity', value: rarity },
        { label: 'Equips Class', value: equipsClass },
      ]
    : []
  const allImages = useMemo(
    () =>
      buildDisplayImages({
        imageUrl,
        alternativeImages,
        mainCaption: displayTitle(name),
      }),
    [alternativeImages, imageUrl, name]
  )
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const entryKey = item.slug
  const initializedImageEntryKey = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (initializedImageEntryKey.current !== entryKey) {
      initializedImageEntryKey.current = entryKey
      setActiveImageIndex(0)
      return
    }
    setActiveImageIndex((current) => (current < allImages.length ? current : 0))
  }, [allImages.length, entryKey])

  const currentImage = allImages[activeImageIndex]
  const { relatedClassAbilities } = useClassAbilityRelatedItems(item)
  const resolvedRelatedClassAbilities = relatedClassAbilities.filter((related) =>
    Boolean(related.entry)
  )
  const badgeInlineLinks = useBadgeInlineLinksForItem(item.slug)
  const artifactInlineLinks = useArtifactInlineLinksForClass(item.slug)
  const classArtifactRelations = useClassArtifactRelationsForClass(item.slug)
  const selectedArtifactRelation =
    selectedAttackOption && selectedAttackOption.id !== 'base'
      ? classArtifactRelations.find((relation) =>
          [relation.artifactName, ...(relation.artifactAliases ?? [])].some(
            (name) => name.toLowerCase() === selectedAttackOption.label.toLowerCase()
          )
        )
      : undefined
  const noteLinks = useMemo(
    () => [...badgeInlineLinks, ...artifactInlineLinks],
    [artifactInlineLinks, badgeInlineLinks]
  )

  return (
    <DetailPageLayout>
      <Link
        to={backUrl}
        className="inline-flex items-center text-sm text-text-muted hover:text-text-primary mb-5 transition-colors"
      >
        ← Back to Classes / Abilities
      </Link>

      <header className="mb-6">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <AccessPills
            daRequired={Boolean(hasDA)}
            dcRequired={hasDC}
            dmRequired={hasDM}
            filterBase={filterBase}
          />
          {hasMerge && (
            <Link
              to={buildFilterLink(filterBase, 'access', 'merge')}
              className="text-xs text-amber-200 bg-amber-500/20 px-3 py-1.5 rounded-full font-medium transition-opacity hover:opacity-80"
            >
              Merge Required
            </Link>
          )}
          {hasMultiple && (
            <Link
              to={buildFilterLink(filterBase, 'access', 'multi')}
              className="text-xs text-bg-base bg-gold px-3 py-1.5 rounded-full font-medium transition-opacity hover:opacity-80"
            >
              Multiple Versions
            </Link>
          )}
          <DetailTypePill label={subtypeLabel} />
        </div>
        <h1 className="text-3xl font-bold text-text-primary mb-3">{name}</h1>
        {description && (
          <p className="text-text-secondary italic leading-relaxed">{description}</p>
        )}
        {releaseDate && (
          <p className="text-sm text-text-muted mt-2">Released: {releaseDate}</p>
        )}
        {effectType && (
          <p className="text-xs text-text-muted mt-2">Effect Type: {effectType}</p>
        )}
      </header>

      {isArmor && <MetricStrip metrics={armorMetrics} variant="panel" className="mb-6" />}

      {levels.length > 1 && (
        <section className="mb-8">
          <LevelSelector
            levels={levels}
            activeIndex={activeIndex}
            onChange={setActiveIndex}
            familyName={family?.familyName}
            itemType="class-ability"
          />
        </section>
      )}

      {!isArmor && currentImage && (
        <div className="mb-6">
          <ItemImage
            src={currentImage.url}
            alt={currentImage.caption}
            showPlaceholder
            priority
          />
          {allImages.length > 1 && (
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {allImages.map((image, index) => (
                <button
                  key={`${image.url}-${index}`}
                  type="button"
                  onClick={() => setActiveImageIndex(index)}
                  className={`min-h-11 px-4 py-2 rounded-lg text-sm transition-colors ${
                    index === activeImageIndex
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

      {isArmor && imageUrl && (
        <section className="mb-6">
          <ItemImage src={imageUrl} alt={name} priority className="max-h-80 mx-auto" />
          {alternativeImages && alternativeImages.length > 0 && (
            <div className="mt-3">
              <ExpandableImageList
                images={alternativeImages.map((image) => image.url)}
                captions={alternativeImages.map((image) => image.caption)}
                label="Alternative Image"
                altPrefix={name}
              />
            </div>
          )}
        </section>
      )}

      {!isArmor && displayedGuestStats && <GuestStatsSection stats={displayedGuestStats} />}

      {isConsumable && effect && (!showEffectAccordion || !effectAttacks?.length) && (
        <section className="bg-bg-surface border border-border-default rounded-lg p-5 mb-5">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
            Effect
          </h2>
          <p className="text-sm text-text-secondary whitespace-pre-line leading-relaxed">{effect}</p>
        </section>
      )}

      {isConsumable && showEffectAccordion && effectAttacks && effectAttacks.length > 0 && (
        <GuestAttacks attacks={effectAttacks} heading="Effect" imageLabel="Effect Image" />
      )}

      {!isArmor && <MetadataChipSection label="Rarity" value={rarity} className="mb-5" />}

      <ObtainSection variants={obtainMethods} showPriceFields={showObtainPriceFields} />

      {defaultWeapon && (
        <section className="bg-bg-surface border border-border-default rounded-lg p-5 mb-5">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
            Default Weapon
          </h2>
          {defaultWeaponRelation ? (
            <Link
              to={defaultWeaponRelation.weaponRoute}
              className="text-sm text-gold hover:text-gold-light transition-colors"
            >
              {defaultWeapon}
            </Link>
          ) : (
            <p className="text-sm text-text-secondary">{defaultWeapon}</p>
          )}
        </section>
      )}

      {dialogue && (
        <section className="bg-bg-surface border border-border-default rounded-lg p-5 mb-5">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
            Dialogue
          </h2>
          <NotesList notes={dialogue} />
        </section>
      )}

      {!isArmor && !isConsumable && attackOptions.length > 1 && (
        <section className="mb-5">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
            Select Attack Set
          </h2>
          <div className="flex flex-wrap gap-2">
            {attackOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setActiveAttackSetId(option.id)}
                className={`min-h-10 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  option.id === activeAttackSetId
                    ? 'bg-gold text-bg-base'
                    : 'bg-bg-surface border border-border-default text-text-secondary hover:text-text-primary hover:border-border-hover'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {!isArmor && !isConsumable && selectedArtifactRelation && (
        <section className="mb-3 text-sm text-text-secondary">
          Artifact:{' '}
          <Link
            to={selectedArtifactRelation.artifactRoute}
            className="text-gold hover:text-gold-light transition-colors"
          >
            {selectedAttackOption?.label}
          </Link>
        </section>
      )}

      {!isArmor && !isConsumable && selectedMechanics && (
        <ClassMechanicsSection
          mechanics={selectedMechanics}
          hiddenTitle={selectedArtifactRelation?.artifactName}
        />
      )}

      {!isArmor && !isConsumable && selectedAttackOption?.attacks.length ? (
        <GuestAttacks attacks={selectedAttackOption.attacks} />
      ) : null}

      <OtherInformationSection
        notes={singleItem?.notes}
        sharedNotes={family?.shared.notes}
        activeVariantNotes={
          [activeVariant?.notes, selectedAttackSetNotes].filter(Boolean).join('\n\n') || undefined
        }
        allVariantNotes={family?.levelVariants.map((variant) => variant.notes)}
        className="mb-5"
        links={noteLinks}
      />

      <section className="mb-5">
        <SourceLinksCard links={getSourceLinks(item)} />
      </section>

      {resolvedRelatedClassAbilities.length > 0 && (
        <section aria-labelledby="related-heading" className="border-t border-border-default pt-6">
          <h2
            id="related-heading"
            className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3"
          >
            Also See
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {resolvedRelatedClassAbilities.map(({ ref, entry, relation }) =>
              entry ? (
                <li key={`${entry.slug}-${ref?.url ?? relation}`}>
                  <ClassAbilityCard
                    item={entry}
                    toUrl={detailUrlWithFrom(
                      `/classes/${entry.slug}?type=${encodeURIComponent(entry.subtype)}`,
                      backUrl
                    )}
                  />
                </li>
              ) : null
            )}
          </ul>
        </section>
      )}
    </DetailPageLayout>
  )
}
