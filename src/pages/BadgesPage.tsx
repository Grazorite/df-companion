import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useBadges, useCategories } from '../hooks/useBadges'
import { useDebounce } from '../hooks/useDebounce'
import SearchBar from '../components/shared/SearchBar'
import BadgeList from '../components/badges/BadgeList'
import type { BadgeCategory } from '../types/badge'

export default function BadgesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [inputValue, setInputValue] = useState(searchParams.get('q') ?? '')
  const debouncedQuery = useDebounce(inputValue, 300)
  const activeCategory = (searchParams.get('category') as BadgeCategory) ?? undefined
  const categories = useCategories()

  // Sync debounced query to URL for shareable links
  useEffect(() => {
    const params: Record<string, string> = {}
    if (debouncedQuery) params.q = debouncedQuery
    if (activeCategory) params.category = activeCategory
    setSearchParams(params, { replace: true })
  }, [debouncedQuery, activeCategory, setSearchParams])

  const { badges, total } = useBadges({ query: debouncedQuery, category: activeCategory })

  function handleCategoryClick(id: BadgeCategory) {
    const params: Record<string, string> = {}
    if (debouncedQuery) params.q = debouncedQuery
    // Toggle off if already active
    if (id !== activeCategory) params.category = id
    setSearchParams(params, { replace: true })
  }

  function clearCategory() {
    const params: Record<string, string> = {}
    if (debouncedQuery) params.q = debouncedQuery
    setSearchParams(params, { replace: true })
  }

  function clearSearch() {
    setInputValue('')
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
          onClear={clearSearch}
          placeholder="Search badges by name, description, or tags..."
        />
      </div>

      {/* Category filter chips */}
      <div className="flex gap-2 flex-wrap mb-4" role="group" aria-label="Filter by category">
        <button
          onClick={clearCategory}
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
            onClick={() => handleCategoryClick(cat.id)}
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

      {/* Results count */}
      <p className="text-slate-500 text-xs mb-4" aria-live="polite" aria-atomic="true">
        {total} {total === 1 ? 'badge' : 'badges'} found
        {activeCategory && (
          <span className="text-slate-600">
            {' '}in{' '}
            <span className="text-slate-400 capitalize">{activeCategory.replace(/-/g, ' ')}</span>
          </span>
        )}
      </p>

      {/* Badge grid */}
      <BadgeList badges={badges} />
    </main>
  )
}
