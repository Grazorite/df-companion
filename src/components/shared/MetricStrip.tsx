interface MetricStripProps {
  metrics: Array<{ label: string; value?: string }>
}

export default function MetricStrip({ metrics }: MetricStripProps) {
  if (metrics.length === 0) return null

  return (
    <div
      className={`grid gap-2 text-center bg-bg-base rounded-lg p-3 ${
        metrics.length > 1 ? 'grid-cols-2' : 'grid-cols-1'
      }`}
    >
      {metrics.map((metric) => (
        <div key={metric.label}>
          <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">
            {metric.label}
          </p>
          <p className="text-xs font-medium text-text-secondary">{metric.value || '—'}</p>
        </div>
      ))}
    </div>
  )
}
