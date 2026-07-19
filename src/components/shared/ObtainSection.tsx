import type { ObtainVariant } from '../../types/item'
import ObtainVariantCard from './ObtainVariantCard'

interface ObtainSectionProps {
  variants: ObtainVariant[]
  isGuest?: boolean
  locationOnly?: boolean
  className?: string
}

export default function ObtainSection({
  variants,
  isGuest = false,
  locationOnly = false,
  className = 'mb-5',
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
          />
        ))}
      </div>
    </section>
  )
}
