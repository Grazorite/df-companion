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
    setSearchParams(params, { replace: true })
  }

  function selectSubcategory(sub: string) {
    const params: Record<string, string> = {}
    if (debouncedQuery) params.q = debouncedQuery
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

      {/* Top-level category filters */}
      <div className="flex gap-2 flex-wrap mb-2" role="group" aria-label="Filter by category">
        <button
          onClick={() => selectCategory(undefined)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors duration-150 min-h-[36px] ${
            !activeCategory
              ? 'bg-gold-bright text-bg-base font-semibold'
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
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors duration-150 min-h-[36px] ${
              activeCategory === cat.id
                ? 'bg-gold-bright text-bg-base font-semibold'
                : 'bg-bg-overlay text-text-secondary hover:bg-border-hover hover:text-text-primary'
            }`}
            aria-pressed={activeCategory === cat.id}
          >
            {cat.displayName}
          </button>
        ))}
      </div>

      {/* Subcategory filters */}
      {activeCategory && subcategories.length > 0 && (
        <div
          className="flex gap-1.5 flex-wrap mb-4 ml-1 pl-3 border-l-2 border-border-default"
          role="group"
          aria-label="Filter by subcategory"
        >
          {subcategories.map((sub) => (
            <button
              key={sub}
              onClick={() => selectSubcategory(sub)}
              className={`px-2.5 py-1 rounded-full text-xs transition-all duration-150 min-h-[30px] border ${
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
        ) : activeCategory ? (
          <span className="text-text-secondary"> in {categories.find(c => c.id === activeCategory)?.displayName ?? activeCategory}</span>
        ) : null}
      </p>

      {/* Badge grid */}
      <BadgeList badges={badges} />
    </main>
  )
}
