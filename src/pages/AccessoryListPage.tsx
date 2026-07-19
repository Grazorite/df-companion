import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import SearchBar from '../components/shared/SearchBar'
import ElementLegend from '../components/shared/ElementLegend'
import SegmentToggle from '../components/shared/SegmentToggle'
import AccessoryList from '../components/accessories/AccessoryList'
import { useDebounce } from '../hooks/useDebounce'
import { useAccessories, useAccessoryCounts } from '../hooks/useAccessories'
import { ACCESSORY_SUBTYPES, type AccessorySubtype } from '../types/accessory'
import elementsData from '../data/elements.json'
import type { ElementsData } from '../types/element'

const ACCESS_OPTIONS = [
  { id: 'multi', label: 'Multiple Versions' },
  { id: 'da', label: 'DA Required' },
  { id: 'merge', label: 'Merge Required' },
  { id: 'free', label: 'Free' },
  { id: 'dc', label: 'DC' },
  { id: 'dm', label: 'DM' },
] as const

const CATEGORY_OPTIONS = [
  { id: 'temp', label: 'Temp' },
  { id: 'rare', label: 'Rare' },
  { id: 'seasonal', label: 'Seasonal' },
  { id: 'special-offer', label: 'Special Offer' },
  { id: 'retired', label: 'Retired' },
] as const

