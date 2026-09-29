import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group'

interface Segment {
  id: string
  label: string
  count?: number
  active: boolean
}

interface SegmentToggleProps {
  segments: Segment[]
  onToggle: (id: string) => void
}

/**
 * Multi-select segment picker built on the Radix ToggleGroup primitive.
 *
 * Radix provides group semantics and roving-tabindex keyboard navigation (arrow
 * keys move between segments; the group is a single tab stop). The external API
 * is unchanged — consumers still pass `segments` with per-segment `active` and
 * an `onToggle(id)` callback — so single-select subtype pages (which enforce one
 * active segment in their own handler) and the multi-select Pets/Guests toggle
 * both keep working. `onValueChange` reports the full active set, so we derive
 * the single toggled id and forward it to `onToggle`.
 */
export default function SegmentToggle({ segments, onToggle }: SegmentToggleProps) {
  const activeIds = segments.filter((seg) => seg.active).map((seg) => seg.id)

  function handleValueChange(nextActiveIds: string[]) {
    const next = new Set(nextActiveIds)
    const prev = new Set(activeIds)
    // A click flips exactly one segment; forward whichever id changed.
    for (const seg of segments) {
      if (next.has(seg.id) !== prev.has(seg.id)) {
        onToggle(seg.id)
      }
    }
  }

  return (
    <ToggleGroup
      type="multiple"
      value={activeIds}
      onValueChange={handleValueChange}
      className="flex flex-wrap gap-2"
      aria-label="Filter by type"
    >
      {segments.map((seg) => (
        <ToggleGroupItem
          key={seg.id}
          value={seg.id}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors duration-150 min-h-11 sm:min-h-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 ${
            seg.active
              ? 'bg-gold-bright text-bg-base font-semibold'
              : 'bg-bg-overlay text-text-secondary hover:bg-border-hover hover:text-text-primary'
          }`}
        >
          {seg.label}
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              seg.active ? 'bg-bg-base/20' : 'bg-bg-surface/60'
            }`}
          >
            {seg.count ?? (
              <span className="inline-block h-2.5 w-4 rounded bg-current/30 animate-pulse" />
            )}
          </span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
