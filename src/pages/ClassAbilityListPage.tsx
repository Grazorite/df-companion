import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ClassAbilityList from '../components/classAbilities/ClassAbilityList'
import SearchBar from '../components/shared/SearchBar'
import SegmentToggle from '../components/shared/SegmentToggle'
import TriStateFilterPill from '../components/shared/TriStateFilterPill'
import MobileFilterPanel from '../components/shared/MobileFilterPanel'
import ResultsStatus from '../components/shared/ResultsStatus'
import {
  useClassAbilities,
  useClassAbilityAvailability,
  useClassAbilityCounts,
} from '../hooks/useClassAbilities'
import { useDebounce } from '../hooks/useDebounce'
import {
  CLASS_ABILITY_SUBTYPES,
  CLASS_SUBCATEGORIES,
  type ClassAbilitySubtype,
  type ClassSubcategory,
} from '../types/classAbility'
import {
  filterAccessOptionsByAvailability,
  filterCategoryOptionsByAvailability,
} from '../utils/filterVisibility'
import { CONSUMABLE_KIND_META, consumableKindPillClass } from '../utils/classAbilityPills'
import { cycleTriState, getTriState, parseFilterParam } from '../utils/triStateFilters'

const ACCESS_OPTIONS = [
  { id: 'multiple', label: 'Multiple Versions' },
  { id: 'da', label: 'DA Required' },
  { id: 'merge', label: 'Merge Required' },
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

const MISC_OPTIONS = [{ id: 'special-character', label: 'Special Character' }] as const

const CONSUMABLE_KIND_OPTIONS = [
  { id: 'dust', label: CONSUMABLE_KIND_META.dust.label },
  { id: 'food', label: CONSUMABLE_KIND_META.food.label },
  { id: 'rune', label: CONSUMABLE_KIND_META.rune.label },
] as const

export default function ClassAbilityListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const typeParam = searchParams.get('type')
  const activeSubtype = CLASS_ABILITY_SUBTYPES.some((meta) => meta.subtype === typeParam)
    ? (typeParam as ClassAbilitySubtype)
    : 'class'
  const subtypeMeta =
    CLASS_ABILITY_SUBTYPES.find((meta) => meta.subtype === activeSubtype) ??
    CLASS_ABILITY_SUBTYPES[0]
  const [inputValue, setInputValue] = useState(searchParams.get('q') ?? '')
  const deferredQuery = useDeferredValue(inputValue)
  const debouncedQuery = useDebounce(inputValue, 300)
  const availability = useClassAbilityAvailability(activeSubtype)
  const accessParam = searchParams.get('access')
  const excludeAccessParam = searchParams.get('excludeAccess')
  const categoryParam = searchParams.get('category')
  const excludeCategoryParam = searchParams.get('excludeCategory')
  const subcategoryParam = searchParams.get('subcategory')
  const excludeSubcategoryParam = searchParams.get('excludeSubcategory')
  const miscParam = searchParams.get('misc')
  const excludeMiscParam = searchParams.get('excludeMisc')
  const kindParam = searchParams.get('kind')
  const excludeKindParam = searchParams.get('excludeKind')
  const { bySubtype, loading: countsLoading } = useClassAbilityCounts()

  const visibleAccessOptions = useMemo(
    () => filterAccessOptionsByAvailability(ACCESS_OPTIONS, availability),
    [availability]
  )
  const visibleAccessIds = useMemo(
    () => new Set(visibleAccessOptions.map((option) => option.id)),
    [visibleAccessOptions]
  )
  const visibleCategoryOptions = useMemo(
    () => filterCategoryOptionsByAvailability(CATEGORY_OPTIONS, availability),
    [availability]
  )
  const visibleCategoryIds = useMemo(
    () => new Set(visibleCategoryOptions.map((option) => option.id)),
    [visibleCategoryOptions]
  )
  const visibleSubcategoryOptions = useMemo(
    () =>
      activeSubtype === 'class'
        ? CLASS_SUBCATEGORIES.filter((option) => availability.classSubcategories.has(option.id))
        : [],
    [activeSubtype, availability]
  )
  const visibleSubcategoryIds = useMemo(
    () => new Set(visibleSubcategoryOptions.map((option) => option.id)),
    [visibleSubcategoryOptions]
  )
  const visibleMiscOptions = useMemo(
    () =>
      activeSubtype === 'class'
        ? MISC_OPTIONS.filter((option) => availability.misc.has(option.id))
        : [],
    [activeSubtype, availability]
  )
  const visibleMiscIds = useMemo(
    () => new Set(visibleMiscOptions.map((option) => option.id)),
    [visibleMiscOptions]
  )
  const visibleKindOptions = useMemo(
    () =>
      activeSubtype === 'consumable'
        ? CONSUMABLE_KIND_OPTIONS.filter((option) => availability.consumableKinds.has(option.id))
        : [],
    [activeSubtype, availability]
  )
  const visibleKindIds = useMemo(
    () => new Set(visibleKindOptions.map((option) => option.id)),
    [visibleKindOptions]
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
  const rawActiveSubcategories = useMemo(
    () =>
      parseFilterParam(subcategoryParam, (value): value is ClassSubcategory =>
        CLASS_SUBCATEGORIES.some((option) => option.id === value)
      ),
    [subcategoryParam]
  )
  const rawExcludedSubcategories = useMemo(
    () =>
      parseFilterParam(excludeSubcategoryParam, (value): value is ClassSubcategory =>
        CLASS_SUBCATEGORIES.some((option) => option.id === value)
      ),
    [excludeSubcategoryParam]
  )
  const rawActiveMisc = useMemo(
    () =>
      parseFilterParam(miscParam, (value): value is (typeof MISC_OPTIONS)[number]['id'] =>
        MISC_OPTIONS.some((option) => option.id === value)
      ),
    [miscParam]
  )
  const rawExcludedMisc = useMemo(
    () =>
      parseFilterParam(excludeMiscParam, (value): value is (typeof MISC_OPTIONS)[number]['id'] =>
        MISC_OPTIONS.some((option) => option.id === value)
      ),
    [excludeMiscParam]
  )
  const rawActiveKinds = useMemo(
    () =>
      parseFilterParam(
        kindParam,
        (value): value is (typeof CONSUMABLE_KIND_OPTIONS)[number]['id'] =>
          CONSUMABLE_KIND_OPTIONS.some((option) => option.id === value)
      ),
    [kindParam]
  )
  const rawExcludedKinds = useMemo(
    () =>
      parseFilterParam(
        excludeKindParam,
        (value): value is (typeof CONSUMABLE_KIND_OPTIONS)[number]['id'] =>
          CONSUMABLE_KIND_OPTIONS.some((option) => option.id === value)
      ),
    [excludeKindParam]
  )

  const activeAccess = rawActiveAccess.filter((value) => visibleAccessIds.has(value))
  const excludedAccess = rawExcludedAccess.filter((value) => visibleAccessIds.has(value))
  const activeCategories = rawActiveCategories.filter((value) => visibleCategoryIds.has(value))
  const excludedCategories = rawExcludedCategories.filter((value) => visibleCategoryIds.has(value))
  const activeSubcategories = rawActiveSubcategories.filter((value) =>
    visibleSubcategoryIds.has(value)
  )
  const excludedSubcategories = rawExcludedSubcategories.filter((value) =>
    visibleSubcategoryIds.has(value)
  )
  const activeMisc = rawActiveMisc.filter((value) => visibleMiscIds.has(value))
  const excludedMisc = rawExcludedMisc.filter((value) => visibleMiscIds.has(value))
  const activeKinds = rawActiveKinds.filter((value) => visibleKindIds.has(value))
  const excludedKinds = rawExcludedKinds.filter((value) => visibleKindIds.has(value))

  useEffect(() => {
    if ((searchParams.get('q') ?? '') === debouncedQuery) return
    const params = new URLSearchParams(searchParams)
    if (debouncedQuery) params.set('q', debouncedQuery)
    else params.delete('q')
    setSearchParams(params, { replace: true })
  }, [debouncedQuery, searchParams, setSearchParams])

  const filters = useMemo(
    () => ({
      query: deferredQuery || undefined,
      classSubcategories: activeSubcategories.length > 0 ? activeSubcategories : undefined,
      excludeClassSubcategories:
        excludedSubcategories.length > 0 ? excludedSubcategories : undefined,
      access: activeAccess.length > 0 ? activeAccess : undefined,
      excludeAccess: excludedAccess.length > 0 ? excludedAccess : undefined,
      categories: activeCategories.length > 0 ? activeCategories : undefined,
      excludeCategories: excludedCategories.length > 0 ? excludedCategories : undefined,
      misc: activeMisc.length > 0 ? activeMisc : undefined,
      excludeMisc: excludedMisc.length > 0 ? excludedMisc : undefined,
      consumableKinds: activeKinds.length > 0 ? activeKinds : undefined,
      excludeConsumableKinds: excludedKinds.length > 0 ? excludedKinds : undefined,
    }),
    [
      activeAccess,
      activeCategories,
      activeKinds,
      activeMisc,
      activeSubcategories,
      deferredQuery,
      excludedAccess,
      excludedCategories,
      excludedKinds,
      excludedMisc,
      excludedSubcategories,
    ]
  )
  const { entries, total, loading, error, retry } = useClassAbilities(activeSubtype, filters)

  function baseParams(): Record<string, string> {
    const params: Record<string, string> = { type: activeSubtype }
    if (debouncedQuery) params.q = debouncedQuery
    if (rawActiveSubcategories.length > 0) params.subcategory = rawActiveSubcategories.join(',')
    if (rawExcludedSubcategories.length > 0) {
      params.excludeSubcategory = rawExcludedSubcategories.join(',')
    }
    if (rawActiveAccess.length > 0) params.access = rawActiveAccess.join(',')
    if (rawExcludedAccess.length > 0) params.excludeAccess = rawExcludedAccess.join(',')
    if (rawActiveCategories.length > 0) params.category = rawActiveCategories.join(',')
    if (rawExcludedCategories.length > 0) params.excludeCategory = rawExcludedCategories.join(',')
    if (rawActiveMisc.length > 0) params.misc = rawActiveMisc.join(',')
    if (rawExcludedMisc.length > 0) params.excludeMisc = rawExcludedMisc.join(',')
    if (rawActiveKinds.length > 0) params.kind = rawActiveKinds.join(',')
    if (rawExcludedKinds.length > 0) params.excludeKind = rawExcludedKinds.join(',')
    return params
  }

  function setParams(params: Record<string, string>) {
    setSearchParams(params, { replace: true })
  }

  function setSubtype(id: string) {
    if (!CLASS_ABILITY_SUBTYPES.some((meta) => meta.subtype === id)) return
    const params = baseParams()
    params.type = id
    setParams(params)
  }

  function toggleListParam(
    key: string,
    excludeKey: string,
    id: string,
    include: string[],
    exclude: string[]
  ) {
    const next = cycleTriState(id, { include, exclude })
    const params = baseParams()
    delete params[key]
    delete params[excludeKey]
    if (next.include.length > 0) params[key] = next.include.join(',')
    if (next.exclude.length > 0) params[excludeKey] = next.exclude.join(',')
    setParams(params)
  }

  function clearListParam(key: string, excludeKey: string) {
    const params = baseParams()
    delete params[key]
    delete params[excludeKey]
    setParams(params)
  }

  const segments = CLASS_ABILITY_SUBTYPES.map((meta) => ({
    id: meta.subtype,
    label: meta.label,
    count: countsLoading ? undefined : (bySubtype[meta.subtype] ?? 0),
    active: meta.subtype === activeSubtype,
  }))

  return (
    <main className="px-4 sm:px-6 py-6 max-w-5xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gold mb-1">Classes / Abilities</h1>
        <p className="text-text-secondary text-sm">{subtypeMeta.shortDescription}</p>
        {activeSubtype === 'consumable' && (
          <p className="mt-2 text-xs text-text-muted">
            Consumables are Temp by default, except Health Potion and Mana Potion.
          </p>
        )}
      </div>

      <div className="mb-4">
        <SegmentToggle segments={segments} onToggle={setSubtype} />
      </div>

      <div className="mb-4">
        <SearchBar
          value={inputValue}
          onChange={setInputValue}
          onClear={() => setInputValue('')}
          placeholder={`Search ${subtypeMeta.label.toLowerCase()} by name, source, or notes...`}
        />
      </div>

      <MobileFilterPanel>
        {visibleSubcategoryOptions.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-3" role="group" aria-label="Filter by class type">
            {visibleSubcategoryOptions.map((option) => (
              <TriStateFilterPill
                key={option.id}
                label={option.label}
                state={getTriState(option.id, {
                  include: activeSubcategories,
                  exclude: excludedSubcategories,
                })}
                onClick={() =>
                  toggleListParam(
                    'subcategory',
                    'excludeSubcategory',
                    option.id,
                    rawActiveSubcategories,
                    rawExcludedSubcategories
                  )
                }
                size="segment"
              />
            ))}
            {(activeSubcategories.length > 0 || excludedSubcategories.length > 0) && (
              <button
                onClick={() => clearListParam('subcategory', 'excludeSubcategory')}
                className="text-[11px] text-text-muted hover:text-text-primary underline underline-offset-2 ml-1"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        <div className="flex gap-2 flex-wrap mb-3" role="group" aria-label="Filter by access">
          {visibleAccessOptions.map((option) => (
            <TriStateFilterPill
              key={option.id}
              label={option.label}
              state={getTriState(option.id, { include: activeAccess, exclude: excludedAccess })}
              onClick={() =>
                toggleListParam(
                  'access',
                  'excludeAccess',
                  option.id,
                  rawActiveAccess,
                  rawExcludedAccess
                )
              }
              size="access"
            />
          ))}
          {(activeAccess.length > 0 || excludedAccess.length > 0) && (
            <button
              onClick={() => clearListParam('access', 'excludeAccess')}
              className="text-[11px] text-text-muted hover:text-text-primary underline underline-offset-2 ml-1"
            >
              Clear filters
            </button>
          )}
        </div>

        {(visibleCategoryOptions.length > 0 || visibleMiscOptions.length > 0) && (
          <div className="mb-3">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
              {visibleCategoryOptions.map((option) => (
                <TriStateFilterPill
                  key={option.id}
                  label={option.label}
                  state={getTriState(option.id, {
                    include: activeCategories,
                    exclude: excludedCategories,
                  })}
                  onClick={() =>
                    toggleListParam(
                      'category',
                      'excludeCategory',
                      option.id,
                      rawActiveCategories,
                      rawExcludedCategories
                    )
                  }
                  size="category"
                  activeClassName="bg-orange-500/80 text-white"
                />
              ))}
              {visibleMiscOptions.map((option) => (
                <TriStateFilterPill
                  key={option.id}
                  label={option.label}
                  state={getTriState(option.id, { include: activeMisc, exclude: excludedMisc })}
                  onClick={() =>
                    toggleListParam(
                      'misc',
                      'excludeMisc',
                      option.id,
                      rawActiveMisc,
                      rawExcludedMisc
                    )
                  }
                  size="category"
                />
              ))}
              {(activeCategories.length > 0 ||
                excludedCategories.length > 0 ||
                activeMisc.length > 0 ||
                excludedMisc.length > 0) && (
                <button
                  onClick={() => {
                    const params = baseParams()
                    delete params.category
                    delete params.excludeCategory
                    delete params.misc
                    delete params.excludeMisc
                    setParams(params)
                  }}
                  className="text-[11px] text-text-muted hover:text-text-primary underline underline-offset-2 ml-1"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        )}

        {visibleKindOptions.length > 0 && (
          <div className="mb-3">
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Filter by consumable kind"
            >
              {visibleKindOptions.map((option) => (
                <TriStateFilterPill
                  key={option.id}
                  label={option.label}
                  state={getTriState(option.id, { include: activeKinds, exclude: excludedKinds })}
                  onClick={() =>
                    toggleListParam(
                      'kind',
                      'excludeKind',
                      option.id,
                      rawActiveKinds,
                      rawExcludedKinds
                    )
                  }
                  size="element"
                  elementClassName={`${consumableKindPillClass(option.id)} ring-2 ring-gold`}
                  inactiveClassName={`${consumableKindPillClass(option.id)} opacity-60 hover:opacity-100`}
                />
              ))}
              {(activeKinds.length > 0 || excludedKinds.length > 0) && (
                <button
                  onClick={() => clearListParam('kind', 'excludeKind')}
                  className="text-[10px] text-text-muted hover:text-text-primary underline underline-offset-2 ml-1"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        )}
      </MobileFilterPanel>

      <ResultsStatus
        announcement={
          error
            ? 'Results unavailable'
            : loading
              ? 'Loading entries...'
              : `${total} ${total === 1 ? 'entry' : 'entries'} found`
        }
      />

      <ClassAbilityList
        items={entries}
        loading={loading}
        error={error}
        onRetry={retry}
        pending={inputValue !== deferredQuery}
      />
    </main>
  )
}
