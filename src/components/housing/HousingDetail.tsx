import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import type { HousingEntry, HousingItem } from '../../types/housing'
import { isHousingFamily } from '../../types/housing'
import type { ObtainVariant } from '../../types/item'
import DetailTypePill from '../shared/DetailTypePill'
import ItemImage from '../shared/ItemImage'
import SourceLinksCard from '../shared/SourceLinksCard'
import OtherInformationSection from '../shared/OtherInformationSection'
import LevelSelector from '../shared/LevelSelector'
import ObtainSection from '../shared/ObtainSection'
import { buildDisplayImages } from '../../utils/imageLabels'
import { useHousingRelatedItems } from '../../hooks/useHousing'
import { detailUrlWithFrom } from '../../utils/navigationContext'
import { accessPillClass } from '../../utils/accessPillStyles'
import { normalizeDescriptionText } from '../../utils/displayText'
import HousingCard from './HousingCard'

interface HousingDetailProps {
  item: HousingEntry
  subtypeLabel: string
  backUrl: string
}

function parseFurnishingSlots(value?: string): Array<{ label: string; value: string }> {
  if (!value) return []
  return value
    .replace(/^Furnish(?:ing)? Slots?:\s*/i, '')
    .split(',')
    .map((part) => {
      const [label, slotValue] = part.split(':')
      if (!label || !slotValue) return undefined
      return { label: label.trim(), value: slotValue.trim() }
    })
    .filter((slot): slot is { label: string; value: string } => Boolean(slot))
}

