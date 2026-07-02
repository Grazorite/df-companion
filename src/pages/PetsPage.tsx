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
  { id: 'all', label: 'All' },
  { id: 'free', label: 'Free' },
  { id: 'dc', label: 'DC' },
  { id: 'da', label: 'DA Required' },
]

export default function PetsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [inputValue, setInputValue] = useState(searchParams.get('q') ?? '')
  const debouncedQuery = useDebounce(inputValue, 300)

  // Parse URL params
  const typeParam = searchParams.get('type')  // "pets", "guests", or null (both)
  const elementParam = searchParams.get('element')  // comma-separated codes
  const accessParam = searchParams.get('access') ?? 'all'

  const activeTypes: EntryType[] = typeParam
    ? typeParam.split(',').filter((t): t is EntryType => t === 'pet' || t === 'guest')
    : []  // empty = both

  const activeElements = elementParam ? elementParam.split(',').filter(Boolean) : []
  const { elements, traits } = useElements()
  const filterEntries = [...elements, ...traits]
  const allCodes = filterEntries.map(e => e.code)
  const activeAccessLabel = ACCESS_OPTIONS.find(opt => opt.id === accessParam)?.label ?? accessParam
  const activeTypeLabel = activeTypes.length === 1
    ? activeTypes[0] === 'pet' ? 'Pets' : 'Guests'
    : activeTypes.length > 1 ? 'Pets & Guests' : undefined

  // Sync URL
  useEffect(() => {
    const params: Record<string, string> = {}
    if (debouncedQuery) params.q = debouncedQuery
    if (activeTypes.length > 0) params.type = activeTypes.join(',')
    if (activeElements.length > 0) params.element = activeElements.join(',')
    if (accessParam !== 'all') params.access = accessParam
    setSearchParams(params, { replace: true })
  }, [debouncedQuery, typeParam, elementParam, accessParam, setSearchParams])

  const filters = {
    query: debouncedQuery,
    type: activeTypes.length > 0 ? activeTypes : undefined,
    elements: activeElements.length > 0 ? activeElements : undefined,
    access: accessParam !== 'all' ? accessParam as 'free' | 'dc' | 'da' : undefined,
  }

  const { pets, total } = usePets(filters)
  const counts = usePetCounts({ query: debouncedQuery, elements: filters.elements, access: filters.access })

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
    if (accessParam !== 'all') params.access = accessParam
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
    if (accessParam !== 'all') params.access = accessParam
    setSearchParams(params, { replace: true })
  }

  function setAccess(id: string) {
    const params: Record<string, string> = {}
    if (debouncedQuery) params.q = debouncedQuery
    if (activeTypes.length > 0) params.type = activeTypes.join(',')
    if (activeElements.length > 0) params.element = activeElements.join(',')
    if (id !== 'all') params.access = id
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

      {/* Access filter */}
      <div className="flex gap-2 flex-wrap mb-3" role="group" aria-label="Filter by access">
        {ACCESS_OPTIONS.map(opt => (
          <button
            key={opt.id}
            onClick={() => setAccess(opt.id)}
            aria-pressed={accessParam === opt.id || (opt.id === 'all' && accessParam === 'all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors duration-150 min-h-[36px] ${
              (opt.id === 'all' && accessParam === 'all') || accessParam === opt.id
                ? 'bg-gold-bright text-bg-base font-semibold'
                : 'bg-bg-overlay text-text-secondary hover:bg-border-hover hover:text-text-primary'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Element filter — select/deselect element pills */}
      <div className="mb-2">
        <p className="text-text-muted text-xs mb-2 font-medium">Element / Trait filter:</p>
        <div className="flex flex-wrap gap-1.5">
          {allCodes.map(code => (
            <button
              key={code}
              onClick={() => toggleElement(code)}
              aria-pressed={activeElements.includes(code)}
              className={`transition-all duration-150 rounded-full ${activeElements.includes(code) ? 'ring-2 ring-gold' : 'opacity-60 hover:opacity-100'}`}
            >
              <span className="pointer-events-none">
                <span className={`inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded-full ${
                  filterEntries.find(e => e.code === code)?.colour ?? 'bg-bg-overlay text-text-muted'
                }`}>
                  {code}
                </span>
              </span>
            </button>
          ))}
          {activeElements.length > 0 && (
            <button
              onClick={() => {
                const params: Record<string, string> = {}
                if (debouncedQuery) params.q = debouncedQuery
                if (activeTypes.length > 0) params.type = activeTypes.join(',')
                if (accessParam !== 'all') params.access = accessParam
                setSearchParams(params, { replace: true })
              }}
              className="text-xs text-text-muted hover:text-text-primary underline underline-offset-2 ml-1"
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
        {accessParam !== 'all' && <span className="text-orange-400"> · {activeAccessLabel}</span>}
      </p>

      {/* List */}
      <PetList pets={pets} />
    </main>
  )
}
