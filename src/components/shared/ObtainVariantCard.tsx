/**
 * ObtainVariantCard Component
 * 
 * Displays a single obtain method with location, price, DA/DC/DM requirements,
 * sellback, and required items (for merge shops).
 * 
 * For guests: Shows only location + requirements (badge-style), no price/sellback
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

interface ObtainVariantCardProps {
  variant: ObtainVariant
  label?: string  // "Free Option", "DC Option", "Method 1"
  isGuest?: boolean  // If true, hide price/sellback fields (badge-style)
}

export default function ObtainVariantCard({ variant, label, isGuest = false }: ObtainVariantCardProps) {
  const headingText = label ? `How to Obtain (${label})` : 'How to Obtain'
  
  // For guests, only show location + requirements (no price/sellback)
  const showPriceFields = !isGuest
  
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
              {variant.location}
            </a>
          ) : (
            <p className="text-text-primary break-words">{variant.location}</p>
          )}
        </div>
        
        {/* DA Required pill (non-clickable in obtain context) */}
        {variant.daRequired && (
          <span className="inline-flex items-center justify-center whitespace-nowrap min-w-[92px] text-xs font-medium px-3 py-1 rounded-full bg-orange-500/20 text-orange-400">
            DA Required
          </span>
        )}
      </div>
      
      {/* Requirements (if present and not "None") - for guests, this is important info */}
      {variant.requirements && variant.requirements.toLowerCase() !== 'none' && (
        <div>
          <p className="text-xs text-text-muted mb-1">Requires</p>
          <p className="text-sm text-text-secondary">{variant.requirements}</p>
        </div>
      )}
      
      {/* Only show divider and price fields if NOT a guest */}
      {showPriceFields && (
        <>
          {/* Divider */}
          <div className="border-t border-border-default" />
          
          {/* Required Items FIRST (merge shops) */}
          {variant.requiredItems && (
            <div className="grid grid-cols-1 gap-3">
              <div>
                <p className="text-xs text-text-muted mb-1">Requires</p>
                <p
                  className={`text-sm ${
                    variant.dmRequired
                      ? 'text-slate-300'  // Silver for DM items
                      : 'text-text-primary'
                  }`}
                >
                  {variant.requiredItems}
                </p>
              </div>
            </div>
          )}
          
          {/* Price and Sellback grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Price */}
            <div>
              <p className="text-xs text-text-muted mb-1">Price</p>
              <p
                className={`text-sm ${
                  variant.priceType === 'dc'
                    ? 'text-gold'  // Amber for Dragon Coins
                    : variant.priceType === 'dm'
                      ? 'text-slate-300'  // Silver for Defender's Medals
                      : 'text-text-primary'
                }`}
              >
                {variant.price}
              </p>
            </div>
            
            {/* Sellback */}
            {variant.sellback && (
              <div>
                <p className="text-xs text-text-muted mb-1">Sellback</p>
                <p
                  className={`text-sm ${
                    variant.priceType === 'dc'
                      ? 'text-gold'  // Amber for DC sellback
                      : variant.priceType === 'dm'
                        ? 'text-slate-300'  // Silver for DM sellback
                        : 'text-text-primary'
                  }`}
                >
                  {variant.sellback}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
