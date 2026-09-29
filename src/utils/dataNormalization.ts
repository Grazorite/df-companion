/**
 * Fetch-free dataset normalization shared by the runtime loaders (`dataLoaders.ts`) and the
 * build-time search-index generator (`scripts/generate-search-index.ts`). Keeping these pure
 * functions in one module guarantees the generated compact search index reflects the exact same
 * normalization/dedup the app applies at runtime — no drift, especially for class dedupe.
 *
 * This module must stay free of browser-only concerns (no `fetch`, no `?url` imports) so a Node/tsx
 * script can import it directly.
 */
import type { AccessoryEntry } from '../types/accessory'
import type { ItemFamily, PriceType } from '../types/item'
import type { Pet } from '../types/pet'
import type { WeaponEntry } from '../types/weapon'
import type { HousingEntry } from '../types/housing'
import type { ClassAbilityEntry, ClassSubcategory } from '../types/classAbility'
import {
  computeFamilyFlags,
  isDefenderMedalText,
  isPureDefenderMedalRequirement,
  orderLevelVariantsByAccess,
  splitMixedAccessObtainVariantRows,
} from './variantHelpers'

type RepairableObtainMethod = {
  priceType: PriceType
  price?: string
  requiredItems?: string
  dmRequired?: boolean
  dcRequired?: boolean
}

export function normalizeLoadedPet<T extends Pet & { specialMarkers?: string[] }>(pet: T): Pet {
  const normalized = repairLoadedSingleObtainMethods({ ...pet }) as Pet & { specialMarkers?: string[] }
  if (!normalized.traits && normalized.specialMarkers) {
    normalized.traits = normalized.specialMarkers
    delete normalized.specialMarkers
  }
  if (!normalized.traits) normalized.traits = []
  return normalized as Pet
}

export function isLoadedFamily(
  entry: Pet | ItemFamily | AccessoryEntry | WeaponEntry | HousingEntry | ClassAbilityEntry
): entry is ItemFamily {
  return 'levelVariants' in entry
}

export function normalizeLoadedFamily<T extends ItemFamily>(family: T): T {
  const repairedFamily = {
    ...family,
    levelVariants: family.levelVariants.map((variant) => ({
      ...variant,
      obtainVariants: variant.obtainVariants.map(repairObtainMethodFlags),
    })),
  }
  return computeFamilyFlags(
    splitMixedAccessObtainVariantRows({
      ...repairedFamily,
      levelVariants: orderLevelVariantsByAccess(repairedFamily.levelVariants),
    })
  )
}

export function repairObtainMethodFlags<T extends RepairableObtainMethod>(method: T): T {
  const dmRequired =
    method.priceType === 'dm' ||
    isDefenderMedalText(method.price) ||
    isDefenderMedalText(method.requiredItems)
  const priceType: PriceType =
    method.priceType === 'merge' && isPureDefenderMedalRequirement(method.requiredItems)
      ? 'dm'
      : method.priceType
  return {
    ...method,
    priceType,
    ...(dmRequired ? { dmRequired } : { dmRequired: undefined }),
  } as T
}

export function repairLoadedSingleObtainMethods<T extends { obtainMethods?: RepairableObtainMethod[] }>(
  entry: T
): T {
  if (!entry.obtainMethods) return entry
  const obtainMethods = entry.obtainMethods.map(repairObtainMethodFlags)
  return {
    ...entry,
    obtainMethods,
    dmRequired:
      'dmRequired' in entry
        ? Boolean(entry.dmRequired) || obtainMethods.some((method) => method.dmRequired)
        : undefined,
    dcRequired:
      'dcRequired' in entry
        ? Boolean(entry.dcRequired) || obtainMethods.some((method) => method.priceType === 'dc')
        : undefined,
  } as T
}

function cleanLoadedNotes(notes: string | undefined): string | undefined {
  if (!notes) return undefined
  const cleaned = notes
    .replace(/(?:\n\s*)*<\s*Message edited by[\s\S]*$/i, '')
    .replace(/(?:\n\s*)*•\s*DF\s*$/i, '')
    .replace(/(?:\n\s*)*DF\s*$/i, '')
    .trim()
  return cleaned || undefined
}

function cleanLoadedEffect(effect: string | undefined): string | undefined {
  if (!effect || /^(?:none|n\/?a)$/i.test(effect.trim())) return undefined
  return effect.trim()
}

function isClassAbilityTag(tag: string): boolean {
  return (
    /^(?:da|dc|dm|temp|rare|seasonal|retired|dust|food|rune)$/.test(tag) ||
    /^(?:specialoffer|specialcharacter|alexandersaga|archknight)$/.test(tag) ||
    /^(?:holiday|frostval|mogloween|heroheart|friday13)$/.test(tag)
  )
}

function cleanLoadedClassAbilityTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => tag.toLowerCase()).filter(isClassAbilityTag))].sort()
}

export function normalizeLoadedClassAbility(entry: ClassAbilityEntry): ClassAbilityEntry {
  if (isLoadedFamily(entry)) {
    const normalized = normalizeLoadedFamily(entry)
    let levelVariants = normalized.levelVariants.map((variant) => ({
      ...variant,
      obtainVariants: variant.obtainVariants.map(repairObtainMethodFlags),
      effect: cleanLoadedEffect(variant.effect),
      notes: cleanLoadedNotes(variant.notes),
    }))
    const allMethods = levelVariants.flatMap((variant) => variant.obtainVariants)
    let sharedEffect = cleanLoadedEffect(normalized.shared.effect)
    let sharedNotes = cleanLoadedNotes(normalized.shared.notes)
    const noteIndexes = levelVariants.flatMap((variant, index) => (variant.notes ? [index] : []))
    const sourceUrls = new Set(levelVariants.map((variant) => variant.sourceUrl).filter(Boolean))
    if (
      !sharedNotes &&
      normalized.familyOrigin === 'single-thread' &&
      sourceUrls.size <= 1 &&
      noteIndexes.length === 1 &&
      noteIndexes[0] === levelVariants.length - 1
    ) {
      sharedNotes = levelVariants[noteIndexes[0]].notes
      levelVariants = levelVariants.map((variant, index) =>
        index === noteIndexes[0] ? { ...variant, notes: undefined } : variant
      )
    }
    const effectIndexes = levelVariants.flatMap((variant, index) => (variant.effect ? [index] : []))
    const uniqueEffects = [...new Set(effectIndexes.map((index) => levelVariants[index].effect))]
    if (
      !sharedEffect &&
      uniqueEffects.length === 1 &&
      effectIndexes.length > 0 &&
      (effectIndexes.length === levelVariants.length ||
        (normalized.familyOrigin === 'single-thread' &&
          sourceUrls.size <= 1 &&
          effectIndexes.length === 1 &&
          effectIndexes[0] === levelVariants.length - 1))
    ) {
      sharedEffect = uniqueEffects[0]
      levelVariants = levelVariants.map((variant, index) =>
        effectIndexes.includes(index) ? { ...variant, effect: undefined } : variant
      )
    }
    return {
      ...normalized,
      tags: cleanLoadedClassAbilityTags(normalized.tags),
      shared: {
        ...normalized.shared,
        effect: sharedEffect,
        notes: sharedNotes,
      },
      levelVariants,
      hasDM: normalized.hasDM || allMethods.some((method) => method.dmRequired),
      hasMerge: allMethods.some((method) => method.priceType === 'merge'),
    } as ClassAbilityEntry
  }

  const obtainMethods = (entry.obtainMethods ?? []).map(repairObtainMethodFlags)
  return {
    ...entry,
    tags: cleanLoadedClassAbilityTags(entry.tags),
    obtainMethods,
    effect: cleanLoadedEffect(entry.effect),
    notes: cleanLoadedNotes(entry.notes),
    dmRequired: entry.dmRequired || obtainMethods.some((method) => method.dmRequired),
    hasMerge: obtainMethods.some((method) => method.priceType === 'merge'),
  }
}

function compareClassAbilityDuplicateQuality(
  first: ClassAbilityEntry,
  second: ClassAbilityEntry
): number {
  const firstName = 'familyName' in first ? first.familyName : first.name
  const secondName = 'familyName' in second ? second.familyName : second.name
  const firstPlus = /\+$/.test(firstName.trim())
  const secondPlus = /\+$/.test(secondName.trim())
  if (firstPlus !== secondPlus) return firstPlus ? 1 : -1
  return firstName.length - secondName.length
}

function classSubcategoriesForEntry(entry: ClassAbilityEntry): ClassSubcategory[] {
  return [
    ...new Set(
      [entry.classSubcategory, ...(entry.classSubcategories ?? [])].filter(
        (subcategory): subcategory is ClassSubcategory => Boolean(subcategory)
      )
    ),
  ]
}

function classAbilitySourceDedupeKey(entry: ClassAbilityEntry): string | undefined {
  if (entry.subtype !== 'class' || entry.classSubcategory === 'armor') return undefined
  const sourceUrl = isLoadedFamily(entry)
    ? entry.forumUrl || entry.familySources?.[0]?.url || entry.levelVariants[0]?.sourceUrl
    : entry.sourceUrl || entry.forumUrl
  const messageId = sourceUrl?.match(/[?&]m=(\d+)/i)?.[1]
  return messageId ? `source:${messageId}` : sourceUrl ? `source:${sourceUrl}` : undefined
}

