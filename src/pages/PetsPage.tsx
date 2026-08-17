import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePets, usePetCounts, useElements } from '../hooks/usePets'
import { useDebounce } from '../hooks/useDebounce'
import SearchBar from '../components/shared/SearchBar'
import SegmentToggle from '../components/shared/SegmentToggle'
import ElementLegend from '../components/shared/ElementLegend'
import TriStateFilterPill from '../components/shared/TriStateFilterPill'
import PetList from '../components/pets/PetList'
import type { EntryType } from '../types/pet'
import { cycleTriState, getTriState, parseFilterParam } from '../utils/triStateFilters'

const ACCESS_OPTIONS = [
  { id: 'multi', label: 'Multiple Versions', petsOnly: false },
  { id: 'da', label: 'DA Required', petsOnly: false },
  { id: 'merge', label: 'Merge Required', petsOnly: true },
  { id: 'free', label: 'Free', petsOnly: true },
  { id: 'dc', label: 'DC', petsOnly: true },
  { id: 'dm', label: 'DM', petsOnly: true },
] as const

const CATEGORY_OPTIONS = [
  { id: 'temp', label: 'Temp' },
  { id: 'rare', label: 'Rare' },
  { id: 'seasonal', label: 'Seasonal' },
  { id: 'special-offer', label: 'Special Offer' },
  { id: 'retired', label: 'Retired' },
] as const

type AccessFilterId = (typeof ACCESS_OPTIONS)[number]['id']
type CategoryFilterId = (typeof CATEGORY_OPTIONS)[number]['id']

