import type { ReactNode } from 'react'
import { useDebounce } from '../../hooks/useDebounce'

interface ResultsStatusProps {
  announcement: string
  children?: ReactNode
}

export default function ResultsStatus({ announcement, children }: ResultsStatusProps) {
  const settledAnnouncement = useDebounce(announcement, 400)

  return (
    <>
      <p className="mb-4 text-xs text-text-secondary">{children ?? announcement}</p>
      <p
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
        data-testid="results-announcement"
      >
        {settledAnnouncement}
      </p>
    </>
  )
}