function classEntryHasDA(entry: ClassAbilityEntry): boolean {
  return isLoadedFamily(entry) ? entry.hasDA : Boolean(entry.daRequired)
}

function classEntryHasDC(entry: ClassAbilityEntry): boolean {
  return isLoadedFamily(entry) ? entry.hasDC : Boolean(entry.dcRequired)
}

function classEntryHasDM(entry: ClassAbilityEntry): boolean {
  return isLoadedFamily(entry) ? entry.hasDM : Boolean(entry.dmRequired)
}

function classEntryIsSpecialCharacter(entry: ClassAbilityEntry): boolean {
  return (
    (!isLoadedFamily(entry) && Boolean(entry.isSpecialCharacter)) ||
    entry.tags.includes('special-character')
  )
}

function mergeClassAbilityDuplicates(
  primary: ClassAbilityEntry,
  duplicate: ClassAbilityEntry
): ClassAbilityEntry {
  const classSubcategories = [
    ...new Set([...classSubcategoriesForEntry(primary), ...classSubcategoriesForEntry(duplicate)]),
  ]
  const tags = [...new Set([...primary.tags, ...duplicate.tags])].sort()
  const aliasSlugs = [
    ...new Set([
      ...(isLoadedFamily(primary) ? (primary.aliasSlugs ?? []) : (primary.aliasSlugs ?? [])),
      ...(isLoadedFamily(duplicate) ? (duplicate.aliasSlugs ?? []) : (duplicate.aliasSlugs ?? [])),
      ...(primary.slug !== duplicate.slug ? [duplicate.slug] : []),
    ]),
  ]
  return {
    ...primary,
    ...(aliasSlugs.length > 0 ? { aliasSlugs } : {}),
    classSubcategories,
    tags,
    daRequired: classEntryHasDA(primary) || classEntryHasDA(duplicate) || undefined,
    dcRequired: classEntryHasDC(primary) || classEntryHasDC(duplicate) || undefined,
    dmRequired: classEntryHasDM(primary) || classEntryHasDM(duplicate) || undefined,
    hasFree: Boolean(primary.hasFree) || Boolean(duplicate.hasFree),
    hasMerge: Boolean(primary.hasMerge) || Boolean(duplicate.hasMerge),
    hasDA: classEntryHasDA(primary) || classEntryHasDA(duplicate),
    hasDC: classEntryHasDC(primary) || classEntryHasDC(duplicate),
    hasDM: classEntryHasDM(primary) || classEntryHasDM(duplicate),
    isTemp: Boolean(primary.isTemp) || Boolean(duplicate.isTemp),
    isRare: Boolean(primary.isRare) || Boolean(duplicate.isRare),
    isSeasonal: Boolean(primary.isSeasonal) || Boolean(duplicate.isSeasonal),
    isSpecialOffer: Boolean(primary.isSpecialOffer) || Boolean(duplicate.isSpecialOffer),
    isSpecialCharacter:
      classEntryIsSpecialCharacter(primary) || classEntryIsSpecialCharacter(duplicate) || undefined,
    retired: Boolean(primary.retired) || Boolean(duplicate.retired),
  } as ClassAbilityEntry
}

export function dedupeClassAbilityEntries(entries: ClassAbilityEntry[]): ClassAbilityEntry[] {
  const bySlug = new Map<string, ClassAbilityEntry>()
  const bySource = new Map<string, string>()
  for (const entry of entries) {
    const sourceKey = classAbilitySourceDedupeKey(entry)
    const existingSlug = sourceKey ? bySource.get(sourceKey) : undefined
    const existing = existingSlug ? bySlug.get(existingSlug) : bySlug.get(entry.slug)
    if (!existing || compareClassAbilityDuplicateQuality(entry, existing) < 0) {
      const merged = existing ? mergeClassAbilityDuplicates(entry, existing) : entry
      bySlug.set(entry.slug, merged)
      if (sourceKey) bySource.set(sourceKey, entry.slug)
      if (existing && existing.slug !== entry.slug) bySlug.delete(existing.slug)
    } else if (existing) {
      bySlug.set(existing.slug, mergeClassAbilityDuplicates(existing, entry))
      if (sourceKey) bySource.set(sourceKey, existing.slug)
    } else {
      bySlug.set(entry.slug, entry)
      if (sourceKey) bySource.set(sourceKey, entry.slug)
    }
  }
  return [...bySlug.values()]
}
