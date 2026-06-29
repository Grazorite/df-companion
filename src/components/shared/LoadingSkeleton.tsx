/** Animated placeholder shown while badge data is loading */
export function BadgeCardSkeleton() {
  return (
    <div className="bg-bg-surface border border-border-default rounded-lg p-4 min-h-[80px] animate-pulse">
      {/* Category chip */}
      <div className="h-4 bg-bg-overlay rounded-full w-20 mb-3" />
      {/* Title */}
      <div className="h-4 bg-bg-overlay rounded w-3/5 mb-2" />
      {/* Description lines */}
      <div className="space-y-1.5">
        <div className="h-3 bg-bg-overlay rounded w-full" />
        <div className="h-3 bg-bg-overlay rounded w-4/5" />
      </div>
    </div>
  )
}

interface BadgeGridSkeletonProps {
  count?: number
}

export function BadgeGridSkeleton({ count = 6 }: BadgeGridSkeletonProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <BadgeCardSkeleton key={i} />
      ))}
    </div>
  )
}
