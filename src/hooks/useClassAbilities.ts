import { useEffect, useMemo, useState } from 'react'
import type {
  ClassAbilityEntry,
  ClassAbilityFilters,
  ClassAbilitySubtype,
  ConsumableKind,
} from '../types/classAbility'
import { isClassAbilityFamily } from '../types/classAbility'
import type { AlsoSeeRef, ObtainVariant } from '../types/item'
import {
  loadClassAbilitiesBySubtype,
  loadClassAbilitiesForSubtype,
  loadClassAbilitiesManifest,
} from '../utils/dataLoaders'
import { compareTitles, displayTitle } from '../utils/displayText'
import { hasRetiredEntry } from '../utils/filterVisibility'
import { obtainMethodInferenceFingerprint } from '../utils/relatedItems'
import { getSearchWords } from '../utils/search'
import { getClassArmorAlsoSeeRefs } from './useClassArmorRelations'
import { useRelatedItems, type RelatedItemResult } from './useRelatedItems'

function useClassAbilitySubtypeDataset(subtype: ClassAbilitySubtype) {
  const [entries, setEntries] = useState<ClassAbilityEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    loadClassAbilitiesForSubtype(subtype)
      .then((data) => {
        if (!active) return
        setEntries(data)
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setEntries([])
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [subtype])

  return { entries, loading }
}

function hasMeaningfulEffect(effect: string | undefined): boolean {
  return Boolean(effect && !/^(?:none|n\/?a)$/i.test(effect.trim()))
}

function entryHasKind(entry: ClassAbilityEntry, kind: ConsumableKind): boolean {
  return isClassAbilityFamily(entry)
    ? entry.consumableKind === kind ||
        entry.levelVariants.some((variant) => variant.classAbilitySubtype === kind)
    : entry.consumableKind === kind
}

function searchClassAbilities(
  entries: ClassAbilityEntry[],
  subtype: ClassAbilitySubtype,
  filters: ClassAbilityFilters
) {
  const queryWords = getSearchWords(filters.query ?? '')

  return entries
    .filter((entry) => {
      if (entry.subtype !== subtype) return false
      const isFamily = isClassAbilityFamily(entry)

      const hasClassSubcategory = (subcategory: NonNullable<
        ClassAbilityFilters['classSubcategories']
      >[number]) =>
        entry.classSubcategory === subcategory || entry.classSubcategories?.includes(subcategory)
      if (
        filters.classSubcategories &&
        filters.classSubcategories.length > 0 &&
        !filters.classSubcategories.some((subcategory) => hasClassSubcategory(subcategory))
      ) {
        return false
      }
      if (
        filters.excludeClassSubcategories?.some((subcategory) =>
          hasClassSubcategory(subcategory)
        )
      ) {
        return false
      }

      const hasAccess = (flag: NonNullable<ClassAbilityFilters['access']>[number]) => {
        if (flag === 'multiple') return isFamily && entry.levelVariants.length > 1
        if (flag === 'da') return isFamily ? entry.hasDA : entry.daRequired === true
        if (flag === 'dc') return isFamily ? entry.hasDC : entry.dcRequired === true
        if (flag === 'dm') return isFamily ? entry.hasDM : entry.dmRequired === true
        if (flag === 'merge') return isFamily ? entry.hasMerge : entry.hasMerge === true
        return false
      }
      if (filters.access?.some((flag) => !hasAccess(flag))) return false
      if (filters.excludeAccess?.some((flag) => hasAccess(flag))) return false

      const itemRetired = entry.retired === true
      const hasCategory = (category: NonNullable<ClassAbilityFilters['categories']>[number]) => {
        if (category === 'temp') return entry.isTemp === true
        if (category === 'rare') return entry.isRare === true
        if (category === 'seasonal') return entry.isSeasonal === true
        if (category === 'special-offer') return entry.isSpecialOffer === true
        if (category === 'retired') return itemRetired
        return false
      }
      if (filters.excludeCategories?.some((category) => hasCategory(category))) return false
      if (filters.categories && filters.categories.length > 0) {
        const matchesCategory = filters.categories.some((category) => hasCategory(category))
        if (filters.categories.includes('retired')) {
          if (!itemRetired) return false
        } else if (!matchesCategory || itemRetired) {
          return false
        }
      } else if (itemRetired) {
        return false
      }

      const hasMisc = (flag: NonNullable<ClassAbilityFilters['misc']>[number]) => {
        if (flag === 'special-character') {
          return isFamily ? entry.tags.includes('special-character') : entry.isSpecialCharacter === true
        }
        return false
      }
      if (filters.misc?.some((flag) => !hasMisc(flag))) return false
      if (filters.excludeMisc?.some((flag) => hasMisc(flag))) return false

      if (
        filters.consumableKinds &&
        filters.consumableKinds.length > 0 &&
        !filters.consumableKinds.some((kind) => entryHasKind(entry, kind))
      ) {
        return false
      }
      if (filters.excludeConsumableKinds?.some((kind) => entryHasKind(entry, kind))) return false

      if (queryWords.length > 0) {
        const searchableText = [
          isFamily ? entry.familyName : entry.name,
          displayTitle(isFamily ? entry.familyName : entry.name),
          isFamily ? entry.shared.description : entry.description,
          isFamily ? entry.shared.effect : entry.effect,
          isFamily ? entry.shared.effectType : entry.effectType,
          isFamily ? entry.shared.equipsClass : entry.equipsClass,
          isFamily ? entry.shared.dialogue : entry.dialogue,
          isFamily ? entry.shared.notes : entry.notes,
          ...(isFamily ? entry.levelVariants.map((variant) => variant.name) : []),
          ...(isFamily ? entry.levelVariants.map((variant) => variant.description) : []),
          ...(isFamily ? entry.levelVariants.map((variant) => variant.effect) : []),
          ...(isFamily ? entry.levelVariants.map((variant) => variant.effectType) : []),
          ...(isFamily ? entry.levelVariants.map((variant) => variant.equipsClass) : []),
          ...(isFamily ? entry.levelVariants.map((variant) => variant.dialogue) : []),
          ...(isFamily ? entry.levelVariants.map((variant) => variant.rarity) : [entry.rarity]),
          ...(isFamily
            ? entry.levelVariants.flatMap((variant) =>
                variant.obtainVariants.map((obtain) => obtain.location)
              )
            : (entry.obtainMethods ?? []).map((obtain) => obtain.location)),
          ...(isFamily ? entry.levelVariants.map((variant) => variant.notes) : [entry.notes]),
          ...entry.tags,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        const contentWords = getSearchWords(searchableText)
        if (!queryWords.every((word) => contentWords.some((text) => text.startsWith(word)))) {
          return false
        }
      }

      return true
    })
    .sort((a, b) =>
      compareTitles(
        isClassAbilityFamily(a) ? a.familyName : a.name,
        isClassAbilityFamily(b) ? b.familyName : b.name
      )
    )
}

export function useClassAbilities(
  subtype: ClassAbilitySubtype,
  filters: ClassAbilityFilters = {}
) {
  const { entries: subtypeEntries, loading } = useClassAbilitySubtypeDataset(subtype)
  const entries = useMemo(
    () => searchClassAbilities(subtypeEntries, subtype, filters),
    [filters, subtype, subtypeEntries]
  )
  return { entries, total: entries.length, loading }
}

export function useClassAbilityBySlug(subtype: ClassAbilitySubtype, slug: string) {
  const { entries, loading } = useClassAbilitySubtypeDataset(subtype)
  const item = useMemo(() => {
    if (loading) return undefined
    return (
      entries.find(
        (entry) =>
          entry.slug === slug ||
          entry.aliasSlugs?.includes(slug)
      ) ?? null
    )
  }, [entries, loading, slug])
  return { item, loading }
}

function getClassAbilitySlugs(entry: ClassAbilityEntry): string[] {
  return [entry.slug, ...(entry.aliasSlugs ?? [])]
}

function getClassAbilityAlsoSeeRefs(entry: ClassAbilityEntry): AlsoSeeRef[] {
  return [
    ...(isClassAbilityFamily(entry) ? (entry.shared.alsoSee ?? []) : (entry.alsoSee ?? [])),
    ...getClassArmorAlsoSeeRefs(entry.slug),
  ]
}

function getClassAbilitySourceUrls(entry: ClassAbilityEntry): string[] {
  const urls = isClassAbilityFamily(entry)
    ? [
        entry.forumUrl,
        ...(entry.familySources ?? []).map((source) => source.url),
        ...entry.levelVariants.map((variant) => variant.sourceUrl),
      ]
    : [entry.forumUrl, entry.sourceUrl]
  return urls.filter((url): url is string => Boolean(url))
}

function getClassAbilityObtainMethods(entry: ClassAbilityEntry): ObtainVariant[] {
  return isClassAbilityFamily(entry)
    ? entry.levelVariants.flatMap((variant) => variant.obtainVariants)
    : (entry.obtainMethods ?? [])
}

function relaxedConsumableLocation(location: string): string {
  const parts = location
    .split(/\s*->\s*/)
    .map((part) => part.trim())
    .filter(Boolean)

  while (
    parts.length > 1 &&
    /^(?:yes|buy|select\b.*\boption|take\b|drink\?|open jar)$/i.test(parts[parts.length - 1])
  ) {
    parts.pop()
  }

  if (parts.length > 2) {
    const last = parts[parts.length - 1]
    if (
      /(?:\+|zard|fruit|stardust|rice|soup|cake|fish|water|juice|cider|potion|legs?|burgers?|kebobs?|tartare)/i.test(
        last
      )
    ) {
      parts.pop()
    }
  }

  return parts.join(' -> ').toLowerCase().replace(/\s+/g, ' ').trim()
}

function consumableObtainFingerprint(method: ObtainVariant): string {
  return [
    relaxedConsumableLocation(method.location),
    method.priceType,
    (method.requiredItems ?? '').toLowerCase().replace(/\s+/g, ' ').trim(),
    (method.requirements ?? '').toLowerCase().replace(/\s+/g, ' ').trim(),
  ].join('|')
}

function getClassAbilityObtainFingerprints(entry: ClassAbilityEntry): Set<string> {
  if (entry.subtype === 'consumable') {
    return new Set(getClassAbilityObtainMethods(entry).map(consumableObtainFingerprint))
  }
  return new Set(getClassAbilityObtainMethods(entry).map(obtainMethodInferenceFingerprint))
}

function classAbilityMatchesSlug(entry: ClassAbilityEntry, slug: string) {
  return getClassAbilitySlugs(entry).includes(slug)
}

function normalizeForumSourceUrl(url?: string): string | undefined {
  const messageId = url?.match(/[?&]m=(\d+)/i)?.[1]
  return messageId ? `https://forums2.battleon.com/f/fb.asp?m=${messageId}` : url
}

function classAbilityMatchesRef(entry: ClassAbilityEntry, ref: AlsoSeeRef): boolean {
  if (classAbilityMatchesSlug(entry, ref.slug)) return true
  if (!ref.url) return false

  const refUrl = normalizeForumSourceUrl(ref.url)
  return getClassAbilitySourceUrls(entry).some((url) => normalizeForumSourceUrl(url) === refUrl)
}

function refTargetsClassAbility(
  ref: AlsoSeeRef,
  _item: ClassAbilityEntry,
  currentSlugs: Set<string>,
  currentSourceUrls: Set<string>
): boolean {
  if (currentSlugs.has(ref.slug)) return true
  if (!ref.url) return false
  return currentSourceUrls.has(normalizeForumSourceUrl(ref.url) ?? ref.url)
}

export type ClassAbilityRelatedItem = RelatedItemResult<ClassAbilityEntry, AlsoSeeRef>

export function useClassAbilityRelatedItems(item: ClassAbilityEntry) {
  const currentSourceUrls = new Set(
    getClassAbilitySourceUrls(item).map((url) => normalizeForumSourceUrl(url) ?? url)
  )
  const { relatedItems, loading } = useRelatedItems({
    item,
    alsoSee: getClassAbilityAlsoSeeRefs(item),
    loadAll: loadAllClassAbilities,
    getSlugs: getClassAbilitySlugs,
    getRefs: getClassAbilityAlsoSeeRefs,
    getDisplayName: (entry) => displayTitle(isClassAbilityFamily(entry) ? entry.familyName : entry.name),
    getFingerprints: getClassAbilityObtainFingerprints,
    getScope: (entry) => entry.subtype,
    getSourceUrls: getClassAbilitySourceUrls,
    matchesRef: classAbilityMatchesRef,
    refTargetsItem: (ref, currentItem, currentSlugs) =>
      refTargetsClassAbility(ref, currentItem, currentSlugs, currentSourceUrls),
    dedupeKey: (entry, slug) => `${entry.subtype}:${slug}`,
    inferCandidate: (candidate, currentItem) => candidate.subtype === currentItem.subtype,
    limit: 8,
    nameThreshold: item.subtype === 'consumable' ? 0.13 : 0.55,
  })

  return { relatedClassAbilities: relatedItems, loading }
}

export function useClassAbilityCounts() {
  const [counts, setCounts] = useState<Record<ClassAbilitySubtype, number>>({
    class: 0,
    consumable: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    loadClassAbilitiesManifest()
      .then((manifest) => {
        if (!active) return
        setCounts(manifest.bySubtype)
        setLoading(false)
      })
      .catch(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return {
    bySubtype: counts,
    total: Object.values(counts).reduce((sum, count) => sum + count, 0),
    loading,
  }
}

export function useClassAbilityAvailability(subtype: ClassAbilitySubtype) {
  const { entries, loading } = useClassAbilitySubtypeDataset(subtype)

  return useMemo(
    () => {
      const classSubcategories = new Set<string>()
      const access = new Set<string>()
      const categories = new Set<string>()
      const misc = new Set<string>()
      const consumableKinds = new Set<string>()

      for (const entry of entries) {
        if (isClassAbilityFamily(entry)) {
          if (entry.classSubcategory) classSubcategories.add(entry.classSubcategory)
          entry.classSubcategories?.forEach((subcategory) => classSubcategories.add(subcategory))
          if (entry.consumableKind) consumableKinds.add(entry.consumableKind)
          if (entry.levelVariants.length > 1) access.add('multiple')
          if (entry.hasDA) access.add('da')
          if (entry.hasDC) access.add('dc')
          if (entry.hasDM) access.add('dm')
          if (entry.hasMerge) access.add('merge')
          if (entry.tags.includes('special-character')) misc.add('special-character')
          for (const variant of entry.levelVariants) {
            if (variant.classAbilitySubtype) consumableKinds.add(variant.classAbilitySubtype)
            if (hasMeaningfulEffect(variant.effect)) categories.add('effect')
          }
        } else {
          if (entry.classSubcategory) classSubcategories.add(entry.classSubcategory)
          entry.classSubcategories?.forEach((subcategory) => classSubcategories.add(subcategory))
          if (entry.consumableKind) consumableKinds.add(entry.consumableKind)
          if (entry.daRequired) access.add('da')
          if (entry.dcRequired) access.add('dc')
          if (entry.dmRequired) access.add('dm')
          if (entry.hasMerge) access.add('merge')
          if (entry.isSpecialCharacter) misc.add('special-character')
          if (hasMeaningfulEffect(entry.effect)) categories.add('effect')
        }

        if (entry.isTemp) categories.add('temp')
        if (entry.isRare) categories.add('rare')
        if (entry.isSeasonal) categories.add('seasonal')
        if (entry.isSpecialOffer) categories.add('special-offer')
        if (entry.retired) categories.add('retired')
      }

      return {
        loading,
        classSubcategories,
        access,
        categories,
        misc,
        consumableKinds,
        hasRetired: hasRetiredEntry(entries),
      }
    },
    [entries, loading]
  )
}

export function useTotalClassAbilityCount(): number {
  return useClassAbilityCounts().total
}

export function loadAllClassAbilities() {
  return loadClassAbilitiesBySubtype().then((bySubtype) => Object.values(bySubtype).flat())
}
