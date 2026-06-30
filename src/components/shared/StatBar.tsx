interface StatItem {
  label: string
  value: string | number
}

interface StatBarProps {
  stats: StatItem[]
}

export default function StatBar({ stats }: StatBarProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {stats.map(({ label, value }) => (
        <div
          key={label}
          className="bg-bg-elevated border border-border-default rounded-lg px-3 py-2 min-w-[80px]"
        >
          <p className="text-text-muted text-[10px] uppercase tracking-wider font-medium mb-0.5">{label}</p>
          <p className="text-text-primary text-sm font-semibold leading-tight">{value}</p>
        </div>
      ))}
    </div>
  )
}
