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

export default function SegmentToggle({ segments, onToggle }: SegmentToggleProps) {
  return (
    <div className="flex gap-2" role="group" aria-label="Filter by type">
      {segments.map((seg) => (
        <button
          key={seg.id}
          onClick={() => onToggle(seg.id)}
          aria-pressed={seg.active}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors duration-150 min-h-[36px] ${
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
        </button>
      ))}
    </div>
  )
}
