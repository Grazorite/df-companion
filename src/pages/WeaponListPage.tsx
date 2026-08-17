import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import SearchBar from '../components/shared/SearchBar'
import ElementLegend from '../components/shared/ElementLegend'
import SegmentToggle from '../components/shared/SegmentToggle'
import TriStateFilterPill from '../components/shared/TriStateFilterPill'
import WeaponList from '../components/weapons/WeaponList'
import { useDebounce } from '../hooks/useDebounce'
import { useWeaponCategoryAvailability, useWeaponCounts, useWeapons } from '../hooks/useWeapons'
import { WEAPON_SUBTYPES, type WeaponSubtype } from '../types/weapon'
import elementsData from '../data/elements.json'
import type { ElementsData } from '../types/element'
import { cycleTriState, getTriState, parseFilterParam } from '../utils/triStateFilters'

const ACCESS_OPTIONS = [
  { id: 'multi', label: 'Multiple Versions' },
  { id: 'da', label: 'DA Required' },
  { id: 'merge', label: 'Merge Required' },
  { id: 'free', label: 'Free' },
  { id: 'dc', label: 'DC' },
  { id: 'dm', label: 'DM' },
  { id: 'default', label: 'Default' },
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
  const excludeElementParam = searchParams.get('excludeElement')
  const accessParam = searchParams.get('access')
  const excludeAccessParam = searchParams.get('excludeAccess')
  const categoryParam = searchParams.get('category')
  const excludeCategoryParam = searchParams.get('excludeCategory')
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
  const excludedElements = useMemo(
    () => (excludeElementParam ? excludeElementParam.split(',').filter(Boolean) : []),
    [excludeElementParam]
  )
  const activeAccess = useMemo(
    () =>
      parseFilterParam(accessParam, (value): value is (typeof ACCESS_OPTIONS)[number]['id'] =>
        ACCESS_OPTIONS.some((option) => option.id === value)
      ),
    [accessParam]
  )
  const excludedAccess = useMemo(
    () =>
      parseFilterParam(
        excludeAccessParam,
        (value): value is (typeof ACCESS_OPTIONS)[number]['id'] =>
          ACCESS_OPTIONS.some((option) => option.id === value)
      ),
    [excludeAccessParam]
  )
  const activeCategories = useMemo(
    () =>
      parseFilterParam(categoryParam, (value): value is (typeof CATEGORY_OPTIONS)[number]['id'] =>
        CATEGORY_OPTIONS.some((option) => option.id === value)
      )
        .filter((value) => value !== 'armor-customization' || showArmorCustomizationFilter)
        .filter((value) => value !== 'special' || showSpecialFilter)
        .filter((value) => value !== 'cosmetic' || showCosmeticFilter),
    [categoryParam, showArmorCustomizationFilter, showCosmeticFilter, showSpecialFilter]
  )
  const excludedCategories = useMemo(
    () =>
      parseFilterParam(
        excludeCategoryParam,
        (value): value is (typeof CATEGORY_OPTIONS)[number]['id'] =>
          CATEGORY_OPTIONS.some((option) => option.id === value)
      )
        .filter((value) => value !== 'armor-customization' || showArmorCustomizationFilter)
        .filter((value) => value !== 'special' || showSpecialFilter)
        .filter((value) => value !== 'cosmetic' || showCosmeticFilter),
    [excludeCategoryParam, showArmorCustomizationFilter, showCosmeticFilter, showSpecialFilter]
  )
  const { elements } = elementsData as ElementsData
  const { bySubtype, loading: countsLoading } = useWeaponCounts()

  const canonicalQueryString = useMemo(() => {
    const params = new URLSearchParams()
    params.set('type', activeSubtype)
    if (debouncedQuery) params.set('q', debouncedQuery)
    if (activeElements.length > 0) params.set('element', activeElements.join(','))
    if (excludedElements.length > 0) params.set('excludeElement', excludedElements.join(','))
    if (activeAccess.length > 0) params.set('access', activeAccess.join(','))
    if (excludedAccess.length > 0) params.set('excludeAccess', excludedAccess.join(','))
    if (activeCategories.length > 0) params.set('category', activeCategories.join(','))
    if (excludedCategories.length > 0) params.set('excludeCategory', excludedCategories.join(','))
    return params.toString()
  }, [
    activeSubtype,
    debouncedQuery,
    activeElements,
    excludedElements,
    activeAccess,
    excludedAccess,
    activeCategories,
    excludedCategories,
  ])

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
      excludeElements: excludedElements.length > 0 ? excludedElements : undefined,
      access: activeAccess.length > 0 ? activeAccess : undefined,
      excludeAccess: excludedAccess.length > 0 ? excludedAccess : undefined,
      categories: activeCategories.length > 0 ? activeCategories : undefined,
      excludeCategories: excludedCategories.length > 0 ? excludedCategories : undefined,
    }),
    [
      activeAccess,
      excludedAccess,
      activeCategories,
      excludedCategories,
      activeElements,
      excludedElements,
      debouncedQuery,
    ]
  )
  const { weapons, total, loading } = useWeapons(activeSubtype, filters)

  function setParams(next: Record<string, string>) {
    setSearchParams(next, { replace: true })
  }

  function baseParams(): Record<string, string> {
    const params: Record<string, string> = { type: activeSubtype }
    if (debouncedQuery) params.q = debouncedQuery
    if (activeElements.length > 0) params.element = activeElements.join(',')
    if (excludedElements.length > 0) params.excludeElement = excludedElements.join(',')
    if (activeAccess.length > 0) params.access = activeAccess.join(',')
    if (excludedAccess.length > 0) params.excludeAccess = excludedAccess.join(',')
    if (activeCategories.length > 0) params.category = activeCategories.join(',')
    if (excludedCategories.length > 0) params.excludeCategory = excludedCategories.join(',')
    return params
  }

  function toggleAccess(id: (typeof ACCESS_OPTIONS)[number]['id']) {
    const next = cycleTriState(id, { include: activeAccess, exclude: excludedAccess })
    const params = baseParams()
    delete params.access
    delete params.excludeAccess
    if (next.include.length > 0) params.access = next.include.join(',')
    if (next.exclude.length > 0) params.excludeAccess = next.exclude.join(',')
    setParams(params)
  }

  function toggleCategory(id: (typeof CATEGORY_OPTIONS)[number]['id']) {
    const next = cycleTriState(id, { include: activeCategories, exclude: excludedCategories })
    const params = baseParams()
    delete params.category
    delete params.excludeCategory
    if (next.include.length > 0) params.category = next.include.join(',')
    if (next.exclude.length > 0) params.excludeCategory = next.exclude.join(',')
    setParams(params)
  }

  function toggleElement(code: string) {
    const next = cycleTriState(code, { include: activeElements, exclude: excludedElements })
    const params = baseParams()
    delete params.element
    delete params.excludeElement
    if (next.include.length > 0) params.element = next.include.join(',')
    if (next.exclude.length > 0) params.excludeElement = next.exclude.join(',')
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
          return (
            <TriStateFilterPill
              key={option.id}
              label={option.label}
              state={getTriState(option.id, { include: activeAccess, exclude: excludedAccess })}
              onClick={() => toggleAccess(option.id)}
              size="access"
            />
          )
        })}
        {(activeAccess.length > 0 || excludedAccess.length > 0) && (
          <button
            onClick={() => {
              const params = baseParams()
              delete params.access
              delete params.excludeAccess
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
            return (
              <TriStateFilterPill
                key={option.id}
                label={option.label}
                state={getTriState(option.id, {
                  include: activeCategories,
                  exclude: excludedCategories,
                })}
                onClick={() => toggleCategory(option.id)}
                size="category"
                activeClassName="bg-orange-500/80 text-white"
              />
            )
          })}
          {(activeCategories.length > 0 || excludedCategories.length > 0) && (
            <button
              onClick={() => {
                const params = baseParams()
                delete params.category
                delete params.excludeCategory
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
            const state = getTriState(element.code, {
              include: activeElements,
              exclude: excludedElements,
            })
            return (
              <TriStateFilterPill
                key={element.code}
                label={element.code}
                state={state}
                onClick={() => toggleElement(element.code)}
                size="element"
                activeClassName={`${element.colour} ring-2 ring-gold`}
                inactiveClassName={`${element.colour} opacity-60 hover:opacity-100`}
              />
            )
          })}
          {(activeElements.length > 0 || excludedElements.length > 0) && (
            <button
              onClick={() => {
                const params = baseParams()
                delete params.element
                delete params.excludeElement
                setParams(params)
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
        {loading ? 'Loading entries...' : `${total} ${total === 1 ? 'entry' : 'entries'} found`}
        {activeElements.length > 0 && (
          <span className="text-gold"> · {activeElements.join(', ')}</span>
        )}
        {excludedElements.length > 0 && (
          <span className="text-red-300"> · excluding {excludedElements.join(', ')}</span>
        )}
        {activeAccess.length > 0 && (
          <span className="text-orange-400">
            {' '}
            ·{' '}
            {activeAccess
              .map((id) => ACCESS_OPTIONS.find((option) => option.id === id)?.label ?? id)
              .join(', ')}
          </span>
        )}
        {excludedAccess.length > 0 && (
          <span className="text-red-300">
            {' '}
            · excluding{' '}
            {excludedAccess
              .map((id) => ACCESS_OPTIONS.find((option) => option.id === id)?.label ?? id)
              .join(', ')}
          </span>
        )}
        {activeCategories.length > 0 && (
          <span className="text-orange-400">
            {' '}
            ·{' '}
            {activeCategories
              .map((id) => CATEGORY_OPTIONS.find((option) => option.id === id)?.label ?? id)
              .join(', ')}
          </span>
        )}
        {excludedCategories.length > 0 && (
          <span className="text-red-300">
            {' '}
            · excluding{' '}
            {excludedCategories
              .map((id) => CATEGORY_OPTIONS.find((option) => option.id === id)?.label ?? id)
              .join(', ')}
          </span>
        )}
      </p>

      <WeaponList weapons={weapons} loading={loading} />
    </main>
  )
}
