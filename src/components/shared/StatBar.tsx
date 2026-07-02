interface StatItem {
  label: string
  value: string | number
}

interface StatBarProps {
  stats: StatItem[]
}

export default function StatBar({ stats }: StatBarProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {stats.map(({ label, value }) => {
        // Long values (multi-line damage formulas, etc.) get full width
        const isLong = String(value).length > 30
        return (
          <div
            key={label}
            className={`bg-bg-elevated border border-border-default rounded-lg px-3 py-2 ${isLong ? 'col-span-2 sm:col-span-3' : ''}`}
          >
            <p className="text-text-muted text-[10px] uppercase tracking-wider font-medium mb-0.5">{label}</p>
            <p className="text-text-primary text-sm font-semibold leading-snug whitespace-pre-wrap break-words">{value}</p>
          </div>
        )
      })}
    </div>
  )
}
