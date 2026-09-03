import type { ObtainVariant } from '../../types/item'
import type { InlineTextLink } from '../../types/inlineLink'
import ObtainVariantCard from './ObtainVariantCard'

interface ObtainSectionProps {
  variants: ObtainVariant[]
  isGuest?: boolean
  locationOnly?: boolean
  className?: string
  showCurrencyAccessPills?: boolean
  showPriceFields?: boolean
  links?: InlineTextLink[]
}

export default function ObtainSection({
  variants,
  isGuest = false,
  locationOnly = false,
  className = 'mb-5',
  showCurrencyAccessPills = true,
  showPriceFields = true,
  links = [],
}: ObtainSectionProps) {
  if (variants.length === 0) return null

  return (
    <section aria-labelledby="obtain-heading" className={className}>
      <div className="space-y-3">
        {variants.map((variant, index) => (
          <ObtainVariantCard
            key={`${variant.location}-${index}`}
            variant={variant}
            label={variants.length > 1 ? `Method ${index + 1}` : undefined}
            isGuest={isGuest}
            locationOnly={locationOnly}
            showCurrencyAccessPills={showCurrencyAccessPills}
            showPriceFields={showPriceFields}
            links={links}
          />
        ))}
      </div>
    </section>
  )
}
