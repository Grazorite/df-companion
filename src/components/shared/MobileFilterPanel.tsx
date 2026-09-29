import { SlidersHorizontal, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog'

const SECONDARY_FILTER_PARAMS = [
  'access',
  'category',
  'element',
  'excludeAccess',
  'excludeCategory',
  'excludeElement',
  'excludeKind',
  'excludeMisc',
  'excludeSub',
  'excludeSubcategory',
  'kind',
  'misc',
  'sub',
  'subcategory',
] as const

interface MobileFilterPanelProps {
  children: ReactNode
}

function activeFilterCount(searchParams: URLSearchParams): number {
  return SECONDARY_FILTER_PARAMS.reduce((total, key) => {
    const value = searchParams.get(key)
    return total + (value ? value.split(',').filter(Boolean).length : 0)
  }, 0)
}

export default function MobileFilterPanel({ children }: MobileFilterPanelProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeCount = activeFilterCount(searchParams)

  function clearAll() {
    const next = new URLSearchParams(searchParams)
    SECONDARY_FILTER_PARAMS.forEach((key) => next.delete(key))
    setSearchParams(next, { replace: true })
  }

  const triggerLabel = `Filters, ${activeCount} active`

  return (
    <>
      <div className="sticky top-2 z-30 mb-4 flex items-center gap-2 rounded-xl border border-border-default bg-bg-base/95 p-2 shadow-medium backdrop-blur sm:hidden">
        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              aria-label={triggerLabel}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-bg-elevated px-4 text-sm font-semibold text-text-primary transition-colors hover:bg-bg-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
            >
              <SlidersHorizontal className="h-4 w-4 text-gold" aria-hidden="true" />
              Filters
              {activeCount > 0 && (
                <span className="rounded-full bg-gold px-2 py-0.5 text-xs tabular-nums text-bg-base">
                  {activeCount}
                </span>
              )}
            </button>
          </DialogTrigger>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="min-h-11 rounded-lg px-3 text-xs font-medium text-text-secondary underline underline-offset-2 transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
            >
              Clear all
            </button>
          )}
          <DialogContent
            className="inset-x-2 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px)+0.5rem)] flex max-h-[76dvh] flex-col overflow-hidden rounded-xl"
            aria-describedby="mobile-filter-description"
          >
            <div className="flex items-center gap-3 border-b border-border-default px-4 py-3">
              <DialogTitle className="flex-1 text-base font-semibold text-text-primary">
                Filters
              </DialogTitle>
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="min-h-11 rounded-lg px-3 text-xs font-medium text-text-secondary underline underline-offset-2 transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
                >
                  Clear all
                </button>
              )}
              <DialogClose
                aria-label="Close filters"
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-overlay hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </DialogClose>
            </div>
            <DialogDescription id="mobile-filter-description" className="sr-only">
              Refine the current result list. Changes are reflected in the page URL.
            </DialogDescription>
            <div className="overflow-y-auto overscroll-contain p-4 pb-6">{children}</div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="hidden sm:block">{children}</div>
    </>
  )
}
