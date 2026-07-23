interface CardSkeletonProps {
  minHeightClass?: string
}

export function CardSkeleton({ minHeightClass = 'min-h-[80px]' }: CardSkeletonProps) {
  return (
    <div
      className={`bg-bg-surface border border-border-default rounded-lg p-4 ${minHeightClass} animate-pulse`}
    >
      <div className="h-4 bg-bg-overlay rounded-full w-20 mb-3" />
      <div className="h-4 bg-bg-overlay rounded w-3/5 mb-2" />
      <div className="space-y-1.5">
        <div className="h-3 bg-bg-overlay rounded w-full" />
        <div className="h-3 bg-bg-overlay rounded w-4/5" />
      </div>
    </div>
  )
}

export function BadgeCardSkeleton() {
  return <CardSkeleton />
}

interface GridSkeletonProps {
  count?: number
  cardHeightClass?: string
  className?: string
}

export function CardGridSkeleton({
  count = 6,
  cardHeightClass = 'min-h-[80px]',
  className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3',
}: GridSkeletonProps) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} minHeightClass={cardHeightClass} />
      ))}
    </div>
  )
}

export function BadgeGridSkeleton({ count = 6 }: GridSkeletonProps) {
  return <CardGridSkeleton count={count} />
}

export function DetailPageSkeleton() {
  return (
    <main className="px-4 sm:px-6 py-8 max-w-3xl mx-auto">
      <div className="animate-pulse">
        <div className="flex gap-2 mb-4">
          <div className="h-6 bg-bg-overlay rounded-full w-16" />
          <div className="h-6 bg-bg-overlay rounded-full w-24" />
          <div className="h-6 bg-bg-overlay rounded-full w-20" />
        </div>
        <div className="h-8 bg-bg-surface rounded w-3/5 mb-3" />
        <div className="space-y-2 mb-8">
          <div className="h-4 bg-bg-surface rounded w-full" />
          <div className="h-4 bg-bg-surface rounded w-4/5" />
        </div>
        <div className="bg-bg-surface border border-border-default rounded-lg p-5 mb-6">
          <div className="h-4 bg-bg-overlay rounded w-28 mb-4" />
          <div className="space-y-3">
            <div className="h-4 bg-bg-overlay rounded w-full" />
            <div className="h-4 bg-bg-overlay rounded w-11/12" />
            <div className="h-4 bg-bg-overlay rounded w-3/4" />
          </div>
        </div>
        <div className="bg-bg-surface border border-border-default rounded-lg p-5">
          <div className="h-4 bg-bg-overlay rounded w-32 mb-4" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-10 bg-bg-overlay rounded" />
            <div className="h-10 bg-bg-overlay rounded" />
          </div>
        </div>
      </div>
    </main>
  )
}