function HousingCapacityCard({
  capacity,
  furnishingSlots,
}: {
  capacity?: string
  furnishingSlots?: string
}) {
  const slots = parseFurnishingSlots(furnishingSlots)
  if (!capacity && slots.length === 0) return null

  return (
    <section className="mb-5">
      <div className="bg-bg-surface border border-border-default rounded-lg p-4">
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
          Capacity{capacity ? ` (${capacity})` : ''}
        </h2>
        {slots.length > 0 && (
          <div className="space-y-0.5">
            {slots.map((slot) => (
              <div key={slot.label} className="flex justify-between text-sm py-0.5">
                <span className="text-text-muted">{slot.label}</span>
                <span className="text-text-secondary font-medium">{slot.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function withoutLocationUrl(obtain: ObtainVariant): ObtainVariant {
  return {
    location: obtain.location,
    price: obtain.price,
    priceType: obtain.priceType,
    daRequired: obtain.daRequired,
    ...(obtain.sellback ? { sellback: obtain.sellback } : {}),
    ...(obtain.requirements ? { requirements: obtain.requirements } : {}),
    ...(obtain.dcRequired ? { dcRequired: obtain.dcRequired } : {}),
    ...(obtain.dmRequired ? { dmRequired: obtain.dmRequired } : {}),
    ...(obtain.requiredItems ? { requiredItems: obtain.requiredItems } : {}),
  }
}

function HousingEffectCard({ effect }: { effect?: string }) {
  if (!effect || /^(?:none|n\/?a)$/i.test(effect.trim())) return null

  return (
    <section className="mb-5">
      <div className="bg-bg-surface border border-border-default rounded-lg p-5">
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
          Effect
        </h2>
        <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">{effect}</p>
      </div>
    </section>
  )
}

export default function HousingDetail({ item, subtypeLabel, backUrl }: HousingDetailProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const family = isHousingFamily(item) ? item : undefined
  const singleItem = family ? undefined : (item as HousingItem)
  const activeVariant = family
    ? family.levelVariants[Math.min(activeIndex, family.levelVariants.length - 1)]
    : undefined
  const name = family ? family.familyName : (singleItem?.name ?? 'Housing')
  const description = normalizeDescriptionText(
    family ? (activeVariant?.description ?? family.shared.description) : singleItem?.description
  )
  const imageUrl = family ? activeVariant?.imageUrl : singleItem?.imageUrl
  const alternativeImages = family ? activeVariant?.alternativeImages : singleItem?.alternativeImages
  const allImages = useMemo(
    () =>
      buildDisplayImages({
        imageUrl,
        alternativeImages,
        mainCaption: 'Main',
      }),
    [alternativeImages, imageUrl]
  )
  const currentImage = allImages[activeImageIndex]
  const obtainMethods: ObtainVariant[] = (
    family
    ? (activeVariant?.obtainVariants ?? [])
    : (singleItem?.obtainMethods ?? [])
  ).map(withoutLocationUrl)
  const rarity = family ? activeVariant?.rarity : singleItem?.rarity
  const capacity = family ? activeVariant?.capacity : singleItem?.capacity
  const furnishingSlots = family ? activeVariant?.furnishingSlots : singleItem?.furnishingSlots
  const effect = family ? activeVariant?.effect : singleItem?.effect
  const notes = family ? activeVariant?.notes : singleItem?.notes
  const { relatedHousing } = useHousingRelatedItems(item)
  const sourceLinks = family?.familySources?.length
    ? family.familySources.map((source) => ({ label: source.title, url: source.url }))
    : [
        {
          label: name,
          url: item.forumUrl || (family ? family.forumUrl : singleItem?.sourceUrl ?? ''),
        },
      ]

  useEffect(() => {
    setActiveImageIndex(0)
  }, [activeIndex, item.slug])

  return (
    <article className="px-4 sm:px-6 py-6 max-w-5xl mx-auto">
      <Link
        to={backUrl}
        className="flex items-center gap-1.5 text-text-secondary hover:text-text-primary text-sm mb-6 transition-colors duration-150 min-h-[44px] -ml-1 px-1"
        aria-label="Back to housing list"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Back to Housing
      </Link>

      <header className="mb-8">
        <div className="flex items-start gap-2 flex-wrap mb-3">
          <span className={accessPillClass('da', 'housingHeader')}>
            DA Required
          </span>
          {(family ? family.hasDC : singleItem?.dcRequired) && (
            <span className={accessPillClass('dc', 'housingHeader')}>
              DC
            </span>
          )}
          {(family ? family.hasFree : singleItem?.hasFree) && (
            <span className="text-xs text-green-400 bg-green-500/20 px-3 py-1.5 rounded-full font-medium">
              Free
            </span>
          )}
          {(family ? family.tags.includes('special-effect') : singleItem?.hasSpecialEffect) && (
            <span className="text-xs text-sky-300 bg-sky-500/20 px-3 py-1.5 rounded-full font-medium">
              Effect
            </span>
          )}
          <DetailTypePill label={subtypeLabel} />
        </div>
        <h1 className="text-3xl font-bold text-text-primary mb-3">{name}</h1>
        {description && (
          <p className="text-text-secondary italic leading-relaxed">{description}</p>
        )}
      </header>

      {family && family.levelVariants.length > 1 && (
        <section className="mb-8">
          <LevelSelector
            levels={family.levelVariants}
            activeIndex={activeIndex}
            onChange={setActiveIndex}
            familyName={family.familyName}
            itemType="housing"
          />
        </section>
      )}

      <div className="mb-8">
        <ItemImage src={currentImage?.url} alt={currentImage?.caption ?? name} showPlaceholder />
        {currentImage && allImages.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            {allImages.map((image, index) => (
              <button
                key={image.url}
                type="button"
                onClick={() => setActiveImageIndex(index)}
                className={`min-h-11 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
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

      <HousingEffectCard effect={effect} />

      <HousingCapacityCard capacity={capacity} furnishingSlots={furnishingSlots} />

      {rarity && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
            Rarity
          </h2>
          <span className="inline-flex min-w-11 min-h-11 items-center justify-center rounded-lg bg-bg-overlay px-3 text-text-secondary font-semibold">
            {rarity}
          </span>
        </section>
      )}

      <ObtainSection variants={obtainMethods} showCurrencyAccessPills />

      {notes && <OtherInformationSection notes={notes} />}

      <SourceLinksCard links={sourceLinks} />

      {relatedHousing.length > 0 && (
        <section aria-labelledby="related-heading" className="mt-5 border-t border-border-default pt-6">
          <h2
            id="related-heading"
            className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3"
          >
            Also See
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {relatedHousing.map((related) => (
              <li key={related.slug}>
                <HousingCard
                  item={related}
                  toUrl={detailUrlWithFrom(
                    `/housing/${related.slug}?type=${encodeURIComponent(related.subtype)}`,
                    backUrl
                  )}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}
