import { useEffect, useRef, useState, type Key, type MouseEvent, type ReactNode } from 'react'
import { getBrowseRestoration, saveBrowseRestoration } from '../../utils/browseRestoration'

const MOBILE_QUERY = '(min-width: 640px)'

interface ProgressiveCardGridProps<T> {
  ariaLabel: string
  className: string
  getKey: (item: T, index: number) => Key
  items: readonly T[]
  renderItem: (item: T, index: number) => ReactNode
  resetKey: string
}

function isDesktopViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches
}

function initialVisibleCount(resetKey: string, batchSize: number): number {
  return Math.max(batchSize, getBrowseRestoration(resetKey)?.renderedCount ?? 0)
}

export default function ProgressiveCardGrid<T>({
  ariaLabel,
  className,
  getKey,
  items,
  renderItem,
  resetKey,
}: ProgressiveCardGridProps<T>) {
  const [desktop, setDesktop] = useState(isDesktopViewport)
  const batchSize = desktop ? 72 : 48
  const [visibleCount, setVisibleCount] = useState(() => initialVisibleCount(resetKey, batchSize))
  const [autoLoadEnabled, setAutoLoadEnabled] = useState(false)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY)
    const updateViewport = () => setDesktop(media.matches)
    media.addEventListener('change', updateViewport)
    return () => media.removeEventListener('change', updateViewport)
  }, [])

  useEffect(() => {
    setVisibleCount(initialVisibleCount(resetKey, batchSize))
    setAutoLoadEnabled(false)
  }, [batchSize, resetKey])

  const renderedCount = Math.min(visibleCount, items.length)
  const hasMore = renderedCount < items.length

  useEffect(() => {
    const target = loadMoreRef.current
    if (!target || !hasMore || !autoLoadEnabled || typeof IntersectionObserver === 'undefined') {
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setVisibleCount((current) => Math.min(items.length, current + batchSize))
      },
      { rootMargin: '320px 0px' }
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [autoLoadEnabled, batchSize, hasMore, items.length])

  function showMore() {
    setAutoLoadEnabled(true)
    setVisibleCount((current) => Math.min(items.length, current + batchSize))
  }

  function captureCardNavigation(event: MouseEvent<HTMLUListElement>) {
    if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return
    }

    const target = event.target
    if (!(target instanceof Element)) return

    const card = target.closest<HTMLAnchorElement>('a.group[href]')
    const cardHref = card?.getAttribute('href')
    if (!cardHref) return

    saveBrowseRestoration(resetKey, {
      cardHref,
      renderedCount,
      scrollY: window.scrollY,
    })
  }

  return (
    <>
      <ul className={className} aria-label={ariaLabel} onClickCapture={captureCardNavigation}>
        {items.slice(0, renderedCount).map((item, index) => (
          <li key={getKey(item, index)}>{renderItem(item, index)}</li>
        ))}
      </ul>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        Showing {renderedCount} of {items.length} results
      </p>

      {hasMore && (
        <div ref={loadMoreRef} className="flex justify-center pt-5">
          <button
            type="button"
            onClick={showMore}
            className="min-h-11 rounded-lg border border-border-default bg-bg-surface px-5 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-border-hover hover:bg-bg-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
          >
            Show more results
          </button>
        </div>
      )}
    </>
  )
}
