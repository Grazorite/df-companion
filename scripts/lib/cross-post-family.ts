import type { Guest, Pet } from '../../src/types/pet.ts'
import type { AlternativeImage, AlsoSeeRef, FamilySourceRef, ItemFamily, LevelVariant, VariantAttack } from '../../src/types/item.ts'
import { computeFamilyFlags, normalizeLevel } from '../../src/utils/variantHelpers.ts'

function isItemFamily(item: Pet | ItemFamily): item is ItemFamily {
  return 'levelVariants' in item && 'familyName' in item
}

function getDisplayName(item: Pet | ItemFamily): string {
  return isItemFamily(item) ? item.familyName : item.name
}

function normalizeLookupName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+\((all versions|[ivxlcdm]+(?:-[ivxlcdm]+)?|\d+)\)$/i, '')
    .replace(/[^\w\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeRefLookupName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,!?]+$/, '')
    .replace(/\s+\((all versions|[ivx]+-[ivx]+)\)$/i, '')
    .replace(/\s+\((i,\s*ii(?:,\s*iii)?|lieutenant,\s*general|kitten,\s*cat)\)$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractNumericVariantBase(name: string): string | undefined {
  if (!/\(\d+\)\s*$/i.test(name)) return undefined
  const base = normalizeLookupName(name.replace(/\s+\(\d+\)\s*$/i, ''))
  return base || undefined
}

function tokenizeTitle(name: string): string[] {
  const tokens = normalizeLookupName(name).split(' ').filter(Boolean)
  while (tokens.length > 0 && /^(jr|sr)$/.test(tokens[tokens.length - 1])) {
    tokens.pop()
  }
  return tokens
}

function getLongestCommonSuffix(tokensList: string[][]): string[] {
  if (tokensList.length === 0) return []
  const reversed = tokensList.map(tokens => [...tokens].reverse())
  const result: string[] = []
  let index = 0

  while (true) {
    const candidate = reversed[0][index]
    if (!candidate) break
    if (reversed.every(tokens => tokens[index] === candidate)) {
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
    if (tokensList.every(tokens => tokens[index] === candidate)) {
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
    .map(token => token.replace(/\b\w/g, char => char.toUpperCase()))
    .join(' ')
}

function trimNumericQualifierFromSuffix(suffix: string[], tokenSets: string[][]): string[] {
  if (suffix.length <= 1) return suffix

  const shouldTrim = tokenSets.every(tokens => {
    const precedingIndex = tokens.length - suffix.length - 1
    if (precedingIndex < 0) return false
    return /^\d+$/.test(tokens[precedingIndex] ?? '')
  })

  return shouldTrim ? suffix.slice(1) : suffix
}

function deriveFamilyName(items: Array<Pet | ItemFamily>): string {
  const displayNames = items.map(getDisplayName)
  const normalizedWithoutTrailingVariants = displayNames.map(name =>
    name.replace(/\s+\((?:all versions|[ivxlcdm]+(?:-[ivxlcdm]+)?|\d+)\)$/i, '').trim()
  )
  const exactMatch = normalizedWithoutTrailingVariants[0]

  if (
    exactMatch &&
    normalizedWithoutTrailingVariants.every(name => normalizeLookupName(name) === normalizeLookupName(exactMatch))
  ) {
    return exactMatch
  }

  const tokenSets = normalizedWithoutTrailingVariants.map(tokenizeTitle)
  const prefix = getLongestCommonPrefix(tokenSets)
  const suffix = trimNumericQualifierFromSuffix(getLongestCommonSuffix(tokenSets), tokenSets)
  const prefixIsMeaningful = prefix.length > 0 && prefix.some(token => !/^\d+$/.test(token))
  const suffixStartsWithPrefix = prefix.length > 0 && suffix.slice(0, prefix.length).every((token, index) => token === prefix[index])
  if (prefixIsMeaningful && suffix.length > 0 && !suffixStartsWithPrefix) {
    return titleCaseFromTokens([...prefix, ...suffix])
  }
  if (suffix.length > 0) return titleCaseFromTokens(suffix)
  if (prefix.length > 0) return titleCaseFromTokens(prefix)

  return displayNames
    .slice()
    .sort((a, b) => a.length - b.length || a.localeCompare(b))[0]
}

function descriptionsMatch(a?: string, b?: string): boolean {
  if (!a || !b) return false
  return normalizeLookupName(a) === normalizeLookupName(b)
}

function imagesMatch(a?: string, b?: string): boolean {
  return Boolean(a && b && a === b)
}

function sharesExplicitReference(a: Pet | ItemFamily, b: Pet | ItemFamily): boolean {
  const aRefs = isItemFamily(a) ? a.shared.alsoSee ?? [] : a.alsoSee
  const bRefs = isItemFamily(b) ? b.shared.alsoSee ?? [] : b.alsoSee
  const aNames = new Set(aRefs.map(ref => normalizeLookupName(ref.name)))
  const bNames = new Set(bRefs.map(ref => normalizeLookupName(ref.name)))
  const aName = normalizeLookupName(getDisplayName(a))
  const bName = normalizeLookupName(getDisplayName(b))
  return aNames.has(bName) || bNames.has(aName)
}

function sharesNumericVariantBase(a: Pet | ItemFamily, b: Pet | ItemFamily): boolean {
  const aBase = extractNumericVariantBase(getDisplayName(a))
  const bBase = extractNumericVariantBase(getDisplayName(b))
  return Boolean(aBase && bBase && aBase === bBase)
}

function sharesGuestFamilyVariantOverlap(a: Pet | ItemFamily, b: Pet | ItemFamily): boolean {
  const family = isItemFamily(a) ? a : isItemFamily(b) ? b : undefined
  const standalone = !isItemFamily(a) ? a : !isItemFamily(b) ? b : undefined
  if (!family || !standalone) return false
  if (family.type !== 'guest' || standalone.type !== 'guest') return false
  if (!(family.retired || standalone.retired)) return false

  const standaloneName = normalizeLookupName(standalone.name)
  if (!standaloneName) return false

  return family.levelVariants.some(level => {
    const variantName = normalizeLookupName(level.name)
    return Boolean(
      variantName &&
      (variantName.includes(standaloneName) || standaloneName.includes(variantName))
    )
  })
}

function sharesMeaningfulTitleFamily(a: Pet | ItemFamily, b: Pet | ItemFamily): boolean {
  const names = [getDisplayName(a), getDisplayName(b)]
  const normalized = names.map(name =>
    name.replace(/\s+\((?:all versions|[ivxlcdm]+(?:-[ivxlcdm]+)?|\d+)\)$/i, '').trim()
  )

  if (normalized.every(name => normalizeLookupName(name) === normalizeLookupName(normalized[0]))) {
    return true
  }

  const tokenSets = normalized.map(tokenizeTitle)
  const prefix = getLongestCommonPrefix(tokenSets).filter(token => !/^\d+$/.test(token))
  const suffix = trimNumericQualifierFromSuffix(getLongestCommonSuffix(tokenSets), tokenSets)
    .filter(token => !/^\d+$/.test(token))

  return prefix.length >= 2 || suffix.length >= 2
}

function getItemElements(item: Pet | ItemFamily): string[] {
  return isItemFamily(item)
    ? item.levelVariants.map(level => level.element).filter((value): value is string => Boolean(value))
    : item.elements
}

function canCrossMerge(a: Pet | ItemFamily, b: Pet | ItemFamily): boolean {
  if (a.type !== b.type) return false
  if (isItemFamily(a) && isItemFamily(b)) return false
  const hasExplicitReference = sharesExplicitReference(a, b)
  const hasNumericVariantBase = sharesNumericVariantBase(a, b)
  const hasGuestVariantOverlap = sharesGuestFamilyVariantOverlap(a, b)
  if (!hasExplicitReference && !hasNumericVariantBase && !hasGuestVariantOverlap) return false

  if (a.type === 'guest') {
    if (hasNumericVariantBase || hasGuestVariantOverlap) return true
    if (!sharesMeaningfulTitleFamily(a, b)) return false
  }

  const aElements = new Set(getItemElements(a))
  const bElements = new Set(getItemElements(b))
  if (aElements.size > 0 && bElements.size > 0) {
    const sharesElement = [...aElements].some(element => bElements.has(element))
    if (!sharesElement) return false
  }

  const aDescription = isItemFamily(a) ? a.shared.description : a.description
  const bDescription = isItemFamily(b) ? b.shared.description : b.description
  const aImage = isItemFamily(a) ? a.shared.imageUrl : a.imageUrl
  const bImage = isItemFamily(b) ? b.shared.imageUrl : b.imageUrl

  return (
    descriptionsMatch(aDescription, bDescription) ||
    imagesMatch(aImage, bImage) ||
    sharesMeaningfulTitleFamily(a, b)
  )
}

function gatherAllRefs(items: Array<Pet | ItemFamily>, internalSlugs: Set<string>): AlsoSeeRef[] {
  const refs = new Map<string, AlsoSeeRef>()

  for (const item of items) {
    const sourceRefs = isItemFamily(item) ? item.shared.alsoSee ?? [] : item.alsoSee
    for (const ref of sourceRefs) {
      if (internalSlugs.has(ref.slug)) continue
      refs.set(`${ref.type}:${ref.slug}`, ref)
    }
  }

  return Array.from(refs.values()).sort((a, b) => a.name.localeCompare(b.name))
}

function getVariantImages(pet: Pet): AlternativeImage[] | undefined {
  return pet.alternativeImages && pet.alternativeImages.length > 0 ? pet.alternativeImages : undefined
}

function buildVariantFromPet(pet: Pet): LevelVariant {
  const levelInfo = normalizeLevel(pet.level)
  const actualLevel = /^\d+$/.test(pet.level.trim()) ? parseInt(pet.level.trim(), 10) : undefined

  return {
    levelNumber: levelInfo.number,
    levelDisplay: levelInfo.display,
    ...(actualLevel !== undefined ? { actualLevel } : {}),
    name: pet.name,
    damage: pet.damage,
    stats: pet.stats,
    ...(pet.statsType ? { statsType: pet.statsType } : {}),
    sourceUrl: pet.forumUrl,
    description: pet.description,
    ...(pet.imageUrl ? { imageUrl: pet.imageUrl } : {}),
    ...(getVariantImages(pet) ? { alternativeImages: getVariantImages(pet) } : {}),
    obtainVariants: pet.obtainMethods.map(method => ({
      location: method.location,
      price: method.price ?? 'N/A',
      priceType: method.priceType,
      ...(method.sellback ? { sellback: method.sellback } : {}),
      ...(method.requirements ? { requirements: method.requirements } : {}),
      daRequired: method.daRequired ?? pet.daRequired,
      ...(method.dcRequired ?? pet.dcRequired ? { dcRequired: method.dcRequired ?? pet.dcRequired } : {}),
      ...(method.dmRequired ?? pet.dmRequired ? { dmRequired: method.dmRequired ?? pet.dmRequired } : {}),
      ...(method.requiredItems ? { requiredItems: method.requiredItems } : {}),
    })),
    ...(pet.elements[0] ? { element: pet.elements[0] } : {}),
    ...(pet.resists && pet.resists !== 'None' ? { resists: pet.resists } : {}),
    ...(pet.rarity && pet.rarity !== 'Unknown' ? { rarity: pet.rarity } : {}),
    ...(pet.attacks.length > 0 ? { attacks: pet.attacks as VariantAttack[] } : {}),
    ...('guestStats' in pet ? { guestStats: (pet as unknown as Guest).guestStats } : {}),
    ...(pet.notes ? { notes: pet.notes } : {}),
  }
}

function flattenFamilyVariants(family: ItemFamily): LevelVariant[] {
  return family.levelVariants.map(level => ({
    ...level,
    sourceUrl: level.sourceUrl ?? family.forumUrl,
  }))
}

function mergeTags(items: Array<Pet | ItemFamily>): string[] {
  return Array.from(
    new Set(
      items.flatMap(item => item.tags)
    )
  ).sort()
}

function mergeSources(items: Array<Pet | ItemFamily>, familyName: string): FamilySourceRef[] {
  const refs = new Map<string, FamilySourceRef>()

  for (const item of items) {
    if (isItemFamily(item) && item.familySources?.length) {
      for (const ref of item.familySources) {
        refs.set(`${ref.url}:${ref.variantLabel ?? ''}`, ref)
      }
      continue
    }

    const title = `DF Encyclopedia: ${getDisplayName(item)}`
    refs.set(item.forumUrl, {
      url: item.forumUrl,
      title,
      ...(getDisplayName(item) !== familyName ? { variantLabel: getDisplayName(item) } : {}),
      isPrimary: refs.size === 0,
    })
  }

  return Array.from(refs.values())
}

function sortSourcesByLevels(
  sources: FamilySourceRef[],
  levels: LevelVariant[]
): FamilySourceRef[] {
  const sourceByUrl = new Map(sources.map(source => [source.url, source]))
  const seenUrls = new Set<string>()
  const orderedSources = levels
    .map(level => {
      if (!level.sourceUrl || seenUrls.has(level.sourceUrl)) return undefined
      const source = sourceByUrl.get(level.sourceUrl)
      if (!source) return undefined
      seenUrls.add(level.sourceUrl)
      return source
    })
    .filter((source): source is FamilySourceRef => Boolean(source))

  orderedSources.push(...sources.filter(source => !seenUrls.has(source.url)))

  return orderedSources.map((source, index) => ({
    ...source,
    isPrimary: index === 0,
  }))
}

function allSame<T>(values: T[]): boolean {
  if (values.length <= 1) return true
  return values.every(value => JSON.stringify(value) === JSON.stringify(values[0]))
}

function getTrailingNumericVariant(level: LevelVariant): number | undefined {
  const source = level.variantName ?? level.name
  const match = source.match(/\((\d+)\)\s*$/)
  return match ? Number.parseInt(match[1], 10) : undefined
}

function shouldSortByTrailingNumericVariant(levels: LevelVariant[]): boolean {
  const numericVariants = levels.map(getTrailingNumericVariant)
  return numericVariants.length > 1 && numericVariants.every((value): value is number => value !== undefined)
}

function sortAndRenumberVariants(levels: LevelVariant[]): LevelVariant[] {
  const sortByNumericVariant = shouldSortByTrailingNumericVariant(levels)

  return levels
    .slice()
    .sort((a, b) => {
      if (sortByNumericVariant) {
        const aVariant = getTrailingNumericVariant(a) ?? 0
        const bVariant = getTrailingNumericVariant(b) ?? 0
        if (aVariant !== bVariant) return aVariant - bVariant
      }

      const aLevel = a.actualLevel ?? a.levelNumber
      const bLevel = b.actualLevel ?? b.levelNumber
      if (aLevel !== bLevel) return aLevel - bLevel
      return a.name.localeCompare(b.name)
    })
    .map((level, index) => ({
      ...level,
      levelNumber: index + 1,
    }))
}

function buildFamilyFromGroup(items: Array<Pet | ItemFamily>): ItemFamily {
  const sorted = items.slice().sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)))
  const familyAnchor = sorted.find(isItemFamily)
  const familyName = deriveFamilyName(sorted)
  const canonicalSlug = familyAnchor?.slug ?? `${sorted[0].type}-${familyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`
  const canonicalId = familyAnchor?.id ?? canonicalSlug
  const forumUrl = familyAnchor?.forumUrl ?? sorted[0].forumUrl
  const allLevels = sortAndRenumberVariants(
    sorted.flatMap(item => (isItemFamily(item) ? flattenFamilyVariants(item) : [buildVariantFromPet(item)]))
  )
  const internalSlugs = new Set(sorted.map(item => item.slug))
  const aliasSlugs = Array.from(internalSlugs).filter(slug => slug !== canonicalSlug)
  const descriptions = allLevels.map(level => level.description).filter((value): value is string => Boolean(value))
  const imageUrls = allLevels.map(level => level.imageUrl).filter((value): value is string => Boolean(value))
  const alternativeImages = allLevels
    .map(level => level.alternativeImages)
    .filter((value): value is AlternativeImage[] => Boolean(value && value.length > 0))
  const notes = allLevels.map(level => level.notes).filter((value): value is string => Boolean(value))
  const attacks = allLevels
    .map(level => level.attacks)
    .filter((value): value is VariantAttack[] => Boolean(value && value.length > 0))
  const baseAlsoSee = gatherAllRefs(sorted, internalSlugs)
  const baseDescription =
    descriptions.length > 0 && allSame(descriptions) ? descriptions[0] : (allLevels[0].description ?? (isItemFamily(sorted[0]) ? sorted[0].shared.description : sorted[0].description))
  const anchorImageUrl = familyAnchor?.shared.imageUrl
  const anchorAlternativeImages = familyAnchor?.shared.alternativeImages
  const baseImageUrl = anchorImageUrl ?? (
    imageUrls.length > 0
      ? (allSame(imageUrls) ? imageUrls[0] : (sorted[0].type === 'guest' ? imageUrls.at(-1) : imageUrls[0]))
      : undefined
  )
  const baseAlternativeImages = anchorAlternativeImages ?? (
    alternativeImages.length > 0
      ? (allSame(alternativeImages) ? alternativeImages[0] : (sorted[0].type === 'guest' ? alternativeImages.at(-1) : alternativeImages[0]))
      : undefined
  )
  const baseAttacks = attacks.length > 0 && allSame(attacks) ? attacks[0] : undefined
  const baseNotes = notes.length > 0 && allSame(notes) ? notes[0] : undefined
  const baseElement = allLevels.every(level => level.element && level.element === allLevels[0].element) ? allLevels[0].element : undefined
  const resists = allLevels.map(level => level.resists).filter((value): value is string => Boolean(value))
  const rarities = allLevels.map(level => level.rarity).filter((value): value is string => Boolean(value))
  const baseResists = resists.length > 0 && allSame(resists) ? resists[0] : undefined
  const baseRarity = rarities.length > 0 && allSame(rarities) ? rarities[0] : undefined
  const releaseDateCandidates = sorted
    .map(item => item.releaseDate)
    .filter((value): value is string => Boolean(value) && value !== 'Unknown')
    .sort()

  const mergedFamily: ItemFamily = {
    id: canonicalId,
    familyName,
    slug: canonicalSlug,
    ...(aliasSlugs.length > 0 ? { aliasSlugs } : {}),
    type: sorted[0].type,
    forumUrl,
    familyOrigin: 'cross-post',
    familySources: sortSourcesByLevels(mergeSources(sorted, familyName), allLevels),
    shared: {
      description: baseDescription,
      ...(baseImageUrl ? { imageUrl: baseImageUrl } : {}),
      ...(baseAlternativeImages ? { alternativeImages: baseAlternativeImages } : {}),
      ...(baseElement ? { element: baseElement } : {}),
      ...(baseResists && baseResists !== 'None' ? { resists: baseResists } : {}),
      ...(baseRarity && baseRarity !== 'Unknown' ? { rarity: baseRarity } : {}),
      ...(baseAttacks ? { attacks: baseAttacks } : {}),
      ...(baseNotes ? { notes: baseNotes } : {}),
      ...(baseAlsoSee.length > 0 ? { alsoSee: baseAlsoSee } : {}),
    },
    levelVariants: allLevels,
    ...(releaseDateCandidates.length > 0 ? { releaseDate: releaseDateCandidates[0] } : {}),
    tags: mergeTags(sorted),
    hasDA: false,
    hasDC: false,
    hasDM: false,
    hasFree: false,
    hasMerge: false,
    isTemp: sorted.some(item => item.isTemp),
    isRare: sorted.some(item => item.isRare),
    isSeasonal: sorted.some(item => item.isSeasonal),
    isSpecialOffer: sorted.some(item => item.isSpecialOffer),
    retired: sorted.some(item => item.retired === true),
    levelRange: '',
    elements: Array.from(new Set(sorted.flatMap(item => (isItemFamily(item) ? item.elements : item.elements)))),
  }

  return computeFamilyFlags(mergedFamily)
}

export function promoteCrossPostFamilies(items: Array<Pet | ItemFamily>): Array<Pet | ItemFamily> {
  const visited = new Set<string>()
  const groups: Array<Array<Pet | ItemFamily>> = []

  for (const item of items) {
    if (visited.has(item.slug)) continue
    const queue = [item]
    const group: Array<Pet | ItemFamily> = []

    while (queue.length > 0) {
      const current = queue.shift()!
      if (visited.has(current.slug)) continue
      visited.add(current.slug)
      group.push(current)

      for (const candidate of items) {
        if (visited.has(candidate.slug) || candidate.slug === current.slug) continue
        if (!canCrossMerge(current, candidate)) continue
        queue.push(candidate)
      }
    }

    groups.push(group)
  }

  return groups.map(group => {
    const hasStandalone = group.some(item => !isItemFamily(item))
    const familyCount = group.filter(isItemFamily).length
    if (group.some(item => item.type === 'guest')) {
      return group
    }
    if (group.length <= 1 || !hasStandalone || familyCount > 1) {
      return group
    }

    return [buildFamilyFromGroup(group)]
  }).flat()
}

export function canonicalizePromotedRelationships(items: Array<Pet | ItemFamily>): Array<Pet | ItemFamily> {
  const slugToCanonical = new Map<string, { slug: string; type: Pet['type'] }>()
  const nameToCanonical = new Map<string, { slug: string; type: Pet['type'] }>()

  for (const item of items) {
    const displayName = getDisplayName(item)
    const canonical = { slug: item.slug, type: item.type as Pet['type'] }
    slugToCanonical.set(item.slug, canonical)
    nameToCanonical.set(displayName.toLowerCase(), canonical)
    nameToCanonical.set(normalizeRefLookupName(displayName), canonical)

    if (isItemFamily(item)) {
      for (const aliasSlug of item.aliasSlugs ?? []) {
        slugToCanonical.set(aliasSlug, canonical)
      }
      for (const source of item.familySources ?? []) {
        const sourceLabel = source.variantLabel ?? source.title.replace(/^DF Encyclopedia:\s*/i, '')
        nameToCanonical.set(sourceLabel.toLowerCase(), canonical)
        nameToCanonical.set(normalizeRefLookupName(sourceLabel), canonical)
      }
      for (const level of item.levelVariants) {
        nameToCanonical.set(level.name.toLowerCase(), canonical)
        nameToCanonical.set(normalizeRefLookupName(level.name), canonical)
      }
    }
  }

  const resolveRef = (name: string, fallbackSlug: string, fallbackType: Pet['type']) =>
    slugToCanonical.get(fallbackSlug) ??
    nameToCanonical.get(name.toLowerCase()) ??
    nameToCanonical.get(normalizeRefLookupName(name)) ??
    { slug: fallbackSlug, type: fallbackType }

  return items.map(item => {
    if (isItemFamily(item)) {
      const alsoSee = item.shared.alsoSee
        ?.map(ref => {
          const resolved = resolveRef(ref.name, ref.slug, ref.type as Pet['type'])
          return { ...ref, slug: resolved.slug, type: resolved.type }
        })
        .filter(ref => ref.slug !== item.slug)

      return {
        ...item,
        shared: alsoSee && alsoSee.length > 0
          ? {
              ...item.shared,
              alsoSee,
            }
          : {
              ...item.shared,
              alsoSee: undefined,
            },
      }
    }

    const alsoSee = item.alsoSee
      .map(ref => {
        const resolved = resolveRef(ref.name, ref.slug, ref.type)
        return { ...ref, slug: resolved.slug, type: resolved.type }
      })
      .filter(ref => ref.slug !== item.slug)

    return {
      ...item,
      alsoSee,
      evolutions: item.evolutions.map(evolution => {
        const resolved = resolveRef(evolution.resultName, evolution.resultSlug, evolution.resultType)
        return { ...evolution, resultSlug: resolved.slug, resultType: resolved.type }
      }),
    }
  })
}
