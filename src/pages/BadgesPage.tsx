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
  const activeCategory = (searchParams.get('category') as BadgeCategory) ?? undefined
  const activeSubcategory = searchParams.get('sub') ?? undefined

  const categories = useCategories()
  const subcategories = useSubcategories(activeCategory ?? '')

  // Sync to URL
  useEffect(() => {
    const params: Record<string, string> = {}
    if (debouncedQuery) params.q = debouncedQuery
    if (activeCategory) params.category = activeCategory
    if (activeSubcategory) params.sub = activeSubcategory
    setSearchParams(params, { replace: true })
  }, [debouncedQuery, activeCategory, activeSubcategory, setSearchParams])

  const { badges, total } = useBadges({
    query: debouncedQuery,
    category: activeCategory,
    subcategory: activeSubcategory,
  })

  function selectCategory(id: BadgeCategory | undefined) {
    const params: Record<string, string> = {}
    if (debouncedQuery) params.q = debouncedQuery
    if (id) params.category = id
    // Clear subcategory when switching category
    setSearchParams(params, { replace: true })
  }

  function selectSubcategory(sub: string) {
    const params: Record<string, string> = {}
    if (debouncedQuery) params.q = debouncedQuery
    if (activeCategory) params.category = activeCategory
    // Toggle off if already active
    if (sub !== activeSubcategory) params.sub = sub
    setSearchParams(params, { replace: true })
  }

  return (
    <main className="px-4 py-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-amber-400 mb-1">Badges</h1>
        <p className="text-slate-400 text-sm">
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

      {/* Top-level category filters */}
      <div className="flex gap-2 flex-wrap mb-2" role="group" aria-label="Filter by category">
        <button
          onClick={() => selectCategory(undefined)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors min-h-[32px] ${
            !activeCategory
              ? 'bg-amber-500 text-slate-900'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
          aria-pressed={!activeCategory}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => selectCategory(cat.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors min-h-[32px] ${
              activeCategory === cat.id
                ? 'bg-amber-500 text-slate-900'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
            aria-pressed={activeCategory === cat.id}
          >
            {cat.displayName}
          </button>
        ))}
      </div>

      {/* Subcategory filters — only shown when a category is selected */}
      {activeCategory && subcategories.length > 0 && (
        <div
          className="flex gap-1.5 flex-wrap mb-4 pl-1 border-l-2 border-slate-700"
          role="group"
          aria-label="Filter by subcategory"
        >
          {subcategories.map((sub) => (
            <button
              key={sub}
              onClick={() => selectSubcategory(sub)}
              className={`px-2.5 py-1 rounded-full text-xs transition-colors min-h-[28px] ${
                activeSubcategory === sub
                  ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500'
              }`}
              aria-pressed={activeSubcategory === sub}
            >
              {sub}
            </button>
          ))}
        </div>
      )}

      {/* Results count */}
      <p className="text-slate-500 text-xs mb-4" aria-live="polite" aria-atomic="true">
        {total} {total === 1 ? 'badge' : 'badges'} found
        {activeSubcategory ? (
          <span className="text-slate-400"> in {activeSubcategory}</span>
        ) : activeCategory ? (
          <span className="text-slate-400"> in {categories.find(c => c.id === activeCategory)?.displayName ?? activeCategory}</span>
        ) : null}
      </p>

      {/* Badge grid */}
      <BadgeList badges={badges} />
    </main>
  )
}
