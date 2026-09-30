import type { ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface DatasetErrorStateProps {
  onRetry: () => void
  title?: string
}

export function DatasetErrorState({
  onRetry,
  title = "We couldn't load this data",
}: DatasetErrorStateProps) {
  return (
    <div
      className="rounded-lg border border-red-900/70 bg-red-950/25 px-5 py-8 text-center"
      role="alert"
    >
      <AlertTriangle className="mx-auto mb-3 h-6 w-6 text-red-300" aria-hidden="true" />
      <p className="mb-1 text-sm font-semibold text-text-primary">{title}</p>
      <p className="mb-4 text-xs text-text-muted">Check your connection, then try again.</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-hover bg-bg-elevated px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:border-gold hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        Try again
      </button>
    </div>
  )
}

interface DatasetStateBoundaryProps {
  children: ReactNode
  empty: boolean
  emptyFallback: ReactNode
  error: Error | null
  loading: boolean
  loadingFallback: ReactNode
  onRetry: () => void
}

export default function DatasetStateBoundary({
  children,
  empty,
  emptyFallback,
  error,
  loading,
  loadingFallback,
  onRetry,
}: DatasetStateBoundaryProps) {
  if (loading) return loadingFallback
  if (error) return <DatasetErrorState onRetry={onRetry} />
  if (empty) return emptyFallback
  return children
}