export default function AccessoryListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const typeParam = searchParams.get('type')
  const activeSubtype = ACCESSORY_SUBTYPES.some(meta => meta.subtype === typeParam)
    ? (typeParam as AccessorySubtype)
    : 'artifact'
  const subtypeMeta = ACCESSORY_SUBTYPES.find(meta => meta.subtype === activeSubtype) ?? ACCESSORY_SUBTYPES[0]
  const [inputValue, setInputValue] = useState(searchParams.get('q') ?? '')
  const debouncedQuery = useDebounce(inputValue, 300)
  const elementParam = searchParams.get('element')
  const accessParam = searchParams.get('access')
  const categoryParam = searchParams.get('category')
  const activeElements = useMemo(
    () => elementParam ? elementParam.split(',').filter(Boolean) : [],
    [elementParam]
  )
  const activeAccess = useMemo(
    () => accessParam
      ? accessParam
          .split(',')
          .filter((value): value is (typeof ACCESS_OPTIONS)[number]['id'] =>
            ACCESS_OPTIONS.some(option => option.id === value)
          )
      : [],
    [accessParam]
  )
  const activeCategories = useMemo(
    () => categoryParam
      ? categoryParam
          .split(',')
          .filter((value): value is (typeof CATEGORY_OPTIONS)[number]['id'] =>
            CATEGORY_OPTIONS.some(option => option.id === value)
          )
      : [],
    [categoryParam]
  )

  const { elements } = elementsData as ElementsData
  const { bySubtype } = useAccessoryCounts()

  const canonicalQueryString = useMemo(() => {
    const params = new URLSearchParams()
    params.set('type', activeSubtype)
    if (debouncedQuery) params.set('q', debouncedQuery)
    if (activeElements.length > 0) params.set('element', activeElements.join(','))
    if (activeAccess.length > 0) params.set('access', activeAccess.join(','))
    if (activeCategories.length > 0) params.set('category', activeCategories.join(','))
    return params.toString()
  }, [activeSubtype, debouncedQuery, activeElements, activeAccess, activeCategories])

  useEffect(() => {
    if (searchParams.toString() === canonicalQueryString) return
    setSearchParams(canonicalQueryString ? new URLSearchParams(canonicalQueryString) : {}, {
      replace: true,
    })
  }, [canonicalQueryString, searchParams, setSearchParams])

  const filters = useMemo(
    () => ({
      query: debouncedQuery || undefined,
      elements: activeElements.length > 0 ? activeElements : undefined,
      access: activeAccess.length > 0 ? activeAccess : undefined,
      categories: activeCategories.length > 0 ? activeCategories : undefined,
    }),
    [activeAccess, activeCategories, activeElements, debouncedQuery]
  )

  const { accessories, total } = useAccessories(activeSubtype, filters)

  function toggleAccess(id: (typeof ACCESS_OPTIONS)[number]['id']) {
    const next = activeAccess.includes(id)
      ? activeAccess.filter(value => value !== id)
      : [...activeAccess, id]
    const params: Record<string, string> = {}
    params.type = activeSubtype
    if (debouncedQuery) params.q = debouncedQuery
    if (activeElements.length > 0) params.element = activeElements.join(',')
    if (activeCategories.length > 0) params.category = activeCategories.join(',')
    if (next.length > 0) params.access = next.join(',')
    setSearchParams(params, { replace: true })
  }

  function toggleCategory(id: (typeof CATEGORY_OPTIONS)[number]['id']) {
    const next = activeCategories.includes(id)
      ? activeCategories.filter(value => value !== id)
      : [...activeCategories, id]
    const params: Record<string, string> = { type: activeSubtype }
    if (debouncedQuery) params.q = debouncedQuery
    if (activeElements.length > 0) params.element = activeElements.join(',')
    if (activeAccess.length > 0) params.access = activeAccess.join(',')
    if (next.length > 0) params.category = next.join(',')
    setSearchParams(params, { replace: true })
  }

  function toggleElement(code: string) {
    const next = activeElements.includes(code)
      ? activeElements.filter(value => value !== code)
      : [...activeElements, code]
    const params: Record<string, string> = {}
    params.type = activeSubtype
    if (debouncedQuery) params.q = debouncedQuery
    if (next.length > 0) params.element = next.join(',')
    if (activeAccess.length > 0) params.access = activeAccess.join(',')
    if (activeCategories.length > 0) params.category = activeCategories.join(',')
    setSearchParams(params, { replace: true })
  }

  function setSubtype(id: string) {
    if (!ACCESSORY_SUBTYPES.some(meta => meta.subtype === id)) return
    const params: Record<string, string> = { type: id }
    if (debouncedQuery) params.q = debouncedQuery
    if (activeElements.length > 0) params.element = activeElements.join(',')
    if (activeAccess.length > 0) params.access = activeAccess.join(',')
    if (activeCategories.length > 0) params.category = activeCategories.join(',')
    setSearchParams(params, { replace: true })
  }

  const segments = ACCESSORY_SUBTYPES.map(meta => ({
    id: meta.subtype,
    label: meta.label,
    count: bySubtype[meta.subtype] ?? 0,
    active: meta.subtype === activeSubtype,
  }))

  return (
    <main className="px-4 sm:px-6 py-6 max-w-5xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gold mb-1">Accessories</h1>
        <p className="text-text-secondary text-sm">{subtypeMeta.shortDescription}</p>
      </div>

      <div className="mb-4">
        <SegmentToggle segments={segments} onToggle={setSubtype} />
      </div>

      <div className="mb-4">
        <SearchBar
          value={inputValue}
          onChange={setInputValue}
          onClear={() => setInputValue('')}
          placeholder={`Search ${subtypeMeta.label.toLowerCase()} by name, element, or description...`}
        />
      </div>

      <div className="flex gap-2 flex-wrap mb-3" role="group" aria-label="Filter by access">
        {ACCESS_OPTIONS.map(option => {
          const isActive = activeAccess.includes(option.id)
          return (
            <button
              key={option.id}
              onClick={() => toggleAccess(option.id)}
              aria-pressed={isActive}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors duration-150 min-h-[36px] ${
                isActive
                  ? 'bg-gold-bright text-bg-base font-semibold'
                  : 'bg-bg-overlay text-text-secondary hover:bg-border-hover hover:text-text-primary'
              }`}
            >
              {option.label}
            </button>
          )
        })}
        {activeAccess.length > 0 && (
          <button
            onClick={() => {
              const params: Record<string, string> = { type: activeSubtype }
              if (debouncedQuery) params.q = debouncedQuery
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

      <div className="mb-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          {CATEGORY_OPTIONS.map(option => {
            const isActive = activeCategories.includes(option.id)
            return (
              <button
                key={option.id}
                onClick={() => toggleCategory(option.id)}
                aria-pressed={isActive}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors duration-150 ${
                  isActive
                    ? 'bg-orange-500/80 text-white font-semibold'
                    : 'bg-bg-overlay text-text-secondary hover:bg-border-hover hover:text-text-primary'
                }`}
              >
                {option.label}
              </button>
            )
          })}
          {activeCategories.length > 0 && (
            <button
              onClick={() => {
                const params: Record<string, string> = { type: activeSubtype }
                if (debouncedQuery) params.q = debouncedQuery
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

      <div className="mb-2">
        <div className="flex flex-wrap gap-1.5">
          {elements.map(element => {
            const isActive = activeElements.includes(element.code)
            return (
              <button
                key={element.code}
                onClick={() => toggleElement(element.code)}
                aria-pressed={isActive}
                className="transition-all duration-150"
              >
                <span
                  className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full ${element.colour} ${
                    isActive ? 'ring-2 ring-gold' : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  {element.code}
                </span>
              </button>
            )
          })}
          {activeElements.length > 0 && (
            <button
              onClick={() => {
                const params: Record<string, string> = { type: activeSubtype }
                if (debouncedQuery) params.q = debouncedQuery
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

      <ElementLegend includeTraits={false} />

      <p className="text-text-muted text-xs mb-4" aria-live="polite" aria-atomic="true">
        {total} {total === 1 ? 'entry' : 'entries'} found
        {activeElements.length > 0 && <span className="text-gold"> · {activeElements.join(', ')}</span>}
        {activeAccess.length > 0 && (
          <span className="text-orange-400">
            {' '}
            ·{' '}
            {activeAccess
              .map(id => ACCESS_OPTIONS.find(option => option.id === id)?.label ?? id)
              .join(', ')}
          </span>
        )}
        {activeCategories.length > 0 && (
          <span className="text-orange-400">
            {' '}
            ·{' '}
            {activeCategories
              .map(id => CATEGORY_OPTIONS.find(option => option.id === id)?.label ?? id)
              .join(', ')}
          </span>
        )}
      </p>

      <AccessoryList accessories={accessories} />
    </main>
  )
}
