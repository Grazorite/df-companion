import type { HousingEntry, HousingFamily, HousingItem } from '../types/housing'
import { isHousingFamily } from '../types/housing'
import type { AlsoSeeRef, LevelVariant, ObtainVariant } from '../types/item'

interface SideVariantInfo {
  familyName: string
  variantName: string
  side: 'left' | 'right'
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function sideFromLabel(label: string): 'left' | 'right' | undefined {
  if (/^(?:left|lefthand|leftside|l)$/i.test(label)) return 'left'
  if (/^(?:right|righthand|rightside|r)$/i.test(label)) return 'right'
  return undefined
}

function normalizeFamilyName(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function getHousingSideVariant(name: string): SideVariantInfo | undefined {
  const cleaned = normalizeFamilyName(name)
  const prefixMatch = cleaned.match(/^(Lefthand|Righthand|Leftside|Rightside|Left|Right)\s+(.+)$/i)
  if (prefixMatch) {
    const side = sideFromLabel(prefixMatch[1])
    if (!side) return undefined
    return {
      familyName: normalizeFamilyName(prefixMatch[2]),
      variantName: prefixMatch[1],
      side,
    }
  }

  const suffixMatch = cleaned.match(/^(.+?)\s+(Left|Right|L|R)$/i)
  if (suffixMatch) {
    const side = sideFromLabel(suffixMatch[2])
    if (!side) return undefined
    return {
      familyName: normalizeFamilyName(suffixMatch[1]),
      variantName: suffixMatch[2],
      side,
    }
  }

  const middleMatch = cleaned.match(/^(.+?)\s+(Left|Right)\s+(.+)$/i)
  if (middleMatch) {
    const side = sideFromLabel(middleMatch[2])
    if (!side) return undefined
    return {
      familyName: normalizeFamilyName(`${middleMatch[1]} ${middleMatch[3]}`),
      variantName: middleMatch[2],
      side,
    }
  }

  return undefined
}

function hasBothSides(infos: SideVariantInfo[]): boolean {
  const sides = new Set(infos.map((info) => info.side))
  return sides.has('left') && sides.has('right')
}

function sideSortValue(info: SideVariantInfo): number {
  return info.side === 'left' ? 0 : 1
}

function uniqueRefs(refs: Array<AlsoSeeRef | undefined>): AlsoSeeRef[] {
  return Array.from(
    new Map(
      refs
        .filter((ref): ref is AlsoSeeRef => Boolean(ref?.slug || ref?.url || ref?.name))
        .map((ref) => [ref.slug || ref.url || ref.name, ref])
    ).values()
  )
}

function itemObtainMethods(item: HousingItem): ObtainVariant[] {
  return item.obtainMethods ?? [
    {
      location: item.location ?? 'Unknown',
      price: item.price ?? 'N/A',
      priceType: item.dcRequired ? 'dc' : item.price?.toLowerCase().includes('gold') ? 'gold' : 'free',
      daRequired: true,
      ...(item.dcRequired ? { dcRequired: true } : {}),
      ...(item.sellback ? { sellback: item.sellback } : {}),
    },
  ]
}

function variantFromItem(item: HousingItem, info: SideVariantInfo, index: number): LevelVariant {
  return {
    levelNumber: index + 1,
    levelDisplay: info.variantName,
    variantName: info.variantName,
    name: item.name,
    damage: '',
    stats: item.capacity ?? '',
    obtainVariants: itemObtainMethods(item),
    sourceUrl: item.forumUrl,
    description: item.description,
    imageUrl: item.imageUrl,
    alternativeImages: item.alternativeImages,
    rarity: item.rarity,
    itemType: item.itemType,
    capacity: item.capacity,
    furnishingSlots: item.furnishingSlots,
    effect: item.effect,
    notes: item.notes,
  }
}

function normalizeSideFamily(family: HousingFamily): HousingFamily {
  const infos = family.levelVariants.map((variant) => getHousingSideVariant(variant.name))
  if (infos.some((info) => !info)) return family
  const presentInfos = infos.filter((info): info is SideVariantInfo => Boolean(info))
  const familyNames = new Set(presentInfos.map((info) => info.familyName.toLowerCase()))
  if (familyNames.size !== 1 || !hasBothSides(presentInfos)) return family

  const familyName = presentInfos[0].familyName
  const slug = `housing-${slugify(familyName)}`
  const orderedIndexes = presentInfos
    .map((info, index) => ({ info, index }))
    .sort((first, second) => sideSortValue(first.info) - sideSortValue(second.info))

  return {
    ...family,
    id: slug,
    familyName,
    slug,
    aliasSlugs: Array.from(new Set([family.slug, ...(family.aliasSlugs ?? [])])).filter(
      (alias) => alias !== slug
    ),
    levelVariants: orderedIndexes.map(({ info, index }, variantIndex) => ({
      ...family.levelVariants[index],
      levelNumber: variantIndex + 1,
      levelDisplay: info.variantName,
      variantName: info.variantName,
    })),
  }
}

function splitNoteGroups(notes: string | undefined): string[] {
  if (!notes) return []
  const groups: string[] = []
  for (const line of notes.split('\n')) {
    if (!line.trim()) continue
    if (/^\s+/.test(line) && groups.length > 0) {
      groups[groups.length - 1] = `${groups[groups.length - 1]}\n${line}`
    } else {
      groups.push(line)
    }
  }
  return groups
}

function normalizeNoteGroup(group: string): string {
  return group
    .replace(/\s+/g, ' ')
    .replace(/^[•\s]+/, '')
    .trim()
    .toLowerCase()
}

function sameNoteGroupSet(first: string[], second: string[]): boolean {
  if (first.length !== second.length) return false
  const firstSet = new Set(first.map(normalizeNoteGroup))
  return second.every((group) => firstSet.has(normalizeNoteGroup(group)))
}

function repairDuplicatedVariantNotes(family: HousingFamily): HousingFamily {
  if (family.levelVariants.length < 2) return family
  const variantGroups = family.levelVariants.map((variant) => splitNoteGroups(variant.notes))
  if (variantGroups.some((groups) => groups.length < family.levelVariants.length)) return family
  if (!variantGroups.every((groups) => sameNoteGroupSet(groups, variantGroups[0]))) return family

  const ownGroupCount = Math.floor(variantGroups[0].length / family.levelVariants.length)
  if (ownGroupCount < 1 || ownGroupCount * family.levelVariants.length !== variantGroups[0].length) {
    return family
  }

  return {
    ...family,
    levelVariants: family.levelVariants.map((variant, index) => ({
      ...variant,
      notes: variantGroups[index].slice(0, ownGroupCount).join('\n'),
    })),
  }
}

function familyFromSideItems(items: HousingItem[], infos: SideVariantInfo[]): HousingFamily {
  const ordered = infos
    .map((info, index) => ({ info, item: items[index] }))
    .sort((first, second) => sideSortValue(first.info) - sideSortValue(second.info))
  const familyName = ordered[0].info.familyName
  const slug = `housing-${slugify(familyName)}`
  const variants = ordered.map(({ item, info }, index) => variantFromItem(item, info, index))
  const allMethods = variants.flatMap((variant) => variant.obtainVariants)

  return {
    id: slug,
    familyName,
    slug,
    aliasSlugs: Array.from(new Set(items.map((item) => item.slug))).filter((alias) => alias !== slug),
    type: 'housing',
    subtype: items[0].subtype,
    forumUrl: items[0].forumUrl,
    familyOrigin: 'cross-post',
    familySources: ordered.map(({ item, info }, index) => ({
      title: item.name,
      url: item.forumUrl,
      variantLabel: info.variantName,
      isPrimary: index === 0,
    })),
    shared: {
      description: items[0].description,
      rarity: items[0].rarity,
      alsoSee: uniqueRefs(
        items.flatMap((item) =>
          (item.alsoSee ?? []).filter((ref) => !items.some((candidate) => candidate.slug === ref.slug))
        )
      ),
    },
    levelVariants: variants,
    itemType: items[0].itemType ?? 'Stuff',
    tags: Array.from(
      new Set([...items.flatMap((item) => item.tags), items[0].subtype, 'multiple-versions'])
    ),
    hasDA: true,
    hasDC: allMethods.some((method) => method.priceType === 'dc' || method.dcRequired),
    hasDM: allMethods.some((method) => method.priceType === 'dm' || method.dmRequired),
    hasFree: allMethods.some((method) => method.priceType === 'free'),
    hasMerge: allMethods.some((method) => method.priceType === 'merge'),
    levelRange: '',
    elements: [],
    isRare: items.some((item) => item.isRare),
    isSeasonal: items.some((item) => item.isSeasonal),
    isSpecialOffer: items.some((item) => item.isSpecialOffer),
    retired: items.some((item) => item.retired),
  }
}

export function normalizeHousingEntries(entries: HousingEntry[]): HousingEntry[] {
  const normalized = entries.map((entry) =>
    isHousingFamily(entry) ? repairDuplicatedVariantNotes(normalizeSideFamily(entry)) : entry
  )
  const sideGroups = new Map<string, Array<{ item: HousingItem; info: SideVariantInfo }>>()
  const passthrough: HousingEntry[] = []
  const consumed = new Set<string>()

  for (const entry of normalized) {
    if (isHousingFamily(entry)) {
      passthrough.push(entry)
      continue
    }

    const info = getHousingSideVariant(entry.name)
    if (!info) {
      passthrough.push(entry)
      continue
    }

    const key = `${entry.subtype}:${info.familyName.toLowerCase()}`
    sideGroups.set(key, [...(sideGroups.get(key) ?? []), { item: entry, info }])
  }

  for (const group of sideGroups.values()) {
    const infos = group.map((entry) => entry.info)
    if (group.length >= 2 && hasBothSides(infos)) {
      group.forEach(({ item }) => consumed.add(item.slug))
      passthrough.push(
        familyFromSideItems(
          group.map(({ item }) => item),
          infos
        )
      )
    } else {
      passthrough.push(...group.map(({ item }) => item))
    }
  }

  return passthrough.filter((entry) => isHousingFamily(entry) || !consumed.has(entry.slug))
}
