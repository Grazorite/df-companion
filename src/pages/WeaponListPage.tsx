import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import SearchBar from '../components/shared/SearchBar'
import ElementLegend from '../components/shared/ElementLegend'
import SegmentToggle from '../components/shared/SegmentToggle'
import WeaponList from '../components/weapons/WeaponList'
import { useDebounce } from '../hooks/useDebounce'
import { useWeaponCategoryAvailability, useWeaponCounts, useWeapons } from '../hooks/useWeapons'
import { WEAPON_SUBTYPES, type WeaponSubtype } from '../types/weapon'
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
  { id: 'armor-customization', label: 'Armor Customization' },
  { id: 'special', label: 'Special' },
  { id: 'cosmetic', label: 'Cosmetic' },
  { id: 'temp', label: 'Temp' },
  { id: 'rare', label: 'Rare' },
  { id: 'seasonal', label: 'Seasonal' },
  { id: 'special-offer', label: 'Special Offer' },
  { id: 'retired', label: 'Retired' },
] as const

export default function WeaponListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const typeParam = searchParams.get('type')
  const activeSubtype = WEAPON_SUBTYPES.some((meta) => meta.subtype === typeParam)
    ? (typeParam as WeaponSubtype)
    : 'sword-axe-mace'
  const subtypeMeta =
    WEAPON_SUBTYPES.find((meta) => meta.subtype === activeSubtype) ?? WEAPON_SUBTYPES[0]
  const [inputValue, setInputValue] = useState(searchParams.get('q') ?? '')
  const debouncedQuery = useDebounce(inputValue, 300)
  const elementParam = searchParams.get('element')
  const accessParam = searchParams.get('access')
  const categoryParam = searchParams.get('category')
  const categoryAvailability = useWeaponCategoryAvailability(activeSubtype)
  const showArmorCustomizationFilter =
    categoryAvailability.loading || categoryAvailability.hasArmorCustomization
  const showSpecialFilter = categoryAvailability.loading || categoryAvailability.hasSpecial
  const showCosmeticFilter = categoryAvailability.loading || categoryAvailability.hasCosmetic
  const visibleCategoryOptions = useMemo(
    () =>
      CATEGORY_OPTIONS.filter((option) => {
        if (option.id === 'armor-customization') return showArmorCustomizationFilter
        if (option.id === 'special') return showSpecialFilter
        if (option.id === 'cosmetic') return showCosmeticFilter
        return true
      }),
    [showArmorCustomizationFilter, showCosmeticFilter, showSpecialFilter]
  )
  const activeElements = useMemo(
    () => (elementParam ? elementParam.split(',').filter(Boolean) : []),
    [elementParam]
  )
  const activeAccess = useMemo(
    () =>
      accessParam
        ? accessParam
            .split(',')
            .filter((value): value is (typeof ACCESS_OPTIONS)[number]['id'] =>
              ACCESS_OPTIONS.some((option) => option.id === value)
            )
        : [],
    [accessParam]
  )
  const activeCategories = useMemo(
    () =>
      categoryParam
        ? categoryParam
            .split(',')
            .filter((value): value is (typeof CATEGORY_OPTIONS)[number]['id'] =>
              CATEGORY_OPTIONS.some((option) => option.id === value)
            )
            .filter((value) => value !== 'armor-customization' || showArmorCustomizationFilter)
            .filter((value) => value !== 'special' || showSpecialFilter)
            .filter((value) => value !== 'cosmetic' || showCosmeticFilter)
        : [],
    [categoryParam, showArmorCustomizationFilter, showCosmeticFilter, showSpecialFilter]
  )
  const { elements } = elementsData as ElementsData
  const { bySubtype, loading: countsLoading } = useWeaponCounts()

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
  const { weapons, total, loading } = useWeapons(activeSubtype, filters)

  function setParams(next: Record<string, string>) {
    setSearchParams(next, { replace: true })
  }

  function baseParams(): Record<string, string> {
    const params: Record<string, string> = { type: activeSubtype }
    if (debouncedQuery) params.q = debouncedQuery
    if (activeElements.length > 0) params.element = activeElements.join(',')
    if (activeAccess.length > 0) params.access = activeAccess.join(',')
    if (activeCategories.length > 0) params.category = activeCategories.join(',')
    return params
  }

  function toggleAccess(id: (typeof ACCESS_OPTIONS)[number]['id']) {
    const next = activeAccess.includes(id)
      ? activeAccess.filter((value) => value !== id)
      : [...activeAccess, id]
    const params = baseParams()
    delete params.access
    if (next.length > 0) params.access = next.join(',')
    setParams(params)
  }

  function toggleCategory(id: (typeof CATEGORY_OPTIONS)[number]['id']) {
    const next = activeCategories.includes(id)
      ? activeCategories.filter((value) => value !== id)
      : [...activeCategories, id]
    const params = baseParams()
    delete params.category
    if (next.length > 0) params.category = next.join(',')
    setParams(params)
  }

  function toggleElement(code: string) {
    const next = activeElements.includes(code)
      ? activeElements.filter((value) => value !== code)
      : [...activeElements, code]
    const params = baseParams()
    delete params.element
    if (next.length > 0) params.element = next.join(',')
    setParams(params)
  }

  function setSubtype(id: string) {
    if (!WEAPON_SUBTYPES.some((meta) => meta.subtype === id)) return
    const params = baseParams()
    params.type = id
    setParams(params)
  }

  const segments = WEAPON_SUBTYPES.map((meta) => ({
    id: meta.subtype,
    label: meta.label,
    count: countsLoading ? undefined : (bySubtype[meta.subtype] ?? 0),
    active: meta.subtype === activeSubtype,
  }))

  return (
    <main className="px-4 sm:px-6 py-6 max-w-5xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gold mb-1">Weapons</h1>
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
        {ACCESS_OPTIONS.map((option) => {
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
              const params = baseParams()
              delete params.access
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
          {visibleCategoryOptions.map((option) => {
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
                const params = baseParams()
                delete params.category
                setParams(params)
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
          {elements.map((element) => {
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
        </div>
      </div>

      <ElementLegend includeTraits={false} />

      <p className="text-text-muted text-xs mb-4" aria-live="polite" aria-atomic="true">
        {loading ? 'Loading entries...' : `${total} ${total === 1 ? 'entry' : 'entries'} found`}
        {activeElements.length > 0 && (
          <span className="text-gold"> · {activeElements.join(', ')}</span>
        )}
      </p>

      <WeaponList weapons={weapons} loading={loading} />
    </main>
  )
}