export default function PetsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [inputValue, setInputValue] = useState(searchParams.get('q') ?? '')
  const debouncedQuery = useDebounce(inputValue, 300)

  // Parse URL params
  const typeParam = searchParams.get('type') // "pets", "guests", or null (both)
  const elementParam = searchParams.get('element') // comma-separated codes
  const excludeElementParam = searchParams.get('excludeElement')
  const accessParam = searchParams.get('access') // comma-separated: "da,free" or null (all)
  const excludeAccessParam = searchParams.get('excludeAccess')
  const categoryParam = searchParams.get('category') // comma-separated: "temp,rare"
  const excludeCategoryParam = searchParams.get('excludeCategory')

  const activeTypes: EntryType[] = typeParam
    ? typeParam.split(',').filter((t): t is EntryType => t === 'pet' || t === 'guest')
    : [] // empty = both

  const activeElements = elementParam ? elementParam.split(',').filter(Boolean) : []
  const excludedElements = excludeElementParam ? excludeElementParam.split(',').filter(Boolean) : []
  const activeAccess = parseFilterParam(accessParam, (value): value is AccessFilterId =>
    ACCESS_OPTIONS.some((option) => option.id === value)
  )
  const excludedAccess = parseFilterParam(excludeAccessParam, (value): value is AccessFilterId =>
    ACCESS_OPTIONS.some((option) => option.id === value)
  )
  const activeCategories = parseFilterParam(
    categoryParam,
    (value): value is CategoryFilterId => CATEGORY_OPTIONS.some((option) => option.id === value)
  )
  const excludedCategories = parseFilterParam(
    excludeCategoryParam,
    (value): value is CategoryFilterId => CATEGORY_OPTIONS.some((option) => option.id === value)
  )

  const { elements, traits } = useElements()
  const filterEntries = [...elements, ...traits]
  const allCodes = filterEntries.map((e) => e.code)
  const activeTypeLabel =
    activeTypes.length === 1
      ? activeTypes[0] === 'pet'
        ? 'Pets'
        : 'Guests'
      : activeTypes.length > 1
        ? 'Pets & Guests'
        : undefined
  const pageDescription =
    activeTypes.length === 1 && activeTypes[0] === 'pet'
      ? 'Companions who may deal additional damage, heal you, buff you, or debuff your foe. May be equipped from your inventory, or invited.'
      : activeTypes.length === 1 && activeTypes[0] === 'guest'
        ? 'Companions who may have a selection of skills to be utilized, and their own set of potions. Cannot equip items from your inventory.'
        : 'The people (or pets) who will help you in your battles...'

  // Sync URL
  useEffect(() => {
    const params: Record<string, string> = {}
    if (debouncedQuery) params.q = debouncedQuery
    if (activeTypes.length > 0) params.type = activeTypes.join(',')
    if (activeElements.length > 0) params.element = activeElements.join(',')
    if (excludedElements.length > 0) params.excludeElement = excludedElements.join(',')
    if (activeAccess.length > 0) params.access = activeAccess.join(',')
    if (excludedAccess.length > 0) params.excludeAccess = excludedAccess.join(',')
    if (activeCategories.length > 0) params.category = activeCategories.join(',')
    if (excludedCategories.length > 0) params.excludeCategory = excludedCategories.join(',')
    setSearchParams(params, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debouncedQuery,
    typeParam,
    elementParam,
    excludeElementParam,
    accessParam,
    excludeAccessParam,
    categoryParam,
    excludeCategoryParam,
    setSearchParams,
  ])

  const filters = {
    query: debouncedQuery,
    type: activeTypes.length > 0 ? activeTypes : undefined,
    elements: activeElements.length > 0 ? activeElements : undefined,
    excludeElements: excludedElements.length > 0 ? excludedElements : undefined,
    access: activeAccess.length > 0 ? activeAccess : undefined,
    excludeAccess: excludedAccess.length > 0 ? excludedAccess : undefined,
    categories: activeCategories.length > 0 ? activeCategories : undefined,
    excludeCategories: excludedCategories.length > 0 ? excludedCategories : undefined,
  }

  const { pets, total } = usePets(filters)
  const counts = usePetCounts({
    query: debouncedQuery,
    elements: filters.elements,
    excludeElements: filters.excludeElements,
    access: filters.access,
    excludeAccess: filters.excludeAccess,
    categories: filters.categories,
    excludeCategories: filters.excludeCategories,
  })

  // Determine if we're showing guests only (for conditional filter display)
  const isGuestsOnly = activeTypes.length === 1 && activeTypes[0] === 'guest'

  function toggleType(id: string) {
    const type = id as EntryType
    let next: EntryType[]
    if (activeTypes.includes(type)) {
      next = activeTypes.filter((t) => t !== type)
    } else {
      next = [...activeTypes, type]
    }
    const params: Record<string, string> = {}
    if (debouncedQuery) params.q = debouncedQuery
    if (next.length > 0) params.type = next.join(',')
    if (activeElements.length > 0) params.element = activeElements.join(',')
    if (excludedElements.length > 0) params.excludeElement = excludedElements.join(',')
    if (activeAccess.length > 0) params.access = activeAccess.join(',')
    if (excludedAccess.length > 0) params.excludeAccess = excludedAccess.join(',')
    if (activeCategories.length > 0) params.category = activeCategories.join(',')
    if (excludedCategories.length > 0) params.excludeCategory = excludedCategories.join(',')
    setSearchParams(params, { replace: true })
  }

  function toggleElement(code: string) {
    const next = cycleTriState(code, { include: activeElements, exclude: excludedElements })
    const params: Record<string, string> = {}
    if (debouncedQuery) params.q = debouncedQuery
    if (activeTypes.length > 0) params.type = activeTypes.join(',')
    if (next.include.length > 0) params.element = next.include.join(',')
    if (next.exclude.length > 0) params.excludeElement = next.exclude.join(',')
    if (activeAccess.length > 0) params.access = activeAccess.join(',')
    if (excludedAccess.length > 0) params.excludeAccess = excludedAccess.join(',')
    if (activeCategories.length > 0) params.category = activeCategories.join(',')
    if (excludedCategories.length > 0) params.excludeCategory = excludedCategories.join(',')
    setSearchParams(params, { replace: true })
  }

  function toggleAccess(id: string) {
    const accessType = id as AccessFilterId
    const next = cycleTriState(accessType, { include: activeAccess, exclude: excludedAccess })
    const params: Record<string, string> = {}
    if (debouncedQuery) params.q = debouncedQuery
    if (activeTypes.length > 0) params.type = activeTypes.join(',')
    if (activeElements.length > 0) params.element = activeElements.join(',')
    if (excludedElements.length > 0) params.excludeElement = excludedElements.join(',')
    if (next.include.length > 0) params.access = next.include.join(',')
    if (next.exclude.length > 0) params.excludeAccess = next.exclude.join(',')
    if (activeCategories.length > 0) params.category = activeCategories.join(',')
    if (excludedCategories.length > 0) params.excludeCategory = excludedCategories.join(',')
    setSearchParams(params, { replace: true })
  }

  function toggleCategory(id: string) {
    const cat = id as CategoryFilterId
    const next = cycleTriState(cat, { include: activeCategories, exclude: excludedCategories })
    const params: Record<string, string> = {}
    if (debouncedQuery) params.q = debouncedQuery
    if (activeTypes.length > 0) params.type = activeTypes.join(',')
    if (activeElements.length > 0) params.element = activeElements.join(',')
    if (excludedElements.length > 0) params.excludeElement = excludedElements.join(',')
    if (activeAccess.length > 0) params.access = activeAccess.join(',')
    if (excludedAccess.length > 0) params.excludeAccess = excludedAccess.join(',')
    if (next.include.length > 0) params.category = next.include.join(',')
    if (next.exclude.length > 0) params.excludeCategory = next.exclude.join(',')
    setSearchParams(params, { replace: true })
  }

  const segments = [
    {
      id: 'pet',
      label: 'Pets',
      count: counts.pet,
      active: activeTypes.length === 0 || activeTypes.includes('pet'),
    },
    {
      id: 'guest',
      label: 'Guests',
      count: counts.guest,
      active: activeTypes.length === 0 || activeTypes.includes('guest'),
    },
  ]

  return (
    <main className="px-4 sm:px-6 py-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gold mb-1">Pets & Guests</h1>
        <p className="text-text-secondary text-sm">{pageDescription}</p>
      </div>

      {/* Segment toggle */}
      <div className="mb-4">
        <SegmentToggle segments={segments} onToggle={toggleType} />
      </div>

      {/* Search */}
      <div className="mb-4">
        <SearchBar
          value={inputValue}
          onChange={setInputValue}
          onClear={() => setInputValue('')}
          placeholder="Search by name, element, or description..."
        />
      </div>

      {/* Level 1: Access filter */}
      <div className="flex gap-2 flex-wrap mb-3" role="group" aria-label="Filter by access">
        {ACCESS_OPTIONS.map((opt) => {
          // Hide pet-only filters when showing guests only
          if (opt.petsOnly && isGuestsOnly) return null

          const state = getTriState(opt.id, { include: activeAccess, exclude: excludedAccess })
          const isDisabled = opt.petsOnly && isGuestsOnly

          return (
            <TriStateFilterPill
              key={opt.id}
              label={opt.label}
              state={state}
              onClick={() => toggleAccess(opt.id)}
              disabled={isDisabled}
              size="access"
            />
          )
        })}
        {(activeAccess.length > 0 || excludedAccess.length > 0) && (
          <button
            onClick={() => {
              const params: Record<string, string> = {}
              if (debouncedQuery) params.q = debouncedQuery
              if (activeTypes.length > 0) params.type = activeTypes.join(',')
              if (activeElements.length > 0) params.element = activeElements.join(',')
              if (excludedElements.length > 0) params.excludeElement = excludedElements.join(',')
              if (activeCategories.length > 0) params.category = activeCategories.join(',')
              if (excludedCategories.length > 0) {
                params.excludeCategory = excludedCategories.join(',')
              }
              setSearchParams(params, { replace: true })
            }}
            className="text-xs text-text-muted hover:text-text-primary underline underline-offset-2 ml-1"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Level 2: Category filter (multi-select) */}
      <div className="mb-3">
        <div className="flex flex-wrap gap-2">
          {CATEGORY_OPTIONS.map((opt) => {
            if (isGuestsOnly && opt.id === 'special-offer') return null

            return (
              <TriStateFilterPill
                key={opt.id}
                label={opt.label}
                state={getTriState(opt.id, {
                  include: activeCategories,
                  exclude: excludedCategories,
                })}
                onClick={() => toggleCategory(opt.id)}
                size="category"
                activeClassName="bg-orange-500/80 text-white"
              />
            )
          })}
          {(activeCategories.length > 0 || excludedCategories.length > 0) && (
            <button
              onClick={() => {
                const params: Record<string, string> = {}
                if (debouncedQuery) params.q = debouncedQuery
                if (activeTypes.length > 0) params.type = activeTypes.join(',')
                if (activeElements.length > 0) params.element = activeElements.join(',')
                if (excludedElements.length > 0) params.excludeElement = excludedElements.join(',')
                if (activeAccess.length > 0) params.access = activeAccess.join(',')
                if (excludedAccess.length > 0) params.excludeAccess = excludedAccess.join(',')
                setSearchParams(params, { replace: true })
              }}
              className="text-[11px] text-text-muted hover:text-text-primary underline underline-offset-2 ml-1"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Level 3: Element/Trait filter — select/deselect element pills */}
      <div className="mb-2">
        <div className="flex flex-wrap gap-1.5">
          {allCodes.map((code) => {
            const state = getTriState(code, {
              include: activeElements,
              exclude: excludedElements,
            })
            const colour =
              filterEntries.find((e) => e.code === code)?.colour ?? 'bg-bg-overlay text-text-muted'
            return (
              <TriStateFilterPill
                key={code}
                label={code}
                state={state}
                onClick={() => toggleElement(code)}
                size="element"
                activeClassName={`${colour} ring-2 ring-gold`}
                inactiveClassName={`${colour} opacity-60 hover:opacity-100`}
              />
            )
          })}
          {(activeElements.length > 0 || excludedElements.length > 0) && (
            <button
              onClick={() => {
                const params: Record<string, string> = {}
                if (debouncedQuery) params.q = debouncedQuery
                if (activeTypes.length > 0) params.type = activeTypes.join(',')
                if (activeAccess.length > 0) params.access = activeAccess.join(',')
                if (excludedAccess.length > 0) params.excludeAccess = excludedAccess.join(',')
                if (activeCategories.length > 0) params.category = activeCategories.join(',')
                if (excludedCategories.length > 0) {
                  params.excludeCategory = excludedCategories.join(',')
                }
                setSearchParams(params, { replace: true })
              }}
              className="text-[10px] text-text-muted hover:text-text-primary underline underline-offset-2 ml-1"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Legend */}
      <ElementLegend />

      {/* Results count */}
      <p className="text-text-muted text-xs mb-4" aria-live="polite" aria-atomic="true">
        {total} {total === 1 ? 'entry' : 'entries'} found
        {activeTypeLabel && <span className="text-text-secondary"> in {activeTypeLabel}</span>}
        {activeElements.length > 0 && (
          <span className="text-gold"> · {activeElements.join(', ')}</span>
        )}
        {excludedElements.length > 0 && (
          <span className="text-red-300"> · excluding {excludedElements.join(', ')}</span>
        )}
        {activeAccess.length > 0 && (
          <span className="text-orange-400">
            {' '}
            ·{' '}
            {activeAccess
              .map((a) => ACCESS_OPTIONS.find((opt) => opt.id === a)?.label ?? a)
              .join(', ')}
          </span>
        )}
        {excludedAccess.length > 0 && (
          <span className="text-red-300">
            {' '}
            · excluding{' '}
            {excludedAccess
              .map((a) => ACCESS_OPTIONS.find((opt) => opt.id === a)?.label ?? a)
              .join(', ')}
          </span>
        )}
        {activeCategories.length > 0 && (
          <span className="text-orange-400">
            {' '}
            ·{' '}
            {activeCategories
              .map((c) => CATEGORY_OPTIONS.find((opt) => opt.id === c)?.label ?? c)
              .join(', ')}
          </span>
        )}
        {excludedCategories.length > 0 && (
          <span className="text-red-300">
            {' '}
            · excluding{' '}
            {excludedCategories
              .map((c) => CATEGORY_OPTIONS.find((opt) => opt.id === c)?.label ?? c)
              .join(', ')}
          </span>
        )}
      </p>

      {/* List */}
      <PetList pets={pets} />
    </main>
  )
}
