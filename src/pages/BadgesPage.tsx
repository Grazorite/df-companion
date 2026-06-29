import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { useBadges, useCategories } from '../hooks/useBadges'
import { useDebounce } from '../hooks/useDebounce'
import BadgeCard from '../components/badges/BadgeCard'
import type { BadgeCategory } from '../types/badge'

export default function BadgesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [inputValue, setInputValue] = useState(searchParams.get('q') ?? '')
  const debouncedQuery = useDebounce(inputValue, 300)
  const activeCategory = (searchParams.get('category') as BadgeCategory) ?? undefined
  const categories = useCategories()

  // Sync debounced query to URL
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
    if (id !== activeCategory) params.category = id
    setSearchParams(params, { replace: true })
  }

  function clearSearch() {
    setInputValue('')
    const params: Record<string, string> = {}
    if (activeCategory) params.category = activeCategory
    setSearchParams(params, { replace: true })
  }

  return (
    <main className="px-4 py-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-amber-400 mb-1">Badges</h1>
        <p className="text-slate-400 text-sm">
          Hidden achievements earned through quests, exploration, and more.
        </p>
      </div>

      {/* Search bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="search"
          placeholder="Search badges..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-9 pr-9 py-2.5 text-white placeholder-slate-400 text-sm focus:outline-none focus:border-amber-500 transition-colors"
        />
        {inputValue && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Category filters */}
      <div className="flex gap-2 flex-wrap mb-5">
        <button
          onClick={() => { setSearchParams(debouncedQuery ? { q: debouncedQuery } : {}, { replace: true }) }}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            !activeCategory
              ? 'bg-amber-500 text-slate-900'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleCategoryClick(cat.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeCategory === cat.id
                ? 'bg-amber-500 text-slate-900'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {cat.displayName}
          </button>
        ))}
      </div>

      {/* Results count */}
      <p className="text-slate-500 text-xs mb-4">
        {total} {total === 1 ? 'badge' : 'badges'} found
      </p>

      {/* Badge grid */}
      {badges.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {badges.map((badge) => (
            <BadgeCard key={badge.id} badge={badge} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg mb-1">No badges found</p>
          <p className="text-sm">Try adjusting your search or clearing filters</p>
        </div>
      )}
    </main>
  )
}
