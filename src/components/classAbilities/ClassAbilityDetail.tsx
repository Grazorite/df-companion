import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ClassAbilityEntry, ClassAbilityItem } from '../../types/classAbility'
import { isClassAbilityFamily } from '../../types/classAbility'
import type { LevelVariant, ObtainVariant } from '../../types/item'
import type { GuestAttack } from '../../types/pet'
import { accessPillClass } from '../../utils/accessPillStyles'
import { normalizeDescriptionText } from '../../utils/displayText'
import { detailUrlWithFrom } from '../../utils/navigationContext'
import { useAwardedBadges } from '../../hooks/useBadgeRelations'
import { useClassAbilityRelatedItems } from '../../hooks/useClassAbilities'
import BadgeCard from '../badges/BadgeCard'
import ClassAbilityCard from './ClassAbilityCard'
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

interface ClassAbilityDetailProps {
  item: ClassAbilityEntry
  subtypeLabel: string
  backUrl: string
}

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
    attacks: item.attacks,
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

export default function ClassAbilityDetail({
  item,
  subtypeLabel,
  backUrl,
}: ClassAbilityDetailProps) {
  const family = isClassAbilityFamily(item) ? item : undefined
  const singleItem: ClassAbilityItem | undefined = isClassAbilityFamily(item) ? undefined : item
  const levels = useMemo(
    () => (family ? family.levelVariants : singleItem ? [singleToVariant(singleItem)] : []),
    [family, singleItem]
  )
  const [activeIndex, setActiveIndex] = useState(0)
  const activeVariant = levels[activeIndex] ?? levels[0]
  const name = family ? family.familyName : (singleItem?.name ?? 'Class / Ability')
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
  const dialogue = cleanDialogue(
    activeVariant?.dialogue ?? family?.shared.dialogue ?? singleItem?.dialogue
  )
  const effectAttacks =
    asGuestAttacks(activeVariant?.attacks) ??
    asGuestAttacks(family?.shared.attacks) ??
    singleItem?.attacks
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
  const showTempPill = item.subtype !== 'consumable' && item.isTemp
  const isArmor = item.subtype === 'class' && item.classSubcategory === 'armor'
  const armorMetrics = isArmor
    ? [
        { label: 'Level', value: level },
        { label: 'Rarity', value: rarity },
        { label: 'Equips Class', value: equipsClass },
      ]
    : []
  const { relatedClassAbilities } = useClassAbilityRelatedItems(item)
  const resolvedRelatedClassAbilities = relatedClassAbilities.filter((related) =>
    Boolean(related.entry)
  )
  const badgeRelationTexts = useMemo(
    () => [
      singleItem?.notes,
      singleItem?.description,
      family?.shared.notes,
      family?.shared.description,
      ...(family?.levelVariants.flatMap((variant) => [variant.notes, variant.description]) ?? []),
    ],
    [family, singleItem]
  )
  const awardedBadges = useAwardedBadges(badgeRelationTexts)

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
          {hasDA && <span className={accessPillClass('da', 'detail')}>DA Required</span>}
          {hasDC && <span className={accessPillClass('dc', 'detail')}>DC</span>}
          {hasDM && <span className={accessPillClass('dm', 'detail')}>DM</span>}
          {hasMerge && (
            <span className="text-xs text-amber-200 bg-amber-500/20 px-3 py-1.5 rounded-full font-medium">
              Merge Required
            </span>
          )}
          {hasMultiple && (
            <span className="text-xs text-bg-base bg-gold px-3 py-1.5 rounded-full font-medium">
              Multiple Versions
            </span>
          )}
          {showTempPill && (
            <span className="text-xs text-cyan-300 bg-cyan-500/20 px-3 py-1.5 rounded-full font-medium">
              Temp
            </span>
          )}
          <DetailTypePill label={subtypeLabel} />
        </div>
        <h1 className="text-3xl font-bold text-text-primary mb-3">{name}</h1>
        {description && (
          <p className="text-text-secondary italic leading-relaxed">{description}</p>
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

      {effect && (!showEffectAccordion || !effectAttacks?.length) && (
        <section className="bg-bg-surface border border-border-default rounded-lg p-5 mb-5">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
            Effect
          </h2>
          <p className="text-sm text-text-secondary whitespace-pre-line leading-relaxed">{effect}</p>
        </section>
      )}

      {showEffectAccordion && effectAttacks && effectAttacks.length > 0 && (
        <GuestAttacks attacks={effectAttacks} heading="Effect" imageLabel="Effect Image" />
      )}

      {imageUrl && (
        <section className="mb-6">
          <ItemImage src={imageUrl} alt={name} className="max-h-80 mx-auto" />
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

      {!isArmor && <MetadataChipSection label="Rarity" value={rarity} className="mb-5" />}

      <ObtainSection variants={obtainMethods} showPriceFields={showObtainPriceFields} />

      {dialogue && (
        <section className="bg-bg-surface border border-border-default rounded-lg p-5 mb-5">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
            Dialogue
          </h2>
          <NotesList notes={dialogue} />
        </section>
      )}

      <OtherInformationSection
        notes={singleItem?.notes}
        sharedNotes={family?.shared.notes}
        activeVariantNotes={activeVariant?.notes}
        allVariantNotes={family?.levelVariants.map((variant) => variant.notes)}
        className="mb-5"
      />

      <section className="mb-5">
        <SourceLinksCard links={getSourceLinks(item)} />
      </section>

      {(resolvedRelatedClassAbilities.length > 0 || awardedBadges.length > 0) && (
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
            {awardedBadges.map((badge) => (
              <li key={`badge-${badge.slug}`}>
                <BadgeCard badge={badge} toUrl={`/badges/${badge.slug}`} badgeLabel="Badge" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </DetailPageLayout>
  )
}
