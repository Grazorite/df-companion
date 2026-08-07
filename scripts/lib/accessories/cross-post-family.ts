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
import {
  computeFamilyFlags,
  normalizeLevel,
  normalizeRomanDisplay,
} from '../../../src/utils/variantHelpers.ts'
import { shouldPromoteConnectedFamilyGroup } from '../cross-post-family.ts'
import { dedupeSameSlugPreferFamily } from '../family-merge-guard.ts'
import { distributeSharedNoteLines } from '../note-cleaning.ts'
import { slugify } from '../text.ts'

const ENABLED_SUBTYPES = new Set<AccessorySubtype>(['helm', 'cape-wing'])
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

// Cross-post promotion compares every entry pairwise (O(n^2)), and each
// comparison normalizes the same names repeatedly. Memoizing this pure,
// regex-heavy transform keyed by the exact input string is output-equivalent
// and removes the redundant work.
const normalizeLookupNameCache = new Map<string, string>()

function normalizeLookupName(name: string): string {
  const cached = normalizeLookupNameCache.get(name)
  if (cached !== undefined) return cached

  const normalized = name
    .toLowerCase()
    .replace(/\s+\((?:all versions|[ivxlcdm]+(?:-[ivxlcdm]+)?|\d+)\)$/i, '')
    .replace(/[^\w\s']+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  normalizeLookupNameCache.set(name, normalized)
  return normalized
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
      return normalizeRomanDisplay(
        token.replace(/\b\w/g, (char) => char.toUpperCase()).replace(/'S\b/g, "'s")
      )
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
  const worldCupFamilyName = deriveWorldCupFamilyName(entries)
  if (worldCupFamilyName) return worldCupFamilyName

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

function deriveWorldCupFamilyName(entries: AccessoryEntry[]): string | undefined {
  const countries = entries
    .map((entry) =>
      getDisplayName(entry)
        .match(/^World Cup 2010 Cape(?:\s+II)?:\s*(.+)$/i)?.[1]
        ?.trim()
    )
    .filter((country): country is string => Boolean(country))

  if (countries.length !== entries.length) return undefined
  if (!countries.every((country) => country.toLowerCase() === countries[0].toLowerCase())) {
    return undefined
  }

  return `World Cup 2010 Cape: ${countries[0]}`
}

function deriveVariantName(name: string, familyName: string): string | undefined {
  const normalizedName = normalizeLookupName(name)
  const normalizedFamily = normalizeLookupName(familyName)
  const parenthetical = familyName.match(/^(.*?)\s*\(([^)]+)\)\s*$/)
  const nameTokens = tokenizeTitle(name)
  const familyTokens = tokenizeTitle(familyName)

  if (parenthetical) {
    const rawBaseName = parenthetical[1].trim()
    const baseName = normalizeLookupName(rawBaseName)
    const trimmedName = name.trim()
    if (trimmedName === rawBaseName) return '(Base)'
    if (trimmedName.startsWith(`${rawBaseName} (`) && trimmedName.endsWith(')')) {
      return trimmedName.slice(rawBaseName.length).trim()
    }
    if (normalizedName.startsWith(`${baseName} `)) {
      const suffix = normalizedName.slice(baseName.length).trim()
      return suffix ? titleCaseFromTokens(suffix.split(/\s+/)) : '(Base)'
    }
  }

  if (normalizedName === normalizedFamily) return '(Base)'

  if (normalizedName.endsWith(` ${normalizedFamily}`)) {
    const prefix = normalizedName.slice(0, normalizedName.length - normalizedFamily.length).trim()
    return prefix ? titleCaseFromTokens(prefix.split(/\s+/)) : '(Base)'
  }

  if (normalizedName.startsWith(`${normalizedFamily} `)) {
    const suffix = normalizedName.slice(normalizedFamily.length).trim()
    return suffix ? titleCaseFromTokens(suffix.split(/\s+/)) : '(Base)'
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
  if (!hasStrongTitleFamily(a, b)) return hasNonTitleContentEvidence(a, b)
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
      // Scoped scrapes often post-process only one subtype. Preserve explicit
      // cross-subtype forum refs even when the target slug is not in the current
      // in-memory slice; the UI can resolve them after loading all accessory data.
      .filter((ref) => knownSlugs.has(ref.slug) || Boolean(ref.url))

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
  const sortedVariants = sortVariants(
    sorted.flatMap((entry, index) =>
      isAccessoryFamily(entry)
        ? flattenFamilyVariants(entry)
        : [buildVariantFromAccessory(entry, familyName, index)]
    )
  )
  const { sharedNotes, variants } = distributeSharedNoteLines(sortedVariants)
  const descriptions = variants
    .map((variant) => variant.description)
    .filter((value): value is string => Boolean(value))
  const imageUrls = variants
    .map((variant) => variant.imageUrl)
    .filter((value): value is string => Boolean(value))
  const alternativeImages = uniqueAlternativeImages(
    variants.flatMap((variant) => variant.alternativeImages ?? [])
  )
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
      ...(sharedNotes ? { notes: sharedNotes } : {}),
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
    isCosmetic: sorted.some((entry) => entry.isCosmetic) || undefined,
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
  const sortedVariants = matchedEntries.flatMap((entry) =>
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
  const { sharedNotes: distributedSharedNotes, variants } =
    distributeSharedNoteLines(sortedVariants)
  const imageUrls = variants
    .map((variant) => variant.imageUrl)
    .filter((value): value is string => Boolean(value))
  const alternativeImages = uniqueAlternativeImages(
    variants.flatMap((variant) => variant.alternativeImages ?? [])
  )
  const sharedNotes = spec.notes ?? distributedSharedNotes
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
      ...(sharedNotes ? { notes: sharedNotes } : {}),
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
    isCosmetic: matchedEntries.some((entry) => entry.isCosmetic) || undefined,
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

function hasExactFamilyNameVariant(family: AccessoryFamily): boolean {
  const familyName = normalizeLookupName(family.familyName)
  return family.levelVariants.some((variant) => normalizeLookupName(variant.name) === familyName)
}

function renameFamilyToFirstVariant(family: AccessoryFamily): AccessoryFamily {
  const firstVariant = family.levelVariants[0]
  if (
    !firstVariant?.name ||
    normalizeLookupName(firstVariant.name) === normalizeLookupName(family.familyName)
  ) {
    return family
  }

  return {
    ...family,
    familyName: firstVariant.name,
    levelVariants: family.levelVariants.map((variant, index) =>
      index === 0 ? { ...variant, variantName: '(Base)' } : variant
    ),
  }
}

function disambiguateDuplicateFamilyNames(entries: AccessoryEntry[]): AccessoryEntry[] {
  const familyGroups = new Map<string, AccessoryFamily[]>()

  for (const entry of entries) {
    if (!isAccessoryFamily(entry) || entry.familyOrigin !== 'cross-post') continue
    const key = `${entry.subtype}:${normalizeLookupName(entry.familyName)}`
    familyGroups.set(key, [...(familyGroups.get(key) ?? []), entry])
  }

  const renamedBySlug = new Map<string, AccessoryFamily>()
  for (const families of familyGroups.values()) {
    if (families.length <= 1) continue
    for (const family of families) {
      if (hasExactFamilyNameVariant(family)) continue
      renamedBySlug.set(family.slug, renameFamilyToFirstVariant(family))
    }
  }

  if (renamedBySlug.size === 0) return entries
  return entries.map((entry) => renamedBySlug.get(entry.slug) ?? entry)
}

function sourceMatchesVariant(source: FamilySourceRef, variant: LevelVariant): boolean {
  const sourceUrl = variant.sourceUrl
  if (sourceUrl && source.url === sourceUrl) return true

  const sourceLabel = normalizeLookupName(source.variantLabel ?? source.title)
  return sourceLabel.includes(normalizeLookupName(variant.name))
}

function buildCiderKegSplitFamily(
  baseFamily: AccessoryFamily,
  familyName: string,
  slug: string,
  variants: LevelVariant[]
): AccessoryFamily {
  const renumberedVariants = variants.map((variant, index) => ({
    ...variant,
    levelNumber: index + 1,
  }))
  const sources = (baseFamily.familySources ?? []).filter((source) =>
    renumberedVariants.some((variant) => sourceMatchesVariant(source, variant))
  )
  const aliasSlugs =
    familyName === 'Cider Keg'
      ? [
          'accessory-sweet-cider-keg',
          'accessory-warm-cider-keg',
          'accessory-bubbly-cider-keg',
          'accessory-moglinberry-cider-keg',
        ]
      : [
          'accessory-sweet-void-cider-keg',
          'accessory-warm-void-cider-keg',
          'accessory-bubbly-void-cider-keg',
          'accessory-moglinberry-void-cider-keg',
        ]

  return computeFamilyFlags({
    ...baseFamily,
    id: slug,
    familyName,
    slug,
    aliasSlugs,
    familySources: sources,
    shared: baseFamily.shared,
    levelVariants: renumberedVariants,
  })
}

function buildCobaltDragonWingsFamily(
  baseFamily: AccessoryFamily,
  familyName: string,
  slug: string,
  variants: LevelVariant[],
  notes: string
): AccessoryFamily {
  const renumberedVariants = variants.map((variant, index) => ({
    ...variant,
    levelNumber: index + 1,
  }))
  const sources = (baseFamily.familySources ?? []).filter((source) =>
    renumberedVariants.some((variant) => sourceMatchesVariant(source, variant))
  )
  const imageUrls = renumberedVariants
    .map((variant) => variant.imageUrl)
    .filter((value): value is string => Boolean(value))
  const { alsoSee: _alsoSee, ...sharedWithoutAlsoSee } = baseFamily.shared

  return computeFamilyFlags({
    ...baseFamily,
    id: slug,
    familyName,
    slug,
    aliasSlugs: renumberedVariants.map((variant) => `accessory-${slugify(variant.name)}`),
    familySources: sources,
    shared: {
      ...sharedWithoutAlsoSee,
      ...(imageUrls.length > 0 && allSame(imageUrls) ? { imageUrl: imageUrls[0] } : {}),
      notes,
    },
    levelVariants: renumberedVariants,
  })
}

function splitCobaltDragonWingsFamilies(entries: AccessoryEntry[]): AccessoryEntry[] {
  return entries.flatMap((entry) => {
    if (
      !isAccessoryFamily(entry) ||
      entry.subtype !== 'cape-wing' ||
      normalizeLookupName(entry.familyName) !== 'dragon wings' ||
      !entry.levelVariants.some((variant) => /cobalt/i.test(variant.name))
    ) {
      return [entry]
    }

    const normalVariants = entry.levelVariants.filter(
      (variant) => /cobalt dragon wings$/i.test(variant.name) && !/half-dragon/i.test(variant.name)
    )
    const halfOffVariants = entry.levelVariants.filter((variant) =>
      /cobalt half-dragon wings$/i.test(variant.name)
    )

    if (normalVariants.length === 0 || halfOffVariants.length === 0) return [entry]

    const normalFamily = buildCobaltDragonWingsFamily(
      entry,
      'Cobalt Dragon Wings',
      'accessory-cobalt-dragon-wings',
      normalVariants,
      'Normal'
    )
    const halfOffFamily = buildCobaltDragonWingsFamily(
      entry,
      'Cobalt Half-Dragon Wings',
      'accessory-cobalt-half-dragon-wings',
      halfOffVariants,
      'Half-off'
    )

    return [
      setAlsoSee(normalFamily, [getFamilyRef(halfOffFamily)]) as AccessoryFamily,
      setAlsoSee(halfOffFamily, [getFamilyRef(normalFamily)]) as AccessoryFamily,
    ]
  })
}

function splitCiderKegFamilies(entries: AccessoryEntry[]): AccessoryEntry[] {
  return entries.flatMap((entry) => {
    if (
      !isAccessoryFamily(entry) ||
      entry.subtype !== 'cape-wing' ||
      normalizeLookupName(entry.familyName) !== 'cider keg'
    ) {
      return [entry]
    }

    const nonVoidNames = new Set([
      'cider keg',
      'sweet cider keg',
      'warm cider keg',
      'spiced cider keg',
      'mulled cider keg',
      'foamy cider keg',
      'bubbly cider keg',
      'moglinberry cider keg',
    ])
    const voidVariantNames = new Map([
      ['void cider keg', '(Base)'],
      ['sweet void cider keg', 'Sweet'],
      ['warm void cider keg', 'Warm'],
      ['spiced cider keg', 'Spiced'],
      ['mulled cider keg', 'Mulled'],
      ['foamy cider keg', 'Foamy'],
      ['bubbly void cider keg', 'Bubbly'],
      ['moglinberry void cider keg', 'Moglinberry'],
    ])
    const nonVoidVariants = entry.levelVariants.filter((variant) =>
      nonVoidNames.has(normalizeLookupName(variant.name))
    )
    const voidVariants = entry.levelVariants
      .filter((variant) => voidVariantNames.has(normalizeLookupName(variant.name)))
      .map((variant) => ({
        ...variant,
        variantName: voidVariantNames.get(normalizeLookupName(variant.name))!,
      }))

    if (nonVoidVariants.length === 0 || voidVariants.length === 0) return [entry]

    const nonVoidFamily = buildCiderKegSplitFamily(
      entry,
      'Cider Keg',
      'accessory-cider-keg',
      nonVoidVariants
    )
    const voidFamily = buildCiderKegSplitFamily(
      entry,
      'Void Cider Keg',
      'accessory-void-cider-keg',
      voidVariants
    )

    return [
      setAlsoSee(nonVoidFamily, [getFamilyRef(voidFamily)]) as AccessoryFamily,
      setAlsoSee(voidFamily, [getFamilyRef(nonVoidFamily)]) as AccessoryFamily,
    ]
  })
}

function dedupeEntriesBySlug(entries: AccessoryEntry[]): AccessoryEntry[] {
  return dedupeSameSlugPreferFamily(entries, isAccessoryFamily)
}

function removeCobaltDragonWingAliasEntries(entries: AccessoryEntry[]): AccessoryEntry[] {
  const cobaltAliasSlugs = new Set(
    entries
      .filter(
        (entry): entry is AccessoryFamily =>
          isAccessoryFamily(entry) &&
          /^(?:Cobalt Dragon Wings|Cobalt Half-Dragon Wings)$/i.test(entry.familyName)
      )
      .flatMap((entry) => entry.aliasSlugs ?? [])
  )

  if (cobaltAliasSlugs.size === 0) return entries
  return entries.filter(
    (entry) =>
      !cobaltAliasSlugs.has(entry.slug) || !/cobalt .*dragon wings/i.test(getDisplayName(entry))
  )
}

function linkSiblingFamilies(entries: AccessoryEntry[]): AccessoryEntry[] {
  const siblingGroups = [
    ['Cider Keg', 'Void Cider Keg'],
    ['Cider Mug', 'Void Cider Mug'],
    ['Mantle of Shadows', 'Invisible Cape', 'Cloak of Shadows', 'Wrap of Shadows'],
  ]
  const familyByName = new Map<string, AccessoryFamily>()

  for (const entry of entries) {
    if (!isAccessoryFamily(entry)) continue
    familyByName.set(normalizeLookupName(entry.familyName), entry)
  }

  const updatedBySlug = new Map<string, AccessoryFamily>()
  for (const siblingGroup of siblingGroups) {
    const siblings = siblingGroup
      .map((name) => familyByName.get(normalizeLookupName(name)))
      .filter((family): family is AccessoryFamily => Boolean(family))
    if (siblings.length !== siblingGroup.length) continue

    for (const family of siblings) {
      const siblingRefs = siblings
        .filter((sibling) => sibling.slug !== family.slug)
        .map(getFamilyRef)
      updatedBySlug.set(
        family.slug,
        setAlsoSee(family, [...getAlsoSee(family), ...siblingRefs]) as AccessoryFamily
      )
    }
  }

  if (updatedBySlug.size === 0) return entries
  return entries.map((entry) => updatedBySlug.get(entry.slug) ?? entry)
}

/**
 * Drop standalone (non-family) entries whose slug is already claimed as an
 * alias of a promoted family. When a family declares slug X as an alias it is
 * asserting "X is one of my variants", so a separate standalone X is a
 * duplicate that should be absorbed. Generalizes the Cobalt-specific cleanup to
 * every family (e.g. "Grape Poncho" under "Plum Poncho", the duplicate
 * standalone "Pumpkin Mask" under "Pumpkin (Mask, Helm)").
 */
export function removeStandalonesClaimedByFamilies(entries: AccessoryEntry[]): AccessoryEntry[] {
  const familyAliasSlugs = new Set<string>()
  for (const entry of entries) {
    if (!isAccessoryFamily(entry)) continue
    for (const alias of entry.aliasSlugs ?? []) {
      if (alias !== entry.slug) familyAliasSlugs.add(alias)
    }
  }

  if (familyAliasSlugs.size === 0) return entries
  return entries.filter((entry) => isAccessoryFamily(entry) || !familyAliasSlugs.has(entry.slug))
}

/**
 * Link distinct families that share the same bare alias slug (the same base
 * name across different releases, e.g. "Aegis Mask (2011)" and
 * "Aegis Mask (2014)"). Such items are genuinely separate and must stay
 * separate, but the shared bare alias cannot canonicalize deterministically, so
 * it is removed from the siblings and replaced with mutual "Also See" links.
 */
export function linkSharedAliasSiblingFamilies(entries: AccessoryEntry[]): AccessoryEntry[] {
  const aliasToFamilies = new Map<string, AccessoryFamily[]>()
  for (const entry of entries) {
    if (!isAccessoryFamily(entry)) continue
    for (const alias of new Set(entry.aliasSlugs ?? [])) {
      if (alias === entry.slug) continue
      const claimants = aliasToFamilies.get(alias) ?? []
      if (!claimants.some((family) => family.slug === entry.slug)) claimants.push(entry)
      aliasToFamilies.set(alias, claimants)
    }
  }

  const siblingSlugs = new Map<string, Set<string>>() // family slug -> sibling family slugs
  const ambiguousAliases = new Map<string, Set<string>>() // family slug -> aliases to drop
  for (const [alias, claimants] of aliasToFamilies) {
    if (claimants.length < 2) continue
    for (const family of claimants) {
      const links = siblingSlugs.get(family.slug) ?? new Set<string>()
      for (const other of claimants) {
        if (other.slug !== family.slug) links.add(other.slug)
      }
      siblingSlugs.set(family.slug, links)

      const drop = ambiguousAliases.get(family.slug) ?? new Set<string>()
      drop.add(alias)
      ambiguousAliases.set(family.slug, drop)
    }
  }

  if (siblingSlugs.size === 0) return entries

  const familyBySlug = new Map(
    entries.filter(isAccessoryFamily).map((family) => [family.slug, family])
  )

  return entries.map((entry) => {
    if (!isAccessoryFamily(entry)) return entry
    const links = siblingSlugs.get(entry.slug)
    if (!links) return entry

    const siblingRefs = [...links]
      .map((slug) => familyBySlug.get(slug))
      .filter((family): family is AccessoryFamily => Boolean(family))
      .map(getFamilyRef)
    const withRefs = setAlsoSee(entry, [...getAlsoSee(entry), ...siblingRefs]) as AccessoryFamily

    const drop = ambiguousAliases.get(entry.slug) ?? new Set<string>()
    const filteredAliases = (entry.aliasSlugs ?? []).filter((alias) => !drop.has(alias))
    const { aliasSlugs: _aliasSlugs, ...withoutAliases } = withRefs
    return filteredAliases.length
      ? { ...withoutAliases, aliasSlugs: filteredAliases }
      : withoutAliases
  })
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
      if (!shouldPromoteConnectedFamilyGroup(group, isAccessoryFamily)) return group
      if (group.some(isAccessoryFamily)) return [buildFamilyFromGroup(group)]
      if (!allMutuallyConnected(group) && getSharedTitleTokens(group).length < 2) return group
      return [buildFamilyFromGroup(group)]
    })
    .flat()

  const consolidated = removeCobaltDragonWingAliasEntries(
    linkSiblingFamilies(
      splitCobaltDragonWingsFamilies(
        splitCiderKegFamilies(disambiguateDuplicateFamilyNames(applySpecialFamilies(promoted)))
      )
    )
  )
  const linked = linkSharedAliasSiblingFamilies(consolidated)
  const deduped = removeStandalonesClaimedByFamilies(dedupeEntriesBySlug(linked))
  return rewriteRelatedRefsForPromotedFamilies(deduped)
}
