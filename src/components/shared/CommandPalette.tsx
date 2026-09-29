import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGlobalSearch } from '../../hooks/useGlobalSearch'
import { searchHits, type SearchHit, type SearchSection } from '../../utils/searchIndex'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './ui/command'

const SECTION_ORDER: SearchSection[] = [
  'Badges',
  'Pets',
  'Guests',
  'Accessories',
  'Weapons',
  'Housing',
  'Classes & Abilities',
]

const MIN_QUERY_LENGTH = 2

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * The palette UI. Open/close state and the keyboard/event triggers live in the
 * eager `CommandPaletteLoader`, so this component (and its `cmdk` dependency)
 * only loads as a lazy chunk on first open — keeping the main bundle small.
 */
export default function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const { hits, loading, error, retry } = useGlobalSearch(open)

  // Clear the query whenever the palette closes so it reopens fresh.
  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const trimmed = query.trim()
  const results = useMemo(() => searchHits(hits, query, 40), [hits, query])

  const grouped = useMemo(() => {
    const bySection = new Map<SearchSection, SearchHit[]>()
    for (const hit of results) {
      const list = bySection.get(hit.section) ?? []
      list.push(hit)
      bySection.set(hit.section, list)
    }
    return SECTION_ORDER.filter((section) => bySection.has(section)).map(
      (section) => [section, bySection.get(section) ?? []] as const
    )
  }, [results])

  const handleSelect = useCallback(
    (url: string) => {
      onOpenChange(false)
      navigate(url)
    },
    [navigate, onOpenChange]
  )

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} label="Search DragonFable content">
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search badges, pets, weapons, and more…"
      />
      <CommandList>
        {error ? (
          <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
            <p className="text-sm text-text-secondary">Couldn’t load the search index.</p>
            <button
              type="button"
              onClick={retry}
              className="min-h-9 rounded-lg border border-border-default bg-bg-surface px-4 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
            >
              Retry
            </button>
          </div>
        ) : trimmed.length < MIN_QUERY_LENGTH ? (
          <CommandEmpty>Type at least {MIN_QUERY_LENGTH} characters to search.</CommandEmpty>
        ) : loading ? (
          <CommandEmpty>Loading search index…</CommandEmpty>
        ) : results.length === 0 ? (
          <CommandEmpty>No results for “{trimmed}”.</CommandEmpty>
        ) : (
          grouped.map(([section, sectionHits]) => (
            <CommandGroup key={section} heading={section}>
              {sectionHits.map((hit) => (
                <CommandItem key={hit.id} value={hit.id} onSelect={() => handleSelect(hit.url)}>
                  <span className="truncate">{hit.label}</span>
                  {hit.sublabel && (
                    <span className="ml-2 shrink-0 text-[10px] font-medium uppercase tracking-wider text-text-muted">
                      {hit.sublabel}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          ))
        )}
      </CommandList>
    </CommandDialog>
  )
}
