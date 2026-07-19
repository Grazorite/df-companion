import { normalizeDisplayText } from '../../utils/displayText'

interface MetadataChipSectionProps {
  label: string
  value?: string
  className?: string
}

export default function MetadataChipSection({
  label,
  value,
  className = 'mb-5',
}: MetadataChipSectionProps) {
  if (!value || value === 'Unknown') return null

  return (
    <section aria-labelledby={`${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-heading`} className={className}>
      <h2
        id={`${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-heading`}
        className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3"
      >
        {label}
      </h2>
      <div className="flex gap-2">
        <span className="inline-block text-sm px-3 py-1.5 rounded-md bg-bg-overlay text-text-secondary border border-border-default">
          {normalizeDisplayText(value)}
        </span>
      </div>
    </section>
  )
}
