/** Animated placeholder shown while badge data is loading */
export function BadgeCardSkeleton() {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 min-h-[80px] animate-pulse">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="h-4 bg-slate-700 rounded w-2/3" />
        <div className="h-4 bg-slate-700 rounded-full w-16 flex-shrink-0" />
      </div>
      <div className="space-y-1.5">
        <div className="h-3 bg-slate-700 rounded w-full" />
        <div className="h-3 bg-slate-700 rounded w-4/5" />
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
