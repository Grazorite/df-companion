import type { ObtainMethod } from '../../types/pet'
import { normalizeDisplayText } from '../../utils/displayText'

interface ObtainCardProps {
  method: ObtainMethod
  index?: number
}

export default function ObtainCard({ method, index }: ObtainCardProps) {
  const isDC = method.priceType === 'dc'
  const isDM = method.priceType === 'dm'
  const getCurrencyTextClass = (text?: string, fallback?: 'dc' | 'dm') => {
    const normalized = text?.toLowerCase() ?? ''
    if (fallback === 'dc' || normalized.includes('dragon coin') || /\bdc\b/.test(normalized)) {
      return 'text-amber-300'
    }
    if (
      fallback === 'dm' ||
      normalized.includes("defender's medal") ||
      normalized.includes('defender medal') ||
      /\bdm\b/.test(normalized)
    ) {
      return 'text-slate-300'
    }
    return 'text-text-primary'
  }

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
          <span className="text-text-primary text-sm leading-snug">{normalizeDisplayText(method.location)}</span>
        </div>

        {/* Price */}
        <div className="flex gap-2">
          <span className="text-text-muted text-xs w-20 flex-shrink-0">Price</span>
          <span className={`text-sm ${getCurrencyTextClass(method.price, isDC ? 'dc' : isDM ? 'dm' : undefined)}`}>
            {normalizeDisplayText(method.price)}
          </span>
        </div>

        {/* Required Items */}
        {method.requiredItems && (
          <div className="flex gap-2">
            <span className="text-text-muted text-xs w-20 flex-shrink-0 pt-0.5">Requires</span>
            <span className={`text-sm leading-snug ${getCurrencyTextClass(method.requiredItems, isDM ? 'dm' : isDC ? 'dc' : undefined)}`}>
              {normalizeDisplayText(method.requiredItems)}
            </span>
          </div>
        )}

        {/* Sellback */}
        <div className="flex gap-2">
          <span className="text-text-muted text-xs w-20 flex-shrink-0">Sellback</span>
          <span className={`text-sm ${getCurrencyTextClass(method.sellback, isDC ? 'dc' : isDM ? 'dm' : undefined)}`}>
            {normalizeDisplayText(method.sellback)}
          </span>
        </div>
      </div>
    </div>
  )
}
