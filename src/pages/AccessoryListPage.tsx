import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import SearchBar from '../components/shared/SearchBar'
import ElementLegend from '../components/shared/ElementLegend'
import SegmentToggle from '../components/shared/SegmentToggle'
import TriStateFilterPill from '../components/shared/TriStateFilterPill'
import AccessoryList from '../components/accessories/AccessoryList'
import { useDebounce } from '../hooks/useDebounce'
import {
  useAccessories,
  useAccessoryCategoryAvailability,
  useAccessoryCounts,
} from '../hooks/useAccessories'
import { ACCESSORY_SUBTYPES, type AccessorySubtype } from '../types/accessory'
import elementsData from '../data/elements.json'
import type { ElementsData } from '../types/element'
import {
  filterAccessOptionsByAvailability,
  filterCategoryOptionsByAvailability,
  filterElementOptionsByAvailability,
} from '../utils/filterVisibility'
import { cycleTriState, getTriState, parseFilterParam } from '../utils/triStateFilters'

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
  { id: 'cosmetic', label: 'Cosmetic' },
  { id: 'temp', label: 'Temp' },
  { id: 'rare', label: 'Rare' },
  { id: 'seasonal', label: 'Seasonal' },
  { id: 'special-offer', label: 'Special Offer' },
  { id: 'retired', label: 'Retired' },
] as const

