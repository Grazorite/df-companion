import type {
  Accessory,
  AccessoryEntry,
  AccessoryFamily,
  AccessorySubtype,
} from '../../../src/types/accessory.ts'
import type {
  AlsoSeeRef,
  AlternativeImage,
  FamilySourceRef,
  LevelVariant,
} from '../../../src/types/item.ts'
import { compareTitles } from '../../../src/utils/displayText.ts'
import { computeFamilyFlags, normalizeLevel } from '../../../src/utils/variantHelpers.ts'
import { slugify } from '../text.ts'

const ENABLED_SUBTYPES = new Set<AccessorySubtype>(['helm'])
const DEFERRED_CROSS_POST_FAMILY_PATTERNS = [/\b(?:dragonlion|lion)'?s?\b.*\b(?:head|mane)\b/i]
const DRAGONLION_VARIANTS = ['(Base)', 'Nervous', 'Alarmed', 'Spooked', 'Panicky', 'Petrified']
const DRAGONLION_HEAD_FAMILY_NAMES = [
  "Timid Lion's Head",
  "Timid DragonLion's Head",
  "Timid DragonLion's Noble Head",
]
const DRAGONLION_MANE_FAMILY_NAMES = [
  "Timid Lion's Mane",
  "Timid DragonLion's Mane",
  "Timid DragonLion's Flowing Mane",
]

interface SpecialFamilySpec {
  familyName: string
  names: string[]
  variantNames: string[]
  notes?: string
}

const SPECIAL_FAMILY_SPECS: SpecialFamilySpec[] = [
  {
    familyName: 'BraveSirRobin Cat Mask',
    names: ['BraveSirRobin Cat Mask', 'Fierce BraveSirRobin Cat Mask'],
    variantNames: ['(Base)', '(DC)', 'Fierce'],
  },
  {
    familyName: 'Deatharrows Cat Mask',
    names: ['Deatharrows Cat Mask', 'Fierce Deatharrows Cat Mask'],
    variantNames: ['(Base)', '(DC)', 'Fierce'],
  },
  {
    familyName: "Timid Lion's Head",
    names: [
      "Timid Lion's Head",
      "Nervous Lion's Head",
      "Alarmed Lion's Head",
      "Spooked Lion's Head",
      "Panicky Lion's Head",
      "Petrified Lion's Head",
    ],
    variantNames: DRAGONLION_VARIANTS,
    notes: '• Non-Color Custom',
  },
  {
    familyName: "Timid DragonLion's Head",
    names: [
      "Timid DragonLion's Head",
      "Nervous DragonLion's Head",
      "Alarmed DragonLion's Head",
      "Spooked DragonLion's Head",
      "Panicky DragonLion's Head",
      "Petrified DragonLion's Head",
    ],
    variantNames: DRAGONLION_VARIANTS,
    notes: '• Color Custom, Dragon Amulet',
  },
  {
    familyName: "Timid DragonLion's Noble Head",
    names: [
      "Timid DragonLion's Noble Head",
      "Nervous DragonLion's Noble Head",
      "Alarmed DragonLion's Noble Head",
      "Spooked DragonLion's Noble Head",
      "Panicky DragonLion's Noble Head",
      "Petrified DragonLion's Noble Head",
    ],
    variantNames: DRAGONLION_VARIANTS,
    notes: '• Color Custom, Dragon Coins',
  },
  {
    familyName: "Timid Lion's Mane",
    names: [
      "Timid Lion's Mane",
      "Nervous Lion's Mane",
      "Alarmed Lion's Mane",
      "Spooked Lion's Mane",
      "Panicky Lion's Mane",
      "Petrified Lion's Mane",
    ],
    variantNames: DRAGONLION_VARIANTS,
    notes: '• Non-Color Custom',
  },
  {
    familyName: "Timid DragonLion's Mane",
    names: [
      "Timid DragonLion's Mane",
      "Nervous DragonLion's Mane",
      "Alarmed DragonLion's Mane",
      "Spooked DragonLion's Mane",
      "Panicky DragonLion's Mane",
      "Petrified DragonLion's Mane",
    ],
    variantNames: DRAGONLION_VARIANTS,
    notes: '• Color Custom, Dragon Amulet',
  },
  {
    familyName: "Timid DragonLion's Flowing Mane",
    names: [
      "Timid DragonLion's Flowing Mane",
      "Nervous DragonLion's Flowing Mane",
      "Alarmed DragonLion's Flowing Mane",
      "Spooked DragonLion's Flowing Mane",
      "Panicky DragonLion's Flowing Mane",
      "Petrified DragonLion's Flowing Mane",
    ],
    variantNames: DRAGONLION_VARIANTS,
    notes: '• Color Custom, Dragon Coins',
  },
]

function isAccessoryFamily(entry: AccessoryEntry): entry is AccessoryFamily {
  return 'levelVariants' in entry && 'familyName' in entry
}

function getDisplayName(entry: AccessoryEntry): string {
  return isAccessoryFamily(entry) ? entry.familyName : entry.name
}

function getPrimarySortLevel(entry: AccessoryEntry): number {
  if (isAccessoryFamily(entry)) {
    return Math.min(
      ...entry.levelVariants.map((variant) => variant.actualLevel ?? variant.levelNumber)
    )
  }

  return normalizeLevel(entry.level?.trim() || '1').number
}

function normalizeLookupName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+\((?:all versions|[ivxlcdm]+(?:-[ivxlcdm]+)?|\d+)\)$/i, '')
    .replace(/[^\w\s']+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenizeTitle(name: string): string[] {
  return normalizeLookupName(name).split(' ').filter(Boolean)
}

function getLongestCommonSuffix(tokensList: string[][]): string[] {
  if (tokensList.length === 0) return []
  const reversed = tokensList.map((tokens) => [...tokens].reverse())
  const result: string[] = []
  let index = 0

  while (true) {
    const candidate = reversed[0][index]
    if (!candidate) break
    if (reversed.every((tokens) => tokens[index] === candidate)) {
      result.unshift(candidate)
      index += 1
      continue
    }
    break
  }

  return result
}

function getLongestCommonPrefix(tokensList: string[][]): string[] {
  if (tokensList.length === 0) return []
  const result: string[] = []
  let index = 0

  while (true) {
    const candidate = tokensList[0][index]
    if (!candidate) break
    if (tokensList.every((tokens) => tokens[index] === candidate)) {
      result.push(candidate)
      index += 1
      continue
    }
    break
  }

  return result
}

function titleCaseFromTokens(tokens: string[]): string {
  return tokens
    .map((token) => {
      if (token.toLowerCase() === "'o") return "'o"
      if (/^oogabooga$/i.test(token)) return 'OogaBooga'
      return token.replace(/\b\w/g, (char) => char.toUpperCase()).replace(/'S\b/g, "'s")
    })
    .join(' ')
}

function trimLeadingFamilyStopWords(tokens: string[]): string[] {
  const trimmed = [...tokens]
  while (trimmed.length > 0 && /^(?:of|with)$/i.test(trimmed[0])) {
    trimmed.shift()
  }
  return trimmed
}

function trimTrailingFamilyStopWords(tokens: string[]): string[] {
  const trimmed = [...tokens]
  while (trimmed.length > 0 && /^(?:of)$/i.test(trimmed.at(-1) ?? '')) {
    trimmed.pop()
  }
  return trimmed
}

function getSharedTitleTokens(entries: AccessoryEntry[]): string[] {
  const tokenSets = entries.map((entry) => tokenizeTitle(getDisplayName(entry)))
  const suffix = trimLeadingFamilyStopWords(
    getLongestCommonSuffix(tokenSets).filter((token) => !/^\d+$/.test(token))
  )
  if (suffix.length >= 2) return suffix

  const prefix = trimTrailingFamilyStopWords(
    getLongestCommonPrefix(tokenSets).filter((token) => !/^\d+$/.test(token))
  )
  if (prefix.length >= 2) return prefix
  if (prefix.length > 0 && suffix.length > 0) return [...prefix, ...suffix]

  const parentheticalPrefixFamily = getParentheticalPrefixFamilyParts(entries)
  return parentheticalPrefixFamily ? parentheticalPrefixFamily.prefix : []
}

function hasOnlyWeakPrefixSuffixTitleFamily(entries: AccessoryEntry[]): boolean {
  const tokenSets = entries.map((entry) => tokenizeTitle(getDisplayName(entry)))
  const suffix = trimLeadingFamilyStopWords(
    getLongestCommonSuffix(tokenSets).filter((token) => !/^\d+$/.test(token))
  )
  const prefix = trimTrailingFamilyStopWords(
    getLongestCommonPrefix(tokenSets).filter((token) => !/^\d+$/.test(token))
  )

  return prefix.length === 1 && suffix.length === 1
}

function getParentheticalPrefixFamilyParts(
  entries: AccessoryEntry[]
): { prefix: string[]; variants: string[] } | undefined {
  const tokenSets = entries.map((entry) => tokenizeTitle(getDisplayName(entry)))
  const prefix = trimTrailingFamilyStopWords(
    getLongestCommonPrefix(tokenSets).filter((token) => !/^\d+$/.test(token))
  )
  if (prefix.length !== 1 || prefix[0].length < 6) return undefined

  const variants = tokenSets.map((tokens) => tokens.slice(prefix.length))
  if (variants.some((variant) => variant.length !== 1)) return undefined

  const uniqueVariants = new Set(variants.map((variant) => variant[0]))
  if (uniqueVariants.size !== variants.length) return undefined

  return {
    prefix,
    variants: variants
      .map((variant, index) => ({
        name: titleCaseFromTokens(variant),
        level: getPrimarySortLevel(entries[index]),
      }))
      .sort((a, b) => a.level - b.level || compareTitles(a.name, b.name))
      .map((variant) => variant.name),
  }
}

function deriveFamilyName(entries: AccessoryEntry[]): string {
  const parentheticalPrefixFamily = getParentheticalPrefixFamilyParts(entries)
  if (parentheticalPrefixFamily) {
    return `${titleCaseFromTokens(parentheticalPrefixFamily.prefix)} (${parentheticalPrefixFamily.variants.join(', ')})`
  }

  const tokenSets = entries.map((entry) => tokenizeTitle(getDisplayName(entry)))
  const prefix = getLongestCommonPrefix(tokenSets).filter((token) => !/^\d+$/.test(token))
  const prefixOnly = trimTrailingFamilyStopWords(prefix)
  const suffix = trimLeadingFamilyStopWords(
    getLongestCommonSuffix(tokenSets).filter((token) => !/^\d+$/.test(token))
  )
  const prefixIsMeaningful = prefix.length > 0 && prefix.some((token) => !/^\d+$/.test(token))
  const suffixStartsWithPrefix =
    prefix.length > 0 &&
    suffix.slice(0, prefix.length).every((token, index) => token === prefix[index])

  if (prefixIsMeaningful && suffix.length > 0 && !suffixStartsWithPrefix) {
    return titleCaseFromTokens([...prefix, ...suffix])
  }
  if (suffix.length >= 2) return titleCaseFromTokens(suffix)
  if (prefixOnly.length >= 2) return titleCaseFromTokens(prefixOnly)

  return entries.map(getDisplayName).sort((a, b) => a.length - b.length || compareTitles(a, b))[0]
}

function deriveVariantName(name: string, familyName: string): string | undefined {
  const normalizedName = normalizeLookupName(name)
  const normalizedFamily = normalizeLookupName(familyName)
  const parenthetical = familyName.match(/^(.*?)\s*\(([^)]+)\)\s*$/)
  const nameTokens = tokenizeTitle(name)
  const familyTokens = tokenizeTitle(familyName)

  if (parenthetical) {
    const baseName = normalizeLookupName(parenthetical[1])
    if (normalizedName.startsWith(`${baseName} `)) {
      const suffix = normalizedName.slice(baseName.length).trim()
      return suffix ? titleCaseFromTokens(suffix.split(/\s+/)) : '(Base)'
    }
  }

  if (normalizedName === normalizedFamily) return '(Base)'

  if (normalizedName.endsWith(` ${normalizedFamily}`)) {
    const prefix = normalizedName.slice(0, normalizedName.length - normalizedFamily.length).trim()
    return prefix ? titleCaseFromTokens(prefix.split(/\s+/)) : 'Base'
  }

  if (normalizedName.startsWith(`${normalizedFamily} `)) {
    const suffix = normalizedName.slice(normalizedFamily.length).trim()
    return suffix ? titleCaseFromTokens(suffix.split(/\s+/)) : 'Base'
  }

  const familyPrefix = trimTrailingFamilyStopWords(
    getLongestCommonPrefix([nameTokens, familyTokens]).filter((token) => !/^\d+$/.test(token))
  )
  const familySuffix = trimLeadingFamilyStopWords(
    getLongestCommonSuffix([nameTokens, familyTokens]).filter((token) => !/^\d+$/.test(token))
  )
  if (familyPrefix.length > 0 && familySuffix.length > 0) {
    const middle = nameTokens.slice(familyPrefix.length, nameTokens.length - familySuffix.length)
    if (middle.length > 0) return titleCaseFromTokens(middle)
  }

  return name
}

function descriptionsMatch(a?: string, b?: string): boolean {
  if (!a || !b) return false
  return normalizeLookupName(a) === normalizeLookupName(b)
}

function hasStrongTitleFamily(a: AccessoryEntry, b: AccessoryEntry): boolean {
  return getSharedTitleTokens([a, b]).length > 0
}

function getRefs(entry: AccessoryEntry): AlsoSeeRef[] {
  return isAccessoryFamily(entry) ? (entry.shared.alsoSee ?? []) : (entry.alsoSee ?? [])
}

function sharesExplicitReference(a: AccessoryEntry, b: AccessoryEntry): boolean {
  const aName = normalizeLookupName(getDisplayName(a))
  const bName = normalizeLookupName(getDisplayName(b))
  const aRefs = new Set(getRefs(a).map((ref) => normalizeLookupName(ref.name)))
  const bRefs = new Set(getRefs(b).map((ref) => normalizeLookupName(ref.name)))

  return aRefs.has(bName) || bRefs.has(aName)
}

function metadataCompatible(a: AccessoryEntry, b: AccessoryEntry): boolean {
  if (a.type !== b.type) return false
  if (a.subtype !== b.subtype) return false
  if (!ENABLED_SUBTYPES.has(a.subtype)) return false

  const fields: Array<keyof Accessory> = ['itemType', 'equipSpot', 'category']
  return fields.every((field) => {
    const aValue = !isAccessoryFamily(a) ? a[field] : undefined
    const bValue = !isAccessoryFamily(b) ? b[field] : undefined
    return !aValue || !bValue || String(aValue).toLowerCase() === String(bValue).toLowerCase()
  })
}

function allMutuallyConnected(entries: AccessoryEntry[]): boolean {
  return entries.every((entry) => {
    const refs = new Set(getRefs(entry).map((ref) => normalizeLookupName(ref.name)))
    return entries.every((other) => {
      if (other.slug === entry.slug) return true
      return refs.has(normalizeLookupName(getDisplayName(other)))
    })
  })
}

function hasContentEvidence(a: AccessoryEntry, b: AccessoryEntry): boolean {
  if (isAccessoryFamily(a) || isAccessoryFamily(b)) return hasStrongTitleFamily(a, b)

  return (
    descriptionsMatch(a.description, b.description) ||
    Boolean(a.imageUrl && b.imageUrl && a.imageUrl === b.imageUrl) ||
    hasStrongTitleFamily(a, b)
  )
}

function hasNonTitleContentEvidence(a: AccessoryEntry, b: AccessoryEntry): boolean {
  if (isAccessoryFamily(a) || isAccessoryFamily(b)) return false

  return (
    descriptionsMatch(a.description, b.description) ||
    Boolean(a.imageUrl && b.imageUrl && a.imageUrl === b.imageUrl)
  )
}

function canCrossMerge(a: AccessoryEntry, b: AccessoryEntry): boolean {
  if (!metadataCompatible(a, b)) return false
  if (isAccessoryFamily(a) && isAccessoryFamily(b)) return false
  if (
    DEFERRED_CROSS_POST_FAMILY_PATTERNS.some(
      (pattern) => pattern.test(getDisplayName(a)) || pattern.test(getDisplayName(b))
    )
  )
    return false
  if (!sharesExplicitReference(a, b)) return false
  if (!hasStrongTitleFamily(a, b)) return false
  if (hasOnlyWeakPrefixSuffixTitleFamily([a, b]) && !hasNonTitleContentEvidence(a, b)) return false
  return hasContentEvidence(a, b)
}

function uniqueAlternativeImages(images: AlternativeImage[]): AlternativeImage[] {
  return Array.from(
    new Map(images.map((image) => [`${image.url}|${image.caption}`, image])).values()
  )
}

function buildVariantFromAccessory(
  entry: Accessory,
  familyName: string,
  index: number
): LevelVariant {
  const levelDisplay = entry.level?.trim() || String(index + 1)
  const normalizedLevel = normalizeLevel(levelDisplay)
  const actualLevel = /^\d+$/.test(levelDisplay) ? Number.parseInt(levelDisplay, 10) : undefined

  return {
    levelNumber: normalizedLevel.number,
    levelDisplay: normalizedLevel.display,
    ...(actualLevel !== undefined ? { actualLevel } : {}),
    ...(deriveVariantName(entry.name, familyName)
      ? { variantName: deriveVariantName(entry.name, familyName) }
      : {}),
    name: entry.name,
    damage: '',
    stats: entry.stats ?? 'None',
    sourceUrl: entry.forumUrl,
    description: entry.description,
    ...(entry.imageUrl ? { imageUrl: entry.imageUrl } : {}),
    ...(entry.alternativeImages?.length ? { alternativeImages: entry.alternativeImages } : {}),
    obtainVariants: entry.obtainMethods,
    ...(entry.elements[0] ? { element: entry.elements[0] } : {}),
    ...(entry.resists ? { resists: entry.resists } : {}),
    ...(entry.rarity ? { rarity: entry.rarity } : {}),
    ...(entry.attacks?.length ? { attacks: entry.attacks } : {}),
    ...(entry.notes ? { notes: entry.notes } : {}),
  }
}

function flattenFamilyVariants(family: AccessoryFamily): LevelVariant[] {
  return family.levelVariants.map((variant) => ({
    ...variant,
    sourceUrl: variant.sourceUrl ?? family.forumUrl,
  }))
}

function allSame<T>(values: T[]): boolean {
  if (values.length <= 1) return true
  return values.every((value) => JSON.stringify(value) === JSON.stringify(values[0]))
}

function gatherExternalAlsoSee(entries: AccessoryEntry[], familySlug: string): AlsoSeeRef[] {
  const internalSlugs = new Set(
    entries.flatMap((entry) => [
      entry.slug,
      ...(isAccessoryFamily(entry) ? (entry.aliasSlugs ?? []) : []),
    ])
  )
  const internalNames = new Set(
    entries.flatMap((entry) => [
      normalizeLookupName(getDisplayName(entry)),
      ...(isAccessoryFamily(entry)
        ? entry.levelVariants.map((variant) => normalizeLookupName(variant.name))
        : []),
    ])
  )
  internalSlugs.add(familySlug)
  const refs = new Map<string, AlsoSeeRef>()

  for (const entry of entries) {
    for (const ref of getRefs(entry)) {
      if (internalSlugs.has(ref.slug)) continue
      if (internalNames.has(normalizeLookupName(ref.name))) continue
      refs.set(`${ref.type}:${ref.slug}:${ref.url ?? ''}`, ref)
    }
  }

  return Array.from(refs.values()).sort((a, b) => compareTitles(a.name, b.name))
}

function dedupeAlsoSee(refs: AlsoSeeRef[]): AlsoSeeRef[] {
  return Array.from(
    new Map(refs.map((ref) => [`${ref.type}:${ref.slug}:${ref.url ?? ''}`, ref])).values()
  ).sort((a, b) => compareTitles(a.name, b.name))
}

function getAlsoSee(entry: AccessoryEntry): AlsoSeeRef[] {
  return isAccessoryFamily(entry) ? (entry.shared.alsoSee ?? []) : (entry.alsoSee ?? [])
}

function setAlsoSee(entry: AccessoryEntry, refs: AlsoSeeRef[]): AccessoryEntry {
  const dedupedRefs = dedupeAlsoSee(refs)
  if (isAccessoryFamily(entry)) {
    const { alsoSee: _alsoSee, ...sharedWithoutAlsoSee } = entry.shared
    return {
      ...entry,
      shared: {
        ...sharedWithoutAlsoSee,
        ...(dedupedRefs.length ? { alsoSee: dedupedRefs } : {}),
      },
    }
  }

  const { alsoSee: _alsoSee, ...entryWithoutAlsoSee } = entry
  return {
    ...entryWithoutAlsoSee,
    ...(dedupedRefs.length ? { alsoSee: dedupedRefs } : {}),
  }
}

function getFamilyRef(family: AccessoryFamily): AlsoSeeRef {
  return {
    name: family.familyName,
    slug: family.slug,
    type: 'accessory',
    url: family.forumUrl,
  }
}

function rewriteRelatedRefsForPromotedFamilies(entries: AccessoryEntry[]): AccessoryEntry[] {
  const aliasToFamily = new Map<string, AccessoryFamily>()
  const knownSlugs = new Set(
    entries.flatMap((entry) => [
      entry.slug,
      ...(isAccessoryFamily(entry) ? (entry.aliasSlugs ?? []) : []),
    ])
  )

  for (const entry of entries) {
    if (!isAccessoryFamily(entry)) continue
    for (const slug of entry.aliasSlugs ?? []) {
      aliasToFamily.set(slug, entry)
    }
  }

  const rewritten = entries.map((entry) => {
    const selfSlugs = new Set([
      entry.slug,
      ...(isAccessoryFamily(entry) ? (entry.aliasSlugs ?? []) : []),
    ])
    const selfNames = new Set([
      normalizeLookupName(getDisplayName(entry)),
      ...(isAccessoryFamily(entry)
        ? entry.levelVariants.map((variant) => normalizeLookupName(variant.name))
        : []),
    ])
    const refs = getAlsoSee(entry)
      .map((ref) => {
        const family = aliasToFamily.get(ref.slug)
        if (!family) return ref
        return getFamilyRef(family)
      })
      .filter((ref) => !selfSlugs.has(ref.slug) && !selfNames.has(normalizeLookupName(ref.name)))
      .filter((ref) => knownSlugs.has(ref.slug))

    return setAlsoSee(entry, refs)
  })

  const bySlug = new Map(rewritten.map((entry) => [entry.slug, entry]))

  for (const family of entries.filter(isAccessoryFamily)) {
    const familyRef = getFamilyRef(family)
    for (const ref of getAlsoSee(family)) {
      const target = bySlug.get(ref.slug) ?? aliasToFamily.get(ref.slug)
      if (!target) continue
      if (target.slug === family.slug) continue

      const updatedRefs = dedupeAlsoSee([...getAlsoSee(target), familyRef])
      bySlug.set(target.slug, setAlsoSee(target, updatedRefs))
    }
  }

  return rewritten.map((entry) => bySlug.get(entry.slug) ?? entry)
}

function sortVariants(variants: LevelVariant[]): LevelVariant[] {
  return variants
    .slice()
    .sort((a, b) => {
      const aLevel = a.actualLevel ?? a.levelNumber
      const bLevel = b.actualLevel ?? b.levelNumber
      if (aLevel !== bLevel) return aLevel - bLevel
      return compareTitles(a.name, b.name)
    })
    .map((variant, index) => ({
      ...variant,
      levelNumber: index + 1,
    }))
}

function buildSources(entries: AccessoryEntry[], familyName: string): FamilySourceRef[] {
  return entries.map((entry, index) => ({
    url: entry.forumUrl,
    title: `DF Encyclopedia: ${getDisplayName(entry)}`,
    ...(getDisplayName(entry) !== familyName ? { variantLabel: getDisplayName(entry) } : {}),
    isPrimary: index === 0,
  }))
}

function buildFamilyFromGroup(entries: AccessoryEntry[]): AccessoryFamily {
  const sorted = entries.slice().sort((a, b) => compareTitles(getDisplayName(a), getDisplayName(b)))
  const familyAnchor = sorted.find(isAccessoryFamily)
  const familyName = deriveFamilyName(sorted)
  const exactFamilyNameEntry = sorted.find(
    (entry) => normalizeLookupName(getDisplayName(entry)) === normalizeLookupName(familyName)
  )
  const parentheticalPrefixFamily = getParentheticalPrefixFamilyParts(sorted)
  const familySlug =
    familyAnchor?.slug ??
    exactFamilyNameEntry?.slug ??
    (parentheticalPrefixFamily ? `accessory-${slugify(familyName)}` : sorted[0].slug)
  const variants = sortVariants(
    sorted.flatMap((entry, index) =>
      isAccessoryFamily(entry)
        ? flattenFamilyVariants(entry)
        : [buildVariantFromAccessory(entry, familyName, index)]
    )
  )
  const descriptions = variants
    .map((variant) => variant.description)
    .filter((value): value is string => Boolean(value))
  const imageUrls = variants
    .map((variant) => variant.imageUrl)
    .filter((value): value is string => Boolean(value))
  const alternativeImages = uniqueAlternativeImages(
    variants.flatMap((variant) => variant.alternativeImages ?? [])
  )
  const notes = variants
    .map((variant) => variant.notes)
    .filter((value): value is string => Boolean(value))
  const abilities = sorted
    .filter((entry): entry is Accessory => !isAccessoryFamily(entry))
    .map((entry) => entry.ability)
    .filter((value): value is string => Boolean(value))
  const resists = variants
    .map((variant) => variant.resists)
    .filter((value): value is string => Boolean(value))
  const rarities = variants
    .map((variant) => variant.rarity)
    .filter((value): value is string => Boolean(value))
  const alsoSee = gatherExternalAlsoSee(sorted, familySlug)
  const aliasSlugs = Array.from(
    new Set(
      sorted.flatMap((entry) => [
        entry.slug,
        ...(isAccessoryFamily(entry) ? (entry.aliasSlugs ?? []) : []),
      ])
    )
  ).filter((slug) => slug !== familySlug)
  const subtype = sorted[0].subtype
  const singles = sorted.filter((entry): entry is Accessory => !isAccessoryFamily(entry))
  const family: AccessoryFamily = {
    id: familyAnchor?.id ?? familySlug,
    familyName,
    slug: familySlug,
    ...(aliasSlugs.length ? { aliasSlugs } : {}),
    type: 'accessory',
    subtype,
    forumUrl: familyAnchor?.forumUrl ?? sorted[0].forumUrl,
    familyOrigin: 'cross-post',
    familySources: buildSources(sorted, familyName),
    shared: {
      description:
        descriptions.length > 0 && allSame(descriptions)
          ? descriptions[0]
          : (descriptions[0] ?? ''),
      ...(imageUrls.length > 0 && allSame(imageUrls) ? { imageUrl: imageUrls[0] } : {}),
      ...(alternativeImages.length > 0 && allSame(imageUrls) ? { alternativeImages } : {}),
      ...(abilities.length > 0 && allSame(abilities) ? { ability: abilities[0] } : {}),
      ...(resists.length > 0 && allSame(resists) ? { resists: resists[0] } : {}),
      ...(rarities.length > 0 && allSame(rarities) ? { rarity: rarities[0] } : {}),
      ...(notes.length > 0 && allSame(notes) ? { notes: notes[0] } : {}),
      ...(alsoSee.length ? { alsoSee } : {}),
    },
    levelVariants: variants,
    itemType: singles.find((entry) => entry.itemType)?.itemType ?? familyAnchor?.itemType,
    equipSlot: singles.find((entry) => entry.equipSpot)?.equipSpot ?? familyAnchor?.equipSlot,
    modifies: singles.find((entry) => entry.modifies)?.modifies ?? familyAnchor?.modifies,
    category: singles.find((entry) => entry.category)?.category ?? familyAnchor?.category,
    releaseDate:
      singles.find((entry) => entry.releaseDate)?.releaseDate ?? familyAnchor?.releaseDate,
    tags: Array.from(new Set(sorted.flatMap((entry) => entry.tags))).sort(),
    isTemp: sorted.some((entry) => entry.isTemp) || undefined,
    isRare: sorted.some((entry) => entry.isRare) || undefined,
    isSeasonal: sorted.some((entry) => entry.isSeasonal) || undefined,
    isSpecialOffer: sorted.some((entry) => entry.isSpecialOffer) || undefined,
    retired: sorted.some((entry) => entry.retired) || undefined,
    hasDA: false,
    hasDC: false,
    hasDM: false,
    hasFree: false,
    hasMerge: false,
    levelRange: '',
    elements: Array.from(new Set(sorted.flatMap((entry) => entry.elements))),
  }

  return computeFamilyFlags(family)
}

function findEntryByName(entries: AccessoryEntry[], name: string): AccessoryEntry | undefined {
  const targetName = normalizeLookupName(name)
  return entries.find((entry) => normalizeLookupName(getDisplayName(entry)) === targetName)
}

function flattenSpecialEntry(entry: AccessoryEntry, familyName: string): LevelVariant[] {
  if (isAccessoryFamily(entry)) return flattenFamilyVariants(entry)
  return [buildVariantFromAccessory(entry, familyName, 0)]
}

function buildSpecialFamily(
  entries: AccessoryEntry[],
  spec: SpecialFamilySpec
): AccessoryFamily | undefined {
  const matchedEntries = spec.names
    .map((name) => findEntryByName(entries, name))
    .filter((entry): entry is AccessoryEntry => Boolean(entry))
  if (matchedEntries.length !== spec.names.length) return undefined

  const familySlug = matchedEntries[0].slug
  let variantIndex = 0
  const variants = matchedEntries.flatMap((entry) =>
    flattenSpecialEntry(entry, spec.familyName).map((variant) => {
      const variantName = spec.variantNames[variantIndex] ?? variant.variantName
      variantIndex += 1
      return {
        ...variant,
        ...(variantName ? { variantName } : {}),
        levelNumber: variantIndex,
      }
    })
  )
  const imageUrls = variants
    .map((variant) => variant.imageUrl)
    .filter((value): value is string => Boolean(value))
  const alternativeImages = uniqueAlternativeImages(
    variants.flatMap((variant) => variant.alternativeImages ?? [])
  )
  const notes = spec.notes
    ? [spec.notes]
    : variants.map((variant) => variant.notes).filter((value): value is string => Boolean(value))
  const aliases = Array.from(
    new Set(
      matchedEntries.flatMap((entry) => [
        entry.slug,
        ...(isAccessoryFamily(entry) ? (entry.aliasSlugs ?? []) : []),
      ])
    )
  ).filter((slug) => slug !== familySlug)
  const familyAnchor = matchedEntries.find(isAccessoryFamily)
  const singles = matchedEntries.filter((entry): entry is Accessory => !isAccessoryFamily(entry))
  const subtype = matchedEntries[0].subtype
  const family: AccessoryFamily = {
    id: familySlug,
    familyName: spec.familyName,
    slug: familySlug,
    ...(aliases.length ? { aliasSlugs: aliases } : {}),
    type: 'accessory',
    subtype,
    forumUrl: matchedEntries[0].forumUrl,
    familyOrigin: 'cross-post',
    familySources: [],
    shared: {
      description:
        variants.find((variant) => variant.description)?.description ??
        (familyAnchor?.shared.description || ''),
      ...(imageUrls.length > 0 && allSame(imageUrls) ? { imageUrl: imageUrls[0] } : {}),
      ...(alternativeImages.length > 0 && allSame(imageUrls) ? { alternativeImages } : {}),
      ...(notes.length > 0 ? { notes: notes.join('\n') } : {}),
      ...(gatherExternalAlsoSee(matchedEntries, familySlug).length
        ? { alsoSee: gatherExternalAlsoSee(matchedEntries, familySlug) }
        : {}),
    },
    levelVariants: variants,
    itemType: singles.find((entry) => entry.itemType)?.itemType ?? familyAnchor?.itemType,
    equipSlot: singles.find((entry) => entry.equipSpot)?.equipSpot ?? familyAnchor?.equipSlot,
    modifies: singles.find((entry) => entry.modifies)?.modifies ?? familyAnchor?.modifies,
    category: singles.find((entry) => entry.category)?.category ?? familyAnchor?.category,
    releaseDate:
      singles.find((entry) => entry.releaseDate)?.releaseDate ?? familyAnchor?.releaseDate,
    tags: Array.from(new Set(matchedEntries.flatMap((entry) => entry.tags))).sort(),
    isTemp: matchedEntries.some((entry) => entry.isTemp) || undefined,
    isRare: matchedEntries.some((entry) => entry.isRare) || undefined,
    isSeasonal: matchedEntries.some((entry) => entry.isSeasonal) || undefined,
    isSpecialOffer: matchedEntries.some((entry) => entry.isSpecialOffer) || undefined,
    retired: matchedEntries.some((entry) => entry.retired) || undefined,
    hasDA: false,
    hasDC: false,
    hasDM: false,
    hasFree: false,
    hasMerge: false,
    levelRange: '',
    elements: Array.from(new Set(matchedEntries.flatMap((entry) => entry.elements))),
  }

  return computeFamilyFlags(family)
}

function applySpecialFamilies(entries: AccessoryEntry[]): AccessoryEntry[] {
  const consumedSlugs = new Set<string>()
  const families: AccessoryFamily[] = []

  for (const spec of SPECIAL_FAMILY_SPECS) {
    const family = buildSpecialFamily(entries, spec)
    if (!family) continue
    families.push(family)
    consumedSlugs.add(family.slug)
    for (const slug of family.aliasSlugs ?? []) {
      consumedSlugs.add(slug)
    }
  }

  if (families.length === 0) return entries

  const familiesByName = new Map(families.map((family) => [family.familyName, family]))
  const setFamilySiblings = (familyNames: string[]) => {
    for (const familyName of familyNames) {
      const family = familiesByName.get(familyName)
      if (!family) continue
      const siblingRefs = familyNames
        .filter((name) => name !== familyName)
        .map((name) => familiesByName.get(name))
        .filter((sibling): sibling is AccessoryFamily => Boolean(sibling))
        .map(getFamilyRef)
      familiesByName.set(familyName, setAlsoSee(family, siblingRefs) as AccessoryFamily)
    }
  }

  setFamilySiblings(DRAGONLION_HEAD_FAMILY_NAMES)
  setFamilySiblings(DRAGONLION_MANE_FAMILY_NAMES)

  return [...entries.filter((entry) => !consumedSlugs.has(entry.slug)), ...familiesByName.values()]
}

export function promoteAccessoryCrossPostFamilies(entries: AccessoryEntry[]): AccessoryEntry[] {
  const visited = new Set<string>()
  const groups: AccessoryEntry[][] = []

  for (const entry of entries) {
    if (visited.has(entry.slug)) continue
    const queue = [entry]
    const group: AccessoryEntry[] = []

    while (queue.length > 0) {
      const current = queue.shift()!
      if (visited.has(current.slug)) continue
      visited.add(current.slug)
      group.push(current)

      for (const candidate of entries) {
        if (visited.has(candidate.slug) || candidate.slug === current.slug) continue
        if (!canCrossMerge(current, candidate)) continue
        queue.push(candidate)
      }
    }

    groups.push(group)
  }

  const promoted = groups
    .map((group) => {
      const hasFamily = group.some(isAccessoryFamily)
      if (group.length <= 1 || hasFamily) return group
      if (!allMutuallyConnected(group) && getSharedTitleTokens(group).length < 2) return group
      return [buildFamilyFromGroup(group)]
    })
    .flat()

  return rewriteRelatedRefsForPromotedFamilies(applySpecialFamilies(promoted))
}
