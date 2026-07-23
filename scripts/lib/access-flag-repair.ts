import type { Accessory } from '../../src/types/accessory.ts'
import type { Guest, Pet } from '../../src/types/pet.ts'
import type { ItemFamily, ObtainVariant } from '../../src/types/item.ts'
import { obtainVariantHasDC } from '../../src/utils/variantHelpers.ts'

type SingleScrapedEntry = Accessory | Guest | Pet
type ScrapedEntry = SingleScrapedEntry | ItemFamily

function isItemFamily(entry: ScrapedEntry): entry is ItemFamily {
  return 'levelVariants' in entry
}

function directForumPostUrl(url?: string): string | undefined {
  if (!url) return undefined

  const messageId = url.match(/[?&]m=(\d+)/i)?.[1]
  if (!messageId || !/forums2\.battleon\.com\/f\//i.test(url)) return url

  return `https://forums2.battleon.com/f/fb.asp?m=${messageId}`
}

function hasExplicitDAContext(text: string): boolean {
  return /\b(?:da|d-amulet|dragon\s+amulet)\s*\/\s*(?:dc|d-coins?|dragon\s+coins?)\b/i.test(text)
}

function hasExplicitDCContext(text: string): boolean {
  return /\b(?:dc|d-coins?|dragon\s+coins?)\b/i.test(text)
}

function methodContext(method: ObtainVariant, levelName?: string, variantName?: string): string {
  return [
    levelName,
    variantName,
    method.location,
    method.requirements,
    method.requiredItems,
    method.price,
    method.sellback,
  ]
    .filter(Boolean)
    .join(' ')
}

function stripAccessSuffix(name: string): string {
  return name.replace(/\s+\((?:DA|DC|D-Amulet|D-Coins?|Normal)\)$/i, '').trim()
}

function variantGroupKey(level: ItemFamily['levelVariants'][number]): string {
  return [
    stripAccessSuffix(level.name).toLowerCase(),
    String(level.actualLevel ?? level.levelDisplay ?? '').toLowerCase(),
    (level.damage ?? '').toLowerCase(),
    (level.stats ?? '').toLowerCase(),
    (level.resists ?? '').toLowerCase(),
  ].join('|')
}

function repairMethodGroup(
  methods: ObtainVariant[],
  levelName?: string,
  variantName?: string
): ObtainVariant[] {
  const hasDCMethod = methods.some(obtainVariantHasDC)
  const hasNonDCMethod = methods.some((method) => !obtainVariantHasDC(method))

  return methods.map((method) => {
    const context = methodContext(method, levelName, variantName)
    const repaired: ObtainVariant = { ...method }

    if (obtainVariantHasDC(repaired)) {
      repaired.dcRequired = true
      if (hasNonDCMethod && !hasExplicitDAContext(context)) {
        repaired.daRequired = false
      }
    } else if (hasDCMethod && repaired.dcRequired && !hasExplicitDCContext(context)) {
      delete repaired.dcRequired
    }

    if (repaired.priceType === 'dm') {
      repaired.dmRequired = true
    }

    return repaired
  })
}

function repairFamily(entry: ItemFamily): ItemFamily {
  const shouldNormalizeForumUrls = entry.type !== 'accessory'
  const levelVariants = entry.levelVariants.map((level) => ({
    ...level,
    sourceUrl: shouldNormalizeForumUrls ? directForumPostUrl(level.sourceUrl) : level.sourceUrl,
    obtainVariants: repairMethodGroup(level.obtainVariants, level.name, level.variantName),
  }))

  const sameLevelGroups = new Map<string, number[]>()
  levelVariants.forEach((level, index) => {
    const key = variantGroupKey(level)
    sameLevelGroups.set(key, [...(sameLevelGroups.get(key) ?? []), index])
  })

  for (const indexes of sameLevelGroups.values()) {
    if (indexes.length < 2) continue

    const hasDCVariant = indexes.some((index) =>
      levelVariants[index].obtainVariants.some(obtainVariantHasDC)
    )
    const hasNonDCVariant = indexes.some((index) =>
      levelVariants[index].obtainVariants.some((method) => !obtainVariantHasDC(method))
    )

    if (!hasDCVariant || !hasNonDCVariant) continue

    for (const index of indexes) {
      const level = levelVariants[index]
      levelVariants[index] = {
        ...level,
        obtainVariants: level.obtainVariants.map((method) => {
          const context = methodContext(method, level.name, level.variantName)
          const repaired: ObtainVariant = { ...method }

          if (obtainVariantHasDC(repaired)) {
            repaired.dcRequired = true
            if (!hasExplicitDAContext(context)) repaired.daRequired = false
          } else if (!hasExplicitDCContext(context)) {
            delete repaired.dcRequired
          }

          return repaired
        }),
      }
    }
  }

  const allMethods = levelVariants.flatMap((level) => level.obtainVariants)
  const hasDA = allMethods.some((method) => method.daRequired)
  const hasDC = allMethods.some(obtainVariantHasDC)
  const hasDM = allMethods.some((method) => method.priceType === 'dm' || method.dmRequired)
  const hasFree = allMethods.some((method) => method.priceType === 'free')
  const hasMerge = allMethods.some((method) => method.priceType === 'merge')

  return {
    ...entry,
    forumUrl: shouldNormalizeForumUrls
      ? (directForumPostUrl(entry.forumUrl) ?? entry.forumUrl)
      : entry.forumUrl,
    familySources: shouldNormalizeForumUrls
      ? entry.familySources?.map((source) => ({
          ...source,
          url: directForumPostUrl(source.url) ?? source.url,
        }))
      : entry.familySources,
    levelVariants,
    hasDA,
    hasDC,
    hasDM,
    hasFree,
    hasMerge,
  }
}

function repairSingle<T extends SingleScrapedEntry>(entry: T): T {
  const shouldNormalizeForumUrls = entry.type !== 'accessory'
  const obtainMethods = repairMethodGroup(
    entry.obtainMethods.map((method) => ({
      location: method.location,
      price: method.price ?? 'N/A',
      priceType: method.priceType,
      sellback: method.sellback,
      requirements: method.requirements,
      requiredItems: method.requiredItems,
      daRequired: method.daRequired ?? entry.daRequired,
      dcRequired: method.dcRequired,
      dmRequired: method.dmRequired,
    })),
    entry.name
  )

  const hasDA = obtainMethods.some((method) => method.daRequired)
  const hasDC = obtainMethods.some(obtainVariantHasDC)
  const hasDM = obtainMethods.some((method) => method.priceType === 'dm' || method.dmRequired)

  return {
    ...entry,
    forumUrl: shouldNormalizeForumUrls
      ? (directForumPostUrl(entry.forumUrl) ?? entry.forumUrl)
      : entry.forumUrl,
    daRequired: hasDA,
    dcRequired: hasDC || undefined,
    dmRequired: hasDM || undefined,
    obtainMethods: obtainMethods.map((method) => ({
      location: method.location,
      priceType: method.priceType,
      requirements: method.requirements,
      price: method.price,
      requiredItems: method.requiredItems,
      sellback: method.sellback,
      daRequired: method.daRequired,
      dcRequired: method.dcRequired,
      dmRequired: method.dmRequired,
    })),
  }
}

export function repairAccessFlags<T extends ScrapedEntry>(entries: T[]): T[] {
  return entries.map(
    (entry) => (isItemFamily(entry) ? repairFamily(entry) : repairSingle(entry)) as T
  )
}
