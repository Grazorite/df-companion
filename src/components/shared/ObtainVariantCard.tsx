/**
 * ObtainVariantCard Component
 * 
 * Displays a single obtain method with location, price, DA/DC/DM requirements,
 * sellback, and required items (for merge shops).
 * 
 * For guests: Shows location only (badge-style), no price/sellback
 * For pets: Shows full details including price and sellback
 * 
 * Uses the unified obtain card styling:
 * - Gold left border (border-l-4 border-gold)
 * - Heading INSIDE the card
 * - Amber text for DC prices
 * - Silver text for DM prices
 * - DA Required pill if daRequired=true (non-clickable)
 * 
 * Example: Goldfish Knight IV
 * - Free variant: Shows DA Required pill
 * - DC variant: Shows amber "150 Dragon Coins" text, no DA pill
 */

import type { ObtainVariant } from '../../types/item'
import { normalizeDisplayText } from '../../utils/displayText'
import { getCurrencyTextClass, getSeparatedObtainLines } from '../../utils/obtainFormatting'

interface ObtainVariantCardProps {
  variant: ObtainVariant
  label?: string  // "Free Option", "DC Option", "Method 1"
  isGuest?: boolean  // If true, hide price/sellback fields (badge-style)
  locationOnly?: boolean
}

function ObtainTextLines({
  lines,
  markAlternatives = false,
}: {
  lines: string[]
  markAlternatives?: boolean
}) {
  return (
    <div className="space-y-1">
      {lines.map((line, index) => (
        <div key={`${line}-${index}`} className="flex items-start gap-2 leading-snug">
          {markAlternatives && lines.length > 1 && (
            <span className="mt-0.5 min-w-5 text-xs font-semibold text-text-muted tabular-nums">
              {index + 1}.
            </span>
          )}
          <span className="min-w-0 break-words">{line}</span>
        </div>
      ))}
    </div>
  )
}

export default function ObtainVariantCard({
  variant,
  label,
  isGuest = false,
  locationOnly = false,
}: ObtainVariantCardProps) {
  const headingText = label ? `How to Obtain (${label})` : 'How to Obtain'
  
  const showPriceFields = !isGuest && !locationOnly
  const showRequirements = Boolean(variant.requirements && variant.requirements.toLowerCase() !== 'none')
  const showRequiredItems = Boolean(variant.requiredItems)
  
  return (
    <div className="bg-bg-surface border-l-4 border-gold rounded-lg p-5 space-y-3">
      {/* Heading */}
      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
        {headingText}
      </h3>
      
      {/* Location with optional link and DA pill */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          {variant.locationUrl ? (
            <a
              href={variant.locationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-primary hover:text-gold transition-colors underline break-words"
            >
              {normalizeDisplayText(variant.location)}
            </a>
          ) : (
            <p className="text-text-primary break-words">{normalizeDisplayText(variant.location)}</p>
          )}
        </div>
        
        {/* DA Required pill (non-clickable in obtain context) */}
        {variant.daRequired && (
          <span className="inline-flex items-center justify-center whitespace-nowrap min-w-[92px] text-xs font-medium px-3 py-1 rounded-full bg-orange-500/20 text-orange-400">
            DA Required
          </span>
        )}
      </div>
      
      {!locationOnly && (showRequirements || showRequiredItems || showPriceFields) && (
        <>
          <div className="border-t border-border-default" />

          {showRequirements && (
            <div>
              <p className="text-xs text-text-muted mb-1">Requires</p>
              <p className="text-sm text-text-primary break-words">{normalizeDisplayText(variant.requirements)}</p>
            </div>
          )}

          {/* Required Items FIRST (merge shops) */}
          {variant.requiredItems && (
            <div className="grid grid-cols-1 gap-3">
              <div>
                <p className="text-xs text-text-muted mb-1">Required Items</p>
                <div
                  className={`text-sm break-words ${getCurrencyTextClass(
                    variant.requiredItems,
                    variant.dmRequired ? 'dm' : variant.dcRequired ? 'dc' : undefined
                  )}`}
                >
                  <ObtainTextLines
                    lines={getSeparatedObtainLines(variant.requiredItems, { splitOn: 'or' })}
                    markAlternatives
                  />
                </div>
              </div>
            </div>
          )}
          
          {/* Price and Sellback grid */}
          {showPriceFields && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Price */}
              <div>
                <p className="text-xs text-text-muted mb-1">Price</p>
                <div
                  className={`text-sm ${getCurrencyTextClass(
                    variant.price,
                    variant.priceType === 'dc' ? 'dc' : variant.priceType === 'dm' ? 'dm' : undefined
                  )}`}
                >
                  <ObtainTextLines lines={getSeparatedObtainLines(variant.price)} markAlternatives />
                </div>
              </div>

              {/* Sellback */}
              {variant.sellback && (
                <div>
                  <p className="text-xs text-text-muted mb-1">Sellback</p>
                  <div
                    className={`text-sm ${getCurrencyTextClass(
                      variant.sellback,
                      variant.priceType === 'dc' ? 'dc' : variant.priceType === 'dm' ? 'dm' : undefined
                    )}`}
                  >
                    <ObtainTextLines
                      lines={getSeparatedObtainLines(variant.sellback, { rephraseTimedSellback: true })}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
