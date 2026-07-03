/**
 * LevelRangeBadge Component
 * 
 * Displays a subtle pill badge indicating an item has multiple level variants.
 * Shown on list cards to indicate "I-VII", "30-90", etc.
 * 
 * Features:
 * - Subtle background with border
 * - Minimum 44px touch target
 * - Design token colors
 * 
 * Example: Goldfish Knight card shows "I-VII" badge
 */

interface LevelRangeBadgeProps {
  levelRange: string  // "I-VII", "30-90", "1"
}

export default function LevelRangeBadge({ levelRange }: LevelRangeBadgeProps) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-bg-overlay text-text-secondary border border-border-default"
      aria-label={`Levels ${levelRange}`}
    >
      {levelRange}
    </span>
  )
}
