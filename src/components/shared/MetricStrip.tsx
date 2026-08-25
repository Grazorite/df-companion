interface MetricStripProps {
  metrics: Array<{ label: string; value?: string }>
  variant?: 'inline' | 'panel'
  className?: string
}

export default function MetricStrip({
  metrics,
  variant = 'inline',
  className = '',
}: MetricStripProps) {
  if (metrics.length === 0) return null
  const columns =
    metrics.length >= 3 ? 'grid-cols-3' : metrics.length > 1 ? 'grid-cols-2' : 'grid-cols-1'

  if (variant === 'panel') {
    return (
      <div className={`bg-bg-surface border border-border-default rounded-lg p-4 ${className}`}>
        <div className={`grid gap-4 text-center ${columns}`}>
          {metrics.map((metric) => (
            <div key={metric.label}>
              <p className="text-xs text-text-muted uppercase tracking-wider mb-1">
                {metric.label}
              </p>
              <p className="text-sm font-medium text-text-primary">{metric.value || '—'}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`grid gap-2 text-center bg-bg-base rounded-lg p-3 ${
        columns
      } ${className}`}
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
