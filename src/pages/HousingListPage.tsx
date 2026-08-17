import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import SearchBar from '../components/shared/SearchBar'
import SegmentToggle from '../components/shared/SegmentToggle'
import TriStateFilterPill from '../components/shared/TriStateFilterPill'
import HousingList from '../components/housing/HousingList'
import { useDebounce } from '../hooks/useDebounce'
import { useHousing, useHousingCategoryAvailability, useHousingCounts } from '../hooks/useHousing'
import { HOUSING_SUBTYPES, type HousingSubtype } from '../types/housing'
import {
  filterAccessOptionsByAvailability,
  filterCategoryOptionsByAvailability,
} from '../utils/filterVisibility'
import { cycleTriState, getTriState, parseFilterParam } from '../utils/triStateFilters'

const ACCESS_OPTIONS = [
  { id: 'multiple', label: 'Multiple Versions' },
  { id: 'dc', label: 'DC' },
] as const

const CATEGORY_OPTIONS = [
  { id: 'effect', label: 'Effect' },
  { id: 'rare', label: 'Rare' },
  { id: 'seasonal', label: 'Seasonal' },
  { id: 'retired', label: 'Retired' },
] as const

export default function HousingListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const typeParam = searchParams.get('type')
  const activeSubtype = HOUSING_SUBTYPES.some((meta) => meta.subtype === typeParam)
    ? (typeParam as HousingSubtype)
    : 'house'
  const subtypeMeta =
    HOUSING_SUBTYPES.find((meta) => meta.subtype === activeSubtype) ?? HOUSING_SUBTYPES[0]
  const [inputValue, setInputValue] = useState(searchParams.get('q') ?? '')
  const debouncedQuery = useDebounce(inputValue, 300)
  const accessParam = searchParams.get('access')
  const excludeAccessParam = searchParams.get('excludeAccess')
  const categoryParam = searchParams.get('category')
  const excludeCategoryParam = searchParams.get('excludeCategory')
  const categoryAvailability = useHousingCategoryAvailability(activeSubtype)
  const visibleAccessOptions = useMemo(
    () => filterAccessOptionsByAvailability(ACCESS_OPTIONS, categoryAvailability),
    [categoryAvailability]
  )
  const visibleAccessIds = useMemo(
    () => new Set(visibleAccessOptions.map((option) => option.id)),
    [visibleAccessOptions]
  )
  const visibleCategoryOptions = useMemo(
    () => filterCategoryOptionsByAvailability(CATEGORY_OPTIONS, categoryAvailability),
    [categoryAvailability]
  )
  const visibleCategoryIds = useMemo(
    () => new Set(visibleCategoryOptions.map((option) => option.id)),
    [visibleCategoryOptions]
  )
  const rawActiveAccess = useMemo(
    () =>
      parseFilterParam(accessParam, (value): value is (typeof ACCESS_OPTIONS)[number]['id'] =>
        ACCESS_OPTIONS.some((option) => option.id === value)
      ),
    [accessParam]
  )
  const rawExcludedAccess = useMemo(
    () =>
      parseFilterParam(
        excludeAccessParam,
        (value): value is (typeof ACCESS_OPTIONS)[number]['id'] =>
          ACCESS_OPTIONS.some((option) => option.id === value)
      ),
    [excludeAccessParam]
  )
  const rawActiveCategories = useMemo(
    () =>
      parseFilterParam(categoryParam, (value): value is (typeof CATEGORY_OPTIONS)[number]['id'] =>
        CATEGORY_OPTIONS.some((option) => option.id === value)
      ),
    [categoryParam]
  )
  const rawExcludedCategories = useMemo(
    () =>
      parseFilterParam(
        excludeCategoryParam,
        (value): value is (typeof CATEGORY_OPTIONS)[number]['id'] =>
          CATEGORY_OPTIONS.some((option) => option.id === value)
      ),
    [excludeCategoryParam]
  )
  const activeAccess = useMemo(
    () => rawActiveAccess.filter((value) => visibleAccessIds.has(value)),
    [rawActiveAccess, visibleAccessIds]
  )
  const excludedAccess = useMemo(
    () => rawExcludedAccess.filter((value) => visibleAccessIds.has(value)),
    [rawExcludedAccess, visibleAccessIds]
  )
  const activeCategories = useMemo(
    () => rawActiveCategories.filter((value) => visibleCategoryIds.has(value)),
    [rawActiveCategories, visibleCategoryIds]
  )
  const excludedCategories = useMemo(
    () => rawExcludedCategories.filter((value) => visibleCategoryIds.has(value)),
    [rawExcludedCategories, visibleCategoryIds]
  )
  const { bySubtype, loading: countsLoading } = useHousingCounts()

  const canonicalQueryString = useMemo(() => {
    const params = new URLSearchParams()
    params.set('type', activeSubtype)
    if (debouncedQuery) params.set('q', debouncedQuery)
    if (rawActiveAccess.length > 0) params.set('access', rawActiveAccess.join(','))
    if (rawExcludedAccess.length > 0) params.set('excludeAccess', rawExcludedAccess.join(','))
    if (rawActiveCategories.length > 0) params.set('category', rawActiveCategories.join(','))
    if (rawExcludedCategories.length > 0) {
      params.set('excludeCategory', rawExcludedCategories.join(','))
    }
    return params.toString()
  }, [
    activeSubtype,
    debouncedQuery,
    rawActiveAccess,
    rawExcludedAccess,
    rawActiveCategories,
    rawExcludedCategories,
  ])

  useEffect(() => {
    if (searchParams.toString() === canonicalQueryString) return
    setSearchParams(canonicalQueryString ? new URLSearchParams(canonicalQueryString) : {}, {
      replace: true,
    })
  }, [canonicalQueryString, searchParams, setSearchParams])

  const filters = useMemo(
    () => ({
      query: debouncedQuery || undefined,
      access: activeAccess.length > 0 ? activeAccess : undefined,
      excludeAccess: excludedAccess.length > 0 ? excludedAccess : undefined,
      categories: activeCategories.length > 0 ? activeCategories : undefined,
      excludeCategories: excludedCategories.length > 0 ? excludedCategories : undefined,
    }),
    [activeAccess, excludedAccess, activeCategories, excludedCategories, debouncedQuery]
  )
  const { housing, total, loading } = useHousing(activeSubtype, filters)

  function baseParams(): Record<string, string> {
    const params: Record<string, string> = { type: activeSubtype }
    if (debouncedQuery) params.q = debouncedQuery
    if (rawActiveAccess.length > 0) params.access = rawActiveAccess.join(',')
    if (rawExcludedAccess.length > 0) params.excludeAccess = rawExcludedAccess.join(',')
    if (rawActiveCategories.length > 0) params.category = rawActiveCategories.join(',')
    if (rawExcludedCategories.length > 0) params.excludeCategory = rawExcludedCategories.join(',')
    return params
  }

  function setParams(params: Record<string, string>) {
    setSearchParams(params, { replace: true })
  }

  function setSubtype(id: string) {
    if (!HOUSING_SUBTYPES.some((meta) => meta.subtype === id)) return
    const params = baseParams()
    params.type = id
    setParams(params)
  }

  function toggleAccess(id: (typeof ACCESS_OPTIONS)[number]['id']) {
    const next = cycleTriState(id, { include: rawActiveAccess, exclude: rawExcludedAccess })
    const params = baseParams()
    delete params.access
    delete params.excludeAccess
    if (next.include.length > 0) params.access = next.include.join(',')
    if (next.exclude.length > 0) params.excludeAccess = next.exclude.join(',')
    setParams(params)
  }

  function toggleCategory(id: (typeof CATEGORY_OPTIONS)[number]['id']) {
    const next = cycleTriState(id, {
      include: rawActiveCategories,
      exclude: rawExcludedCategories,
    })
    const params = baseParams()
    delete params.category
    delete params.excludeCategory
    if (next.include.length > 0) params.category = next.include.join(',')
    if (next.exclude.length > 0) params.excludeCategory = next.exclude.join(',')
    setParams(params)
  }

  const segments = HOUSING_SUBTYPES.map((meta) => ({
    id: meta.subtype,
    label: meta.label,
    count: countsLoading ? undefined : (bySubtype[meta.subtype] ?? 0),
    active: meta.subtype === activeSubtype,
  }))

  return (
    <main className="px-4 sm:px-6 py-6 max-w-5xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gold mb-1">Housing & House Items</h1>
        <p className="text-text-secondary text-sm">{subtypeMeta.shortDescription}</p>
        <p className="mt-2 text-xs text-text-muted">
          All housing entries require a Dragon Amulet.
        </p>
      </div>

      <div className="mb-4">
        <SegmentToggle segments={segments} onToggle={setSubtype} />
      </div>

      <div className="mb-4">
        <SearchBar
          value={inputValue}
          onChange={setInputValue}
          onClear={() => setInputValue('')}
          placeholder={`Search ${subtypeMeta.label.toLowerCase()} by name, source, or notes...`}
        />
      </div>

      <div className="flex gap-2 flex-wrap mb-3" role="group" aria-label="Filter by access">
        {visibleAccessOptions.map((option) => (
          <TriStateFilterPill
            key={option.id}
            label={option.label}
            state={getTriState(option.id, { include: activeAccess, exclude: excludedAccess })}
            onClick={() => toggleAccess(option.id)}
            size="access"
          />
        ))}
        {(activeAccess.length > 0 || excludedAccess.length > 0) && (
          <button
            onClick={() => {
              const params = baseParams()
              delete params.access
              delete params.excludeAccess
              setParams(params)
            }}
            className="text-xs text-text-muted hover:text-text-primary underline underline-offset-2 ml-1"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="mb-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          {visibleCategoryOptions.map((option) => (
            <TriStateFilterPill
              key={option.id}
              label={option.label}
              state={getTriState(option.id, {
                include: activeCategories,
                exclude: excludedCategories,
              })}
              onClick={() => toggleCategory(option.id)}
              size="category"
              activeClassName="bg-orange-500/80 text-white"
            />
          ))}
          {(activeCategories.length > 0 || excludedCategories.length > 0) && (
            <button
              onClick={() => {
                const params = baseParams()
                delete params.category
                delete params.excludeCategory
                setParams(params)
              }}
              className="text-[11px] text-text-muted hover:text-text-primary underline underline-offset-2 ml-1"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      <p className="text-text-muted text-xs mb-4" aria-live="polite" aria-atomic="true">
        {loading ? 'Loading entries...' : `${total} ${total === 1 ? 'entry' : 'entries'} found`}
      </p>

      <HousingList housing={housing} loading={loading} />
    </main>
  )
}
