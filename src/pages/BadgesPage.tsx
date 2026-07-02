import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useBadges, useCategories, useSubcategories } from '../hooks/useBadges'
import { useDebounce } from '../hooks/useDebounce'
import SearchBar from '../components/shared/SearchBar'
import BadgeList from '../components/badges/BadgeList'
import type { BadgeCategory } from '../types/badge'

export default function BadgesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [inputValue, setInputValue] = useState(searchParams.get('q') ?? '')
  const debouncedQuery = useDebounce(inputValue, 300)
  
  // Level 1: Access filter (all, da)
  const accessParam = searchParams.get('access') ?? 'all'
  
  // Level 2: Category filter (includes "retired" as mutually exclusive option)
  const activeCategory = (searchParams.get('category') as BadgeCategory | 'retired') ?? undefined
  
  // Level 3: Subcategory filter
  const activeSubcategory = searchParams.get('sub') ?? undefined

  const categories = useCategories()
  const subcategories = useSubcategories(
    activeCategory && activeCategory !== 'retired' ? activeCategory : ''
  )

  useEffect(() => {
    const params: Record<string, string> = {}
    if (debouncedQuery) params.q = debouncedQuery
    if (accessParam !== 'all') params.access = accessParam
    if (activeCategory) params.category = activeCategory
    if (activeSubcategory) params.sub = activeSubcategory
    setSearchParams(params, { replace: true })
  }, [debouncedQuery, accessParam, activeCategory, activeSubcategory, setSearchParams])

  const { badges, total } = useBadges({
    query: debouncedQuery,
    category: activeCategory !== 'retired' ? activeCategory : undefined,
    subcategory: activeSubcategory,
    daRequired: accessParam === 'da' ? true : undefined,
    retired: activeCategory === 'retired' ? true : undefined,
  })

  function setAccess(id: string) {
    const params: Record<string, string> = {}
    if (debouncedQuery) params.q = debouncedQuery
    if (id !== 'all') params.access = id
    if (activeCategory) params.category = activeCategory
    if (activeSubcategory) params.sub = activeSubcategory
    setSearchParams(params, { replace: true })
  }

  function selectCategory(id: BadgeCategory | 'retired' | undefined) {
    const params: Record<string, string> = {}
    if (debouncedQuery) params.q = debouncedQuery
    if (accessParam !== 'all') params.access = accessParam
    if (id) params.category = id
    setSearchParams(params, { replace: true })
  }

  function selectSubcategory(sub: string) {
    const params: Record<string, string> = {}
    if (debouncedQuery) params.q = debouncedQuery
    if (accessParam !== 'all') params.access = accessParam
    if (activeCategory) params.category = activeCategory
    if (sub !== activeSubcategory) params.sub = sub
    setSearchParams(params, { replace: true })
  }

  return (
    <main className="px-4 sm:px-6 py-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gold mb-1">Badges</h1>
        <p className="text-text-secondary text-sm">
          Hidden achievements earned through quests, exploration, and more.
        </p>
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
            accessParam === 'all'
              ? 'bg-gold-bright text-bg-base font-semibold'
              : 'bg-bg-overlay text-text-secondary hover:bg-border-hover hover:text-text-primary'
          }`}
          aria-pressed={accessParam === 'all'}
        >
          All
        </button>
        <button
          onClick={() => setAccess('da')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors duration-150 min-h-[36px] ${
            accessParam === 'da'
              ? 'bg-gold-bright text-bg-base font-semibold'
              : 'bg-bg-overlay text-text-secondary hover:bg-border-hover hover:text-text-primary'
          }`}
          aria-pressed={accessParam === 'da'}
        >
          DA Required
        </button>
      </div>

      {/* Level 2: Category filters */}
      <div className="flex gap-2 flex-wrap mb-2" role="group" aria-label="Filter by category">
        <button
          onClick={() => selectCategory(undefined)}
          className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors duration-150 ${
            !activeCategory
              ? 'bg-orange-500/80 text-white font-semibold'
              : 'bg-bg-overlay text-text-secondary hover:bg-border-hover hover:text-text-primary'
          }`}
          aria-pressed={!activeCategory}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => selectCategory(cat.id)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors duration-150 ${
              activeCategory === cat.id
                ? 'bg-orange-500/80 text-white font-semibold'
                : 'bg-bg-overlay text-text-secondary hover:bg-border-hover hover:text-text-primary'
            }`}
            aria-pressed={activeCategory === cat.id}
          >
            {cat.displayName}
          </button>
        ))}
        <button
          onClick={() => selectCategory('retired')}
          className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors duration-150 ${
            activeCategory === 'retired'
              ? 'bg-orange-500/80 text-white font-semibold'
              : 'bg-bg-overlay text-text-secondary hover:bg-border-hover hover:text-text-primary'
          }`}
          aria-pressed={activeCategory === 'retired'}
        >
          Retired
        </button>
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
              onClick={() => selectSubcategory(sub)}
              className={`px-2 py-0.5 rounded-full text-[10px] transition-all duration-150 border ${
                activeSubcategory === sub
                  ? 'bg-gold/20 text-gold border-gold/50'
                  : 'bg-bg-surface text-text-muted border-border-default hover:text-text-primary hover:border-border-hover'
              }`}
              aria-pressed={activeSubcategory === sub}
            >
              {sub}
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
      </p>

      {/* Badge grid */}
      <BadgeList badges={badges} />
    </main>
  )
}
