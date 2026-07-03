import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePets, usePetCounts, useElements } from '../hooks/usePets'
import { useDebounce } from '../hooks/useDebounce'
import SearchBar from '../components/shared/SearchBar'
import SegmentToggle from '../components/shared/SegmentToggle'
import ElementLegend from '../components/shared/ElementLegend'
import PetList from '../components/pets/PetList'
import type { EntryType } from '../types/pet'

const ACCESS_OPTIONS = [
  { id: 'multi', label: 'Multiple Versions', petsOnly: false },
  { id: 'da', label: 'DA Required', petsOnly: false },
  { id: 'merge', label: 'Merge Required', petsOnly: true },
  { id: 'free', label: 'Free', petsOnly: true },
  { id: 'dc', label: 'DC', petsOnly: true },
  { id: 'dm', label: 'DM', petsOnly: true },
]

const CATEGORY_OPTIONS = [
  { id: 'temp', label: 'Temp' },
  { id: 'rare', label: 'Rare' },
  { id: 'seasonal', label: 'Seasonal' },
  { id: 'special-offer', label: 'Special Offer' },
  { id: 'retired', label: 'Retired' },
]

export default function PetsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [inputValue, setInputValue] = useState(searchParams.get('q') ?? '')
  const debouncedQuery = useDebounce(inputValue, 300)

  // Parse URL params
  const typeParam = searchParams.get('type')  // "pets", "guests", or null (both)
  const elementParam = searchParams.get('element')  // comma-separated codes
  const accessParam = searchParams.get('access')  // comma-separated: "da,free" or null (all)
  const categoryParam = searchParams.get('category')  // comma-separated: "temp,rare"

  const activeTypes: EntryType[] = typeParam
    ? typeParam.split(',').filter((t): t is EntryType => t === 'pet' || t === 'guest')
    : []  // empty = both

  const activeElements = elementParam ? elementParam.split(',').filter(Boolean) : []
  const activeAccess = accessParam ? accessParam.split(',').filter((a): a is 'multi' | 'free' | 'merge' | 'dc' | 'dm' | 'da' =>
    ['multi', 'free', 'merge', 'dc', 'dm', 'da'].includes(a)
  ) : []
  const activeCategories = categoryParam ? categoryParam.split(',').filter((c): c is 'temp' | 'rare' | 'seasonal' | 'special-offer' | 'retired' => 
    ['temp', 'rare', 'seasonal', 'special-offer', 'retired'].includes(c)
  ) : []
  
  const { elements, traits } = useElements()
  const filterEntries = [...elements, ...traits]
  const allCodes = filterEntries.map(e => e.code)
  const activeTypeLabel = activeTypes.length === 1
    ? activeTypes[0] === 'pet' ? 'Pets' : 'Guests'
    : activeTypes.length > 1 ? 'Pets & Guests' : undefined

  // Sync URL
  useEffect(() => {
    const params: Record<string, string> = {}
    if (debouncedQuery) params.q = debouncedQuery
    if (activeTypes.length > 0) params.type = activeTypes.join(',')
    if (activeElements.length > 0) params.element = activeElements.join(',')
    if (activeAccess.length > 0) params.access = activeAccess.join(',')
    if (activeCategories.length > 0) params.category = activeCategories.join(',')
    setSearchParams(params, { replace: true })
  }, [debouncedQuery, typeParam, elementParam, accessParam, categoryParam, setSearchParams])

  const filters = {
    query: debouncedQuery,
    type: activeTypes.length > 0 ? activeTypes : undefined,
    elements: activeElements.length > 0 ? activeElements : undefined,
    access: activeAccess.length > 0 ? activeAccess : undefined,
    categories: activeCategories.length > 0 ? activeCategories : undefined,
  }

  const { pets, total } = usePets(filters)
  const counts = usePetCounts({ query: debouncedQuery, elements: filters.elements, access: filters.access, categories: filters.categories })

  // Determine if we're showing guests only (for conditional filter display)
  const isGuestsOnly = activeTypes.length === 1 && activeTypes[0] === 'guest'

  function toggleType(id: string) {
    const type = id as EntryType
    let next: EntryType[]
    if (activeTypes.includes(type)) {
      next = activeTypes.filter(t => t !== type)
    } else {
      next = [...activeTypes, type]
    }
    const params: Record<string, string> = {}
    if (debouncedQuery) params.q = debouncedQuery
    if (next.length > 0) params.type = next.join(',')
    if (activeElements.length > 0) params.element = activeElements.join(',')
    if (activeAccess.length > 0) params.access = activeAccess.join(',')
    if (activeCategories.length > 0) params.category = activeCategories.join(',')
    setSearchParams(params, { replace: true })
  }

  function toggleElement(code: string) {
    const next = activeElements.includes(code)
      ? activeElements.filter(e => e !== code)
      : [...activeElements, code]
    const params: Record<string, string> = {}
    if (debouncedQuery) params.q = debouncedQuery
    if (activeTypes.length > 0) params.type = activeTypes.join(',')
    if (next.length > 0) params.element = next.join(',')
    if (activeAccess.length > 0) params.access = activeAccess.join(',')
    if (activeCategories.length > 0) params.category = activeCategories.join(',')
    setSearchParams(params, { replace: true })
  }

  function toggleAccess(id: string) {
    const accessType = id as 'multi' | 'free' | 'merge' | 'dc' | 'dm' | 'da'
    const next = activeAccess.includes(accessType)
      ? activeAccess.filter(a => a !== accessType)
      : [...activeAccess, accessType]
    const params: Record<string, string> = {}
    if (debouncedQuery) params.q = debouncedQuery
    if (activeTypes.length > 0) params.type = activeTypes.join(',')
    if (activeElements.length > 0) params.element = activeElements.join(',')
    if (next.length > 0) params.access = next.join(',')
    if (activeCategories.length > 0) params.category = activeCategories.join(',')
    setSearchParams(params, { replace: true })
  }

  function toggleCategory(id: string) {
    const cat = id as 'temp' | 'rare' | 'seasonal' | 'special-offer' | 'retired'
    const next = activeCategories.includes(cat)
      ? activeCategories.filter(c => c !== cat)
      : [...activeCategories, cat]
    const params: Record<string, string> = {}
    if (debouncedQuery) params.q = debouncedQuery
    if (activeTypes.length > 0) params.type = activeTypes.join(',')
    if (activeElements.length > 0) params.element = activeElements.join(',')
    if (activeAccess.length > 0) params.access = activeAccess.join(',')
    if (next.length > 0) params.category = next.join(',')
    setSearchParams(params, { replace: true })
  }

  const segments = [
    { id: 'pet', label: 'Pets', count: counts.pet, active: activeTypes.length === 0 || activeTypes.includes('pet') },
    { id: 'guest', label: 'Guests', count: counts.guest, active: activeTypes.length === 0 || activeTypes.includes('guest') },
  ]

  return (
    <main className="px-4 sm:px-6 py-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gold mb-1">Pets & Guests</h1>
        <p className="text-text-secondary text-sm">Companions who fight alongside you in DragonFable.</p>
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
        {ACCESS_OPTIONS.map(opt => {
          // Hide pet-only filters when showing guests only
          if (opt.petsOnly && isGuestsOnly) return null
          
          const isActive = activeAccess.includes(opt.id as any)
          const isDisabled = opt.petsOnly && isGuestsOnly
          
          return (
            <button
              key={opt.id}
              onClick={() => toggleAccess(opt.id)}
              disabled={isDisabled}
              aria-pressed={isActive}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors duration-150 min-h-[36px] ${
                isActive
                  ? 'bg-gold-bright text-bg-base font-semibold'
                  : isDisabled
                  ? 'bg-bg-overlay text-text-muted opacity-40 cursor-not-allowed'
                  : 'bg-bg-overlay text-text-secondary hover:bg-border-hover hover:text-text-primary'
              }`}
            >
              {opt.label}
            </button>
          )
        })}
        {activeAccess.length > 0 && (
          <button
            onClick={() => {
              const params: Record<string, string> = {}
              if (debouncedQuery) params.q = debouncedQuery
              if (activeTypes.length > 0) params.type = activeTypes.join(',')
              if (activeElements.length > 0) params.element = activeElements.join(',')
              if (activeCategories.length > 0) params.category = activeCategories.join(',')
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
          {CATEGORY_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => toggleCategory(opt.id)}
              aria-pressed={activeCategories.includes(opt.id as any)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors duration-150 ${
                activeCategories.includes(opt.id as any)
                  ? 'bg-orange-500/80 text-white font-semibold'
                  : 'bg-bg-overlay text-text-secondary hover:bg-border-hover hover:text-text-primary'
              }`}
            >
              {opt.label}
            </button>
          ))}
          {activeCategories.length > 0 && (
            <button
              onClick={() => {
                const params: Record<string, string> = {}
                if (debouncedQuery) params.q = debouncedQuery
                if (activeTypes.length > 0) params.type = activeTypes.join(',')
                if (activeElements.length > 0) params.element = activeElements.join(',')
                if (activeAccess.length > 0) params.access = activeAccess.join(',')
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
          {allCodes.map(code => {
            const isActive = activeElements.includes(code)
            const colour = filterEntries.find(e => e.code === code)?.colour ?? 'bg-bg-overlay text-text-muted'
            return (
              <button
                key={code}
                onClick={() => toggleElement(code)}
                aria-pressed={isActive}
                className="transition-all duration-150"
              >
                <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full ${colour} ${
                  isActive ? 'ring-2 ring-gold' : 'opacity-60 hover:opacity-100'
                }`}>
                  {code}
                </span>
              </button>
            )
          })}
          {activeElements.length > 0 && (
            <button
              onClick={() => {
                const params: Record<string, string> = {}
                if (debouncedQuery) params.q = debouncedQuery
                if (activeTypes.length > 0) params.type = activeTypes.join(',')
                if (activeAccess.length > 0) params.access = activeAccess.join(',')
                if (activeCategories.length > 0) params.category = activeCategories.join(',')
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
        {activeAccess.length > 0 && (
          <span className="text-orange-400"> · {activeAccess.map(a => ACCESS_OPTIONS.find(opt => opt.id === a)?.label ?? a).join(', ')}</span>
        )}
        {activeCategories.length > 0 && (
          <span className="text-orange-400"> · {activeCategories.map(c => CATEGORY_OPTIONS.find(opt => opt.id === c)?.label ?? c).join(', ')}</span>
        )}
      </p>

      {/* List */}
      <PetList pets={pets} />
    </main>
  )
}