export default function AccessoryListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const typeParam = searchParams.get('type')
  const activeSubtype = ACCESSORY_SUBTYPES.some((meta) => meta.subtype === typeParam)
    ? (typeParam as AccessorySubtype)
    : 'artifact'
  const subtypeMeta =
    ACCESSORY_SUBTYPES.find((meta) => meta.subtype === activeSubtype) ?? ACCESSORY_SUBTYPES[0]
  const [inputValue, setInputValue] = useState(searchParams.get('q') ?? '')
  const debouncedQuery = useDebounce(inputValue, 300)
  const elementParam = searchParams.get('element')
  const excludeElementParam = searchParams.get('excludeElement')
  const accessParam = searchParams.get('access')
  const excludeAccessParam = searchParams.get('excludeAccess')
  const categoryParam = searchParams.get('category')
  const excludeCategoryParam = searchParams.get('excludeCategory')
  const categoryAvailability = useAccessoryCategoryAvailability(activeSubtype)
  const showArmorCustomizationFilter =
    !categoryAvailability.loading && categoryAvailability.hasArmorCustomization
  const showCosmeticFilter = !categoryAvailability.loading && categoryAvailability.hasCosmetic
  const { elements } = elementsData as ElementsData
  const visibleElements = useMemo(
    () => filterElementOptionsByAvailability(elements, categoryAvailability),
    [categoryAvailability, elements]
  )
  const visibleElementIds = useMemo(
    () => new Set(visibleElements.map((element) => element.code)),
    [visibleElements]
  )
  const visibleAccessOptions = useMemo(
    () => filterAccessOptionsByAvailability(ACCESS_OPTIONS, categoryAvailability),
    [categoryAvailability]
  )
  const visibleAccessIds = useMemo(
    () => new Set(visibleAccessOptions.map((option) => option.id)),
    [visibleAccessOptions]
  )
  const visibleCategoryOptions = useMemo(
    () =>
      filterCategoryOptionsByAvailability(CATEGORY_OPTIONS, categoryAvailability, (option) => {
        if (option.id === 'armor-customization') return showArmorCustomizationFilter
        if (option.id === 'cosmetic') return showCosmeticFilter
        return true
      }),
    [categoryAvailability, showArmorCustomizationFilter, showCosmeticFilter]
  )
  const visibleCategoryIds = useMemo(
    () => new Set(visibleCategoryOptions.map((option) => option.id)),
    [visibleCategoryOptions]
  )
  const rawActiveElements = useMemo(
    () => (elementParam ? elementParam.split(',').filter(Boolean) : []),
    [elementParam]
  )
  const rawExcludedElements = useMemo(
    () => (excludeElementParam ? excludeElementParam.split(',').filter(Boolean) : []),
    [excludeElementParam]
  )
  const rawActiveAccess = useMemo(
    () =>
      parseFilterParam(accessParam, (value): value is (typeof ACCESS_OPTIONS)[number]['id'] =>
        ACCESS_OPTIONS.some((option) => option.id === value)
      ),
    [accessParam]
  )
  const rawExcludedAccess = useMemo(
    () =>
      parseFilterParam(
        excludeAccessParam,
        (value): value is (typeof ACCESS_OPTIONS)[number]['id'] =>
          ACCESS_OPTIONS.some((option) => option.id === value)
      ),
    [excludeAccessParam]
  )
  const rawActiveCategories = useMemo(
    () =>
      parseFilterParam(categoryParam, (value): value is (typeof CATEGORY_OPTIONS)[number]['id'] =>
        CATEGORY_OPTIONS.some((option) => option.id === value)
      ),
    [categoryParam]
  )
  const rawExcludedCategories = useMemo(
    () =>
      parseFilterParam(
        excludeCategoryParam,
        (value): value is (typeof CATEGORY_OPTIONS)[number]['id'] =>
          CATEGORY_OPTIONS.some((option) => option.id === value)
      ),
    [excludeCategoryParam]
  )
  const activeElements = useMemo(
    () => (elementParam ? elementParam.split(',').filter((code) => visibleElementIds.has(code)) : []),
    [elementParam, visibleElementIds]
  )
  const excludedElements = useMemo(
    () =>
      excludeElementParam
        ? excludeElementParam.split(',').filter((code) => visibleElementIds.has(code))
        : [],
    [excludeElementParam, visibleElementIds]
  )
  const activeAccess = useMemo(
    () => rawActiveAccess.filter((value) => visibleAccessIds.has(value)),
    [rawActiveAccess, visibleAccessIds]
  )
  const excludedAccess = useMemo(
    () => rawExcludedAccess.filter((value) => visibleAccessIds.has(value)),
    [rawExcludedAccess, visibleAccessIds]
  )
  const activeCategories = useMemo(
    () =>
      rawActiveCategories
        .filter((value) => visibleCategoryIds.has(value))
        .filter((value) => value !== 'cosmetic' || showCosmeticFilter)
        .filter((value) => value !== 'armor-customization' || showArmorCustomizationFilter),
    [rawActiveCategories, showArmorCustomizationFilter, showCosmeticFilter, visibleCategoryIds]
  )
  const excludedCategories = useMemo(
    () =>
      rawExcludedCategories
        .filter((value) => visibleCategoryIds.has(value))
        .filter((value) => value !== 'cosmetic' || showCosmeticFilter)
        .filter((value) => value !== 'armor-customization' || showArmorCustomizationFilter),
    [rawExcludedCategories, showArmorCustomizationFilter, showCosmeticFilter, visibleCategoryIds]
  )
  const { bySubtype, loading: countsLoading } = useAccessoryCounts()

  const canonicalQueryString = useMemo(() => {
    const params = new URLSearchParams()
    params.set('type', activeSubtype)
    if (debouncedQuery) params.set('q', debouncedQuery)
    if (rawActiveElements.length > 0) params.set('element', rawActiveElements.join(','))
    if (rawExcludedElements.length > 0) params.set('excludeElement', rawExcludedElements.join(','))
    if (rawActiveAccess.length > 0) params.set('access', rawActiveAccess.join(','))
    if (rawExcludedAccess.length > 0) params.set('excludeAccess', rawExcludedAccess.join(','))
    if (rawActiveCategories.length > 0) params.set('category', rawActiveCategories.join(','))
    if (rawExcludedCategories.length > 0) {
      params.set('excludeCategory', rawExcludedCategories.join(','))
    }
    return params.toString()
  }, [
    activeSubtype,
    debouncedQuery,
    rawActiveElements,
    rawExcludedElements,
    rawActiveAccess,
    rawExcludedAccess,
    rawActiveCategories,
    rawExcludedCategories,
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

  const { accessories, total, loading } = useAccessories(activeSubtype, filters)

  function setParams(next: Record<string, string>) {
    setSearchParams(next, { replace: true })
  }

  function baseParams(): Record<string, string> {
    const params: Record<string, string> = { type: activeSubtype }
    if (debouncedQuery) params.q = debouncedQuery
    if (rawActiveElements.length > 0) params.element = rawActiveElements.join(',')
    if (rawExcludedElements.length > 0) params.excludeElement = rawExcludedElements.join(',')
    if (rawActiveAccess.length > 0) params.access = rawActiveAccess.join(',')
    if (rawExcludedAccess.length > 0) params.excludeAccess = rawExcludedAccess.join(',')
    if (rawActiveCategories.length > 0) params.category = rawActiveCategories.join(',')
    if (rawExcludedCategories.length > 0) params.excludeCategory = rawExcludedCategories.join(',')
    return params
  }

  function toggleAccess(id: (typeof ACCESS_OPTIONS)[number]['id']) {
    const next = cycleTriState(id, { include: rawActiveAccess, exclude: rawExcludedAccess })
    const params = baseParams()
    delete params.access
    delete params.excludeAccess
    if (next.include.length > 0) params.access = next.include.join(',')
    if (next.exclude.length > 0) params.excludeAccess = next.exclude.join(',')
    setParams(params)
  }

  function toggleCategory(id: (typeof CATEGORY_OPTIONS)[number]['id']) {
    const next = cycleTriState(id, {
      include: rawActiveCategories,
      exclude: rawExcludedCategories,
    })
    const params = baseParams()
    delete params.category
    delete params.excludeCategory
    if (next.include.length > 0) params.category = next.include.join(',')
    if (next.exclude.length > 0) params.excludeCategory = next.exclude.join(',')
    setParams(params)
  }

  function toggleElement(code: string) {
    const next = cycleTriState(code, { include: rawActiveElements, exclude: rawExcludedElements })
    const params = baseParams()
    delete params.element
    delete params.excludeElement
    if (next.include.length > 0) params.element = next.include.join(',')
    if (next.exclude.length > 0) params.excludeElement = next.exclude.join(',')
    setParams(params)
  }

  function setSubtype(id: string) {
    if (!ACCESSORY_SUBTYPES.some((meta) => meta.subtype === id)) return
    const params = baseParams()
    params.type = id
    setParams(params)
  }

  const segments = ACCESSORY_SUBTYPES.map((meta) => ({
    id: meta.subtype,
    label: meta.label,
    count: countsLoading ? undefined : (bySubtype[meta.subtype] ?? 0),
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
        {visibleAccessOptions.map((option) => {
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
          {visibleElements.map((element) => {
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

      <AccessoryList accessories={accessories} loading={loading} />
    </main>
  )
}
