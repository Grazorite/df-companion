import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useBadges, useCategories, useSubcategories } from '../hooks/useBadges'
import { useDebounce } from '../hooks/useDebounce'
import SearchBar from '../components/shared/SearchBar'
import TriStateFilterPill from '../components/shared/TriStateFilterPill'
import BadgeList from '../components/badges/BadgeList'
import type { BadgeCategory } from '../types/badge'
import {
  cycleSingleTriState,
  getTriState,
  type TriStateFilterSet,
} from '../utils/triStateFilters'

export default function BadgesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [inputValue, setInputValue] = useState(searchParams.get('q') ?? '')
  const debouncedQuery = useDebounce(inputValue, 300)
  
  // Level 1: Access filter (all, da)
  const accessParam = searchParams.get('access') ?? 'all'
  const excludeAccessParam = searchParams.get('excludeAccess')
  
  // Level 2: Category filter (includes "retired" as mutually exclusive option)
  const activeCategory = (searchParams.get('category') as BadgeCategory | 'retired') ?? undefined
  const excludedCategory =
    (searchParams.get('excludeCategory') as BadgeCategory | 'retired') ?? undefined
  
  // Level 3: Subcategory filter
  const activeSubcategory = searchParams.get('sub') ?? undefined
  const excludedSubcategory = searchParams.get('excludeSub') ?? undefined

  const categories = useCategories()
  const subcategories = useSubcategories(
    activeCategory && activeCategory !== 'retired' ? activeCategory : ''
  )

  useEffect(() => {
    const params: Record<string, string> = {}
    if (debouncedQuery) params.q = debouncedQuery
    if (accessParam !== 'all') params.access = accessParam
    if (excludeAccessParam === 'da') params.excludeAccess = excludeAccessParam
    if (activeCategory) params.category = activeCategory
    if (excludedCategory) params.excludeCategory = excludedCategory
    if (activeSubcategory) params.sub = activeSubcategory
    if (excludedSubcategory) params.excludeSub = excludedSubcategory
    setSearchParams(params, { replace: true })
  }, [
    debouncedQuery,
    accessParam,
    excludeAccessParam,
    activeCategory,
    excludedCategory,
    activeSubcategory,
    excludedSubcategory,
    setSearchParams,
  ])

  const { badges, total } = useBadges({
    query: debouncedQuery,
    category: activeCategory !== 'retired' ? activeCategory : undefined,
    excludeCategory: excludedCategory,
    subcategory: activeSubcategory,
    excludeSubcategory: excludedSubcategory,
    daRequired: accessParam === 'da' ? true : undefined,
    daRequiredExcluded: excludeAccessParam === 'da' ? true : undefined,
    retired: activeCategory === 'retired' ? true : undefined,
  })

  function baseParams(): Record<string, string> {
    const params: Record<string, string> = {}
    if (debouncedQuery) params.q = debouncedQuery
    if (accessParam !== 'all') params.access = accessParam
    if (excludeAccessParam === 'da') params.excludeAccess = excludeAccessParam
    if (activeCategory) params.category = activeCategory
    if (excludedCategory) params.excludeCategory = excludedCategory
    if (activeSubcategory) params.sub = activeSubcategory
    if (excludedSubcategory) params.excludeSub = excludedSubcategory
    return params
  }

  function setAccess(id: 'all' | 'da') {
    const params = baseParams()
    delete params.access
    delete params.excludeAccess
    if (id === 'da') params.access = id
    setSearchParams(params, { replace: true })
  }

  function cycleAccess(id: 'da') {
    const next = cycleSingleTriState(id, {
      include: accessParam === 'da' ? ['da'] : [],
      exclude: excludeAccessParam === 'da' ? ['da'] : [],
    })
    const params = baseParams()
    delete params.access
    delete params.excludeAccess
    if (next.include[0]) params.access = next.include[0]
    if (next.exclude[0]) params.excludeAccess = next.exclude[0]
    setSearchParams(params, { replace: true })
  }

  function selectCategory(id: BadgeCategory | 'retired' | undefined) {
    const params = baseParams()
    delete params.category
    delete params.excludeCategory
    delete params.sub
    delete params.excludeSub
    if (id) params.category = id
    setSearchParams(params, { replace: true })
  }

  function cycleCategory(id: BadgeCategory | 'retired') {
    const next = cycleSingleTriState(id, {
      include: activeCategory ? [activeCategory] : [],
      exclude: excludedCategory ? [excludedCategory] : [],
    })
    const params = baseParams()
    delete params.category
    delete params.excludeCategory
    delete params.sub
    delete params.excludeSub
    if (next.include[0]) params.category = next.include[0]
    if (next.exclude[0]) params.excludeCategory = next.exclude[0]
    setSearchParams(params, { replace: true })
  }

  function cycleSubcategory(sub: string) {
    const next = cycleSingleTriState(sub, {
      include: activeSubcategory ? [activeSubcategory] : [],
      exclude: excludedSubcategory ? [excludedSubcategory] : [],
    })
    const params = baseParams()
    delete params.sub
    delete params.excludeSub
    if (next.include[0]) params.sub = next.include[0]
    if (next.exclude[0]) params.excludeSub = next.exclude[0]
    setSearchParams(params, { replace: true })
  }

  const accessFilterSet: TriStateFilterSet<'da'> = {
    include: accessParam === 'da' ? ['da'] : [],
    exclude: excludeAccessParam === 'da' ? ['da'] : [],
  }
  const categoryFilterSet: TriStateFilterSet<BadgeCategory | 'retired'> = {
    include: activeCategory ? [activeCategory] : [],
    exclude: excludedCategory ? [excludedCategory] : [],
  }

  return (
    <main className="px-4 sm:px-6 py-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gold mb-1">Badges</h1>
        <p className="text-text-secondary text-sm">The where, what and how of Badges.</p>
      </div>

      {/* Search */}
      <div className="mb-4">
        <SearchBar
          value={inputValue}
          onChange={setInputValue}
          onClear={() => setInputValue('')}
          placeholder="Search badges by name, description, or tags..."
        />
      </div>

      {/* Level 1: Access filters (highest level) */}
      <div className="flex gap-2 flex-wrap mb-3" role="group" aria-label="Filter by access">
        <button
          onClick={() => setAccess('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors duration-150 min-h-[36px] ${
            accessParam === 'all' && excludeAccessParam !== 'da'
              ? 'bg-gold-bright text-bg-base font-semibold'
              : 'bg-bg-overlay text-text-secondary hover:bg-border-hover hover:text-text-primary'
          }`}
          aria-pressed={accessParam === 'all' && excludeAccessParam !== 'da'}
        >
          All
        </button>
        <TriStateFilterPill
          label="DA Required"
          state={getTriState('da', accessFilterSet)}
          onClick={() => cycleAccess('da')}
          size="access"
        />
      </div>

      {/* Level 2: Category filters */}
      <div className="flex gap-2 flex-wrap mb-2" role="group" aria-label="Filter by category">
        <button
          onClick={() => selectCategory(undefined)}
          className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors duration-150 ${
            !activeCategory && !excludedCategory
              ? 'bg-orange-500/80 text-white font-semibold'
              : 'bg-bg-overlay text-text-secondary hover:bg-border-hover hover:text-text-primary'
          }`}
          aria-pressed={!activeCategory && !excludedCategory}
        >
          All
        </button>
        {categories.map((cat) => (
          <TriStateFilterPill
            key={cat.id}
            label={cat.displayName}
            state={getTriState(cat.id, categoryFilterSet)}
            onClick={() => cycleCategory(cat.id)}
            size="category"
            activeClassName="bg-orange-500/80 text-white"
          />
        ))}
        <TriStateFilterPill
          label="Retired"
          state={getTriState('retired', categoryFilterSet)}
          onClick={() => cycleCategory('retired')}
          size="category"
          activeClassName="bg-orange-500/80 text-white"
        />
      </div>

      {/* Level 3: Subcategory filters */}
      {activeCategory && activeCategory !== 'retired' && subcategories.length > 0 && (
        <div
          className="flex gap-1.5 flex-wrap mb-4 ml-1 pl-3 border-l-2 border-border-default"
          role="group"
          aria-label="Filter by subcategory"
        >
          {subcategories.map((sub) => (
            <button
              key={sub}
              onClick={() => cycleSubcategory(sub)}
              className={`px-2 py-0.5 rounded-full text-[10px] transition-all duration-150 border ${
                activeSubcategory === sub
                  ? 'bg-gold/20 text-gold border-gold/50'
                  : excludedSubcategory === sub
                    ? 'bg-red-950/70 text-red-200 border-red-700/70'
                  : 'bg-bg-surface text-text-muted border-border-default hover:text-text-primary hover:border-border-hover'
              }`}
              aria-pressed={activeSubcategory === sub || excludedSubcategory === sub}
            >
              {excludedSubcategory === sub ? `− ${sub}` : sub}
            </button>
          ))}
        </div>
      )}

      {/* Results count */}
      <p className="text-text-muted text-xs mb-4" aria-live="polite" aria-atomic="true">
        {total} {total === 1 ? 'badge' : 'badges'} found
        {activeSubcategory ? (
          <span className="text-text-secondary"> in {activeSubcategory}</span>
        ) : activeCategory === 'retired' ? (
          <span className="text-text-secondary"> in Retired</span>
        ) : activeCategory ? (
          <span className="text-text-secondary"> in {categories.find(c => c.id === activeCategory)?.displayName ?? activeCategory}</span>
        ) : null}
        {accessParam === 'da' && <span className="text-orange-400"> · DA Required</span>}
        {excludeAccessParam === 'da' && <span className="text-red-300"> · excluding DA Required</span>}
        {excludedCategory && (
          <span className="text-red-300">
            {' '}
            · excluding{' '}
            {excludedCategory === 'retired'
              ? 'Retired'
              : (categories.find((c) => c.id === excludedCategory)?.displayName ??
                excludedCategory)}
          </span>
        )}
        {excludedSubcategory && (
          <span className="text-red-300"> · excluding {excludedSubcategory}</span>
        )}
      </p>

      {/* Badge grid */}
      <BadgeList badges={badges} />
    </main>
  )
}
