import type { ObtainMethod } from '../../types/pet'

interface ObtainCardProps {
  method: ObtainMethod
  index?: number
}

export default function ObtainCard({ method, index }: ObtainCardProps) {
  const isDC = method.priceType === 'dc'
  const isDM = method.priceType === 'dm'

  return (
    <div className="bg-bg-surface border border-border-default rounded-lg p-4">
      {index !== undefined && (
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
          Method {index + 1}
        </p>
      )}

      <div className="space-y-2">
        {/* Location */}
        <div className="flex gap-2">
          <span className="text-text-muted text-xs w-20 flex-shrink-0 pt-0.5">Location</span>
          <span className="text-text-primary text-sm leading-snug">{method.location}</span>
        </div>

        {/* Price */}
        <div className="flex gap-2">
          <span className="text-text-muted text-xs w-20 flex-shrink-0">Price</span>
          <span className={`text-sm ${isDC ? 'text-amber-300' : isDM ? 'text-slate-300' : 'text-text-primary'}`}>
            {method.price}
          </span>
        </div>

        {/* Required Items */}
        {method.requiredItems && (
          <div className="flex gap-2">
            <span className="text-text-muted text-xs w-20 flex-shrink-0 pt-0.5">Requires</span>
            <span className="text-text-primary text-sm leading-snug">{method.requiredItems}</span>
          </div>
        )}

        {/* Sellback */}
        <div className="flex gap-2">
          <span className="text-text-muted text-xs w-20 flex-shrink-0">Sellback</span>
          <span className="text-text-secondary text-sm">{method.sellback}</span>
        </div>
      </div>
    </div>
  )
}
