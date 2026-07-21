/**
 * Variant Helper Utilities
 * 
 * Utility functions for working with multi-variant items, including price type
 * computation, family flag derivation, level normalization, and roman numeral parsing.
 */

import type { ItemFamily, ItemType, LevelVariant, PriceType } from '../types/item'
import { normalizeDisplayText } from './displayText'

/**
 * Compute price type from price string and required items.
 * 
 * Logic:
 * - free: "N/A", "0 Gold", or "Free" with NO required items
 * - merge: "N/A" but HAS required items (merge shop)
 * - dc: Contains "Dragon Coin" or forum shorthand like "DC"
 * - dm: Contains "Defender's Medal" or forum shorthand like "DM"
 * - gold: Default (anything else)
 * 
 * @param price - Price string from forum post
 * @param requiredItems - Optional required items string
 * @returns Computed price type
 * 
 * @example
 * computePriceType("N/A", undefined) // "free"
 * computePriceType("N/A", "1 Prince Linus") // "merge"
 * computePriceType("150 Dragon Coins", undefined) // "dc"
 * computePriceType("500 Gold", undefined) // "gold"
 */
export function computePriceType(price: string, requiredItems?: string): PriceType {
  const p = price.toLowerCase().trim()
  
  // Free: "N/A", "0 Gold", "Free" with NO required items
  // Examples: Goldfish Knight I-VII (free option), quest reward pets
  if ((p === 'n/a' || p === '0 gold' || p === 'free') && !requiredItems) {
    return 'free'
  }
  
  // Merge: "N/A" but HAS required items
  // Examples: DM shop pets (price N/A but requires medals), crafted items
  if (p === 'n/a' && requiredItems) {
    return 'merge'
  }
  
  // DC
  // Examples: Goldfish Knight I-VII (DC option: 150 Dragon Coins)
  if (p.includes('dragon coin') || p.includes(' dc')) {
    return 'dc'
  }
  
  // DM
  if (p.includes("defender's medal") || p.includes('defender medal') || p.includes(' dm')) {
    return 'dm'
  }
  
  // Default to gold
  return 'gold'
}

/**
 * Compute family-level flags from all variants.
 * 
 * Scans through all level variants and all obtain variants to determine which
 * access methods exist. These flags are used for filtering in the UI.
 * 
 * Important: An item can have multiple flags true simultaneously.
 * Example: Goldfish Knight has hasDA=true, hasDC=true, hasFree=true because:
 * - Free option at IV-VII requires DA (hasDA)
 * - DC purchase option exists (hasDC)
 * - Free option exists at all levels (hasFree)
 * 
 * @param family - ItemFamily object (must have levelVariants populated)
 * @returns Updated ItemFamily with computed flags
 * 
 * @example
 * const family = {
 *   ...baseData,
 *   levelVariants: [
 *     {
 *       levelNumber: 1,
 *       obtainVariants: [
 *         { priceType: 'free', daRequired: false, ... },
 *         { priceType: 'dc', daRequired: false, dcRequired: true, ... }
 *       ]
 *     }
 *   ]
 * }
 * const updated = computeFamilyFlags(family)
 * // updated.hasDA = false (no variant requires DA)
 * // updated.hasDC = true (DC variant exists)
 * // updated.hasFree = true (free variant exists)
 */
export function computeFamilyFlags<T extends ItemFamily>(family: T): T {
  let hasDA = false
  let hasDC = false
  let hasDM = false
  let hasFree = false
  let hasMerge = false
  const elementSet = new Set<string>(family.elements)
  
  // Scan all level variants and their obtain variants
  for (const levelVariant of family.levelVariants) {
    // Check element (use level-specific or fallback to shared)
    const element = levelVariant.element ?? family.shared.element
    if (element) {
      elementSet.add(element)
    }
    
    // Check each obtain variant's flags and price type
    for (const obtainVariant of levelVariant.obtainVariants) {
      if (obtainVariant.daRequired) hasDA = true
      if (obtainVariant.priceType === 'dc' || obtainVariant.dcRequired) hasDC = true
      if (obtainVariant.priceType === 'dm' || obtainVariant.dmRequired) hasDM = true
      if (obtainVariant.priceType === 'free') hasFree = true
      if (obtainVariant.priceType === 'merge') hasMerge = true
    }
  }
  
  // Compute level range
  const firstVariant = family.levelVariants[0]
  const lastVariant = family.levelVariants.at(-1)
  const firstLevel = firstVariant
    ? String(firstVariant.actualLevel ?? firstVariant.levelDisplay)
    : 'Unknown'
  const lastLevel = lastVariant
    ? String(lastVariant.actualLevel ?? lastVariant.levelDisplay)
    : firstLevel

  const romanVariantRange = Array.from(
    new Set(
      family.levelVariants
        .map(levelVariant => levelVariant.variantName?.trim())
        .filter((variantName): variantName is string => Boolean(variantName))
        .filter(variantName => parseRomanNumeral(variantName.toUpperCase()) !== null)
    )
  )
  
  // For multi-post families (Baron (Kitten, Cat)), don't add range suffix — name already contains variants
  let levelRange: string
  if (romanVariantRange.length >= 2) {
    levelRange = `${romanVariantRange[0]}-${romanVariantRange.at(-1)}`
  } else if (family.isMultiPost) {
    // Extract variant list from name: "Baron (Kitten, Cat)" -> "(Kitten, Cat)"
    const variantMatch = family.familyName.match(/\(([^)]+)\)/)
    const variantLabel = variantMatch?.[1]?.trim()
    levelRange =
      variantLabel && /,/.test(variantLabel)
        ? variantLabel
        : `${firstLevel}-${lastLevel}`
  } else {
    // Standard range notation
    levelRange = firstLevel === lastLevel || family.levelVariants.length === 1
      ? firstLevel
      : `${firstLevel}-${lastLevel}`
  }
  
  return {
    ...family,
    hasDA,
    hasDC,
    hasDM,
    hasFree,
    hasMerge,
    levelRange,
    elements: Array.from(elementSet),
  }
}

/**
 * Parse roman numeral (I-X) or numeric string to number.
 * 
 * Used for level normalization and URL param parsing.
 * 
 * @param level - Level string (roman or numeric)
 * @returns Parsed level object with number and original display
 * 
 * @example
 * normalizeLevel("IV") // { number: 4, display: "IV" }
 * normalizeLevel("7") // { number: 7, display: "7" }
 * normalizeLevel("30") // { number: 30, display: "30" }
 */
export function normalizeLevel(level: string): { number: number; display: string } {
  const trimmed = level.trim()
  const upper = trimmed.toUpperCase()
  
  // Try roman numeral first
  const romanValue = parseRomanNumeral(upper)
  if (romanValue !== null) {
    return { number: romanValue, display: trimmed }
  }
  
  // Try numeric
  const numericValue = parseInt(trimmed, 10)
  if (!isNaN(numericValue)) {
    return { number: numericValue, display: trimmed }
  }
  
  // Fallback
  return { number: 1, display: trimmed }
}

/**
 * Parse roman numeral I-X to number.
 * 
 * Supports I (1) through X (10). Returns null if not a valid roman numeral.
 * 
 * @param s - Roman numeral string (uppercase)
 * @returns Number value or null
 * 
 * @example
 * parseRomanNumeral("I") // 1
 * parseRomanNumeral("IV") // 4
 * parseRomanNumeral("VII") // 7
 * parseRomanNumeral("X") // 10
 * parseRomanNumeral("ABC") // null
 */
export function parseRomanNumeral(s: string): number | null {
  if (!/^[IVXLCDM]+$/.test(s)) return null

  const romanValues: Record<string, number> = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
    D: 500,
    M: 1000,
  }

  let total = 0

  for (let index = 0; index < s.length; index += 1) {
    const current = romanValues[s[index]]
    const next = romanValues[s[index + 1]]

    if (!current) return null
    if (next && current < next) {
      total -= current
    } else {
      total += current
    }
  }

  return total > 0 ? total : null
}

/**
 * Check if an item family is a single-variant item.
 * 
 * Single-variant items have only 1 level and 1 obtain method. These items
 * display without the level stats table or level selector (backward compatible
 * with existing Pet display).
 * 
 * @param family - ItemFamily object
 * @returns True if single-variant (1 level, ≤1 obtain method)
 * 
 * @example
 * isSingleVariant({ levelVariants: [{ obtainVariants: [{}] }] }) // true
 * isSingleVariant({ levelVariants: [{ obtainVariants: [{}, {}] }] }) // false
 * isSingleVariant({ levelVariants: [{}, {}] }) // false
 */
export function isSingleVariant(family: ItemFamily): boolean {
  return (
    family.levelVariants.length === 1 &&
    family.levelVariants[0].obtainVariants.length <= 1
  )
}

/**
 * Check whether every variant in a family shares the same actual level.
 *
 * Used for branch-style families like Resource vs D-Coins where the meaningful
 * difference is the variant label, not the level progression.
 */
export function hasSameLevelVariants(family: ItemFamily): boolean {
  if (family.levelVariants.length <= 1) return false

  const levels = new Set(
    family.levelVariants.map(levelVariant => String(levelVariant.actualLevel ?? levelVariant.levelDisplay))
  )

  return levels.size === 1
}

function stripAccessVariantSuffix(name: string): string {
  return name.replace(/\s+\((?:D-Coins?|DC|D-Amulet|DA|D-Amulet\/D-Coins|D-Amulet\/DC|DA\/DC|Resource|Normal)\)$/i, '').trim()
}

function tokenizeVariantName(name: string): string[] {
  return normalizeDisplayText(name)
    .replace(/[()]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function tokenizeFamilyComparisonName(name: string): string[] {
  const tokens = tokenizeVariantName(name)
  while (tokens.length > 0 && /^(jr|sr)\.?$/i.test(tokens[tokens.length - 1])) {
    tokens.pop()
  }
  return tokens
}

function titleCaseTokens(tokens: string[]): string {
  return tokens
    .map(token => token.replace(/\b\w/g, character => character.toUpperCase()))
    .join(' ')
}

export function getDisplayFamilyName(family: ItemFamily): string {
  if (family.familyOrigin !== 'cross-post') return family.familyName

  const tokenSets = family.levelVariants.map(level => tokenizeFamilyComparisonName(stripAccessVariantSuffix(level.name)))
  if (tokenSets.length === 0) return family.familyName

  const reversed = tokenSets.map(tokens => [...tokens].reverse())
  const suffix: string[] = []
  let index = 0

  while (true) {
    const candidate = reversed[0][index]
    if (!candidate) break
    if (reversed.every(tokens => tokens[index]?.toLowerCase() === candidate.toLowerCase())) {
      suffix.unshift(candidate)
      index += 1
      continue
    }
    break
  }

  return suffix.length > 0 ? titleCaseTokens(suffix) : family.familyName
}

function getParentheticalVariantBaseName(familyName: string): string | undefined {
  return getParentheticalVariantParts(familyName)?.baseName
}

function getParentheticalVariantParts(familyName: string): { baseName: string; variants: string[] } | undefined {
  const match = familyName.match(/^(.*?)\s*\(([^)]+)\)\s*$/)
  if (!match) return undefined

  const variants = match[2]
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
  if (variants.length === 0) return undefined

  const knownVariantTerms = new Set(['mask', 'head', 'helm', 'hood', 'cowl'])
  if (!variants.every(variant => knownVariantTerms.has(variant.toLowerCase()))) return undefined

  return {
    baseName: normalizeDisplayText(match[1]),
    variants: variants.map(variant => normalizeDisplayText(variant)),
  }
}

export function hasParentheticalVariantFamilyName(familyName: string): boolean {
  return Boolean(getParentheticalVariantBaseName(familyName))
}

function getCondensedTitleVariant(levelName: string, familyName: string): string | undefined {
  const normalizedLevelName = stripAccessVariantSuffix(levelName)
  if (!normalizedLevelName) return undefined

  const parentheticalBaseName = familyName.replace(/\s*\([^)]*\)\s*$/, '').trim()

  if (normalizedLevelName === familyName) {
    const tailWord = familyName.split(/\s+/).at(-1)
    return tailWord && tailWord !== familyName ? tailWord : undefined
  }

  if (normalizedLevelName.startsWith(`${familyName} `)) {
    return normalizedLevelName.slice(familyName.length).trim()
  }

  if (normalizedLevelName.endsWith(` ${familyName}`)) {
    return normalizedLevelName.slice(0, normalizedLevelName.length - familyName.length).trim()
  }

  if (parentheticalBaseName && parentheticalBaseName !== familyName) {
    if (normalizedLevelName.startsWith(`${parentheticalBaseName} `)) {
      return normalizedLevelName.slice(parentheticalBaseName.length).trim()
    }

    if (normalizedLevelName.endsWith(` ${parentheticalBaseName}`)) {
      return normalizedLevelName.slice(0, normalizedLevelName.length - parentheticalBaseName.length).trim()
    }
  }

  const familyTokens = tokenizeVariantName(familyName).map(token => token.toLowerCase())
  const levelTokens = tokenizeVariantName(normalizedLevelName)
  const remainingTokens = [...levelTokens]

  for (const familyToken of familyTokens) {
    const index = remainingTokens.findIndex(token => token.toLowerCase() === familyToken)
    if (index >= 0) remainingTokens.splice(index, 1)
  }

  if (remainingTokens.length > 0) {
    return remainingTokens.join(' ')
  }

  return undefined
}

export function hasTitleDrivenVariantNames(levels: LevelVariant[], familyName: string): boolean {
  return levels.some(level => stripAccessVariantSuffix(level.name) !== familyName)
}

function extractNumericFamilyVariant(name: string, familyName?: string): string | undefined {
  if (!familyName) return undefined
  const match = normalizeDisplayText(name).match(/\((\d+)\)\s*$/)
  if (!match) return undefined
  const base = normalizeDisplayText(name.replace(/\s*\(\d+\)\s*$/, '')).trim()
  if (base === familyName) return `(${match[1]})`
  return undefined
}

interface LevelVariantLabelInfo {
  label: string
  canAddLevelSuffix: boolean
  levelLabel: string
  hasDC: boolean
  hasDA: boolean
}

function getLevelVariantLabelInfo(
  level: LevelVariant,
  familyName?: string,
  useTitleLabels: boolean = false,
  itemType?: ItemType
): LevelVariantLabelInfo {
  const levelLabel = String(level.actualLevel ?? level.levelDisplay)
  const hasDC = level.obtainVariants.some(variant => variant.dcRequired || variant.priceType === 'dc')
  const hasDA = level.obtainVariants.some(variant => variant.daRequired)
  const normalizedVariantName = level.variantName ? normalizeDisplayText(level.variantName) : undefined

  if (familyName === 'Harmonized Cowbell' && normalizedVariantName) {
    return { label: normalizedVariantName, canAddLevelSuffix: false, levelLabel, hasDC, hasDA }
  }

  if (itemType === 'guest') {
    const numericFamilyVariant = extractNumericFamilyVariant(level.name, familyName)
    if (numericFamilyVariant) {
      return { label: numericFamilyVariant, canAddLevelSuffix: false, levelLabel, hasDC, hasDA }
    }
    if (normalizedVariantName) {
      return { label: normalizedVariantName, canAddLevelSuffix: true, levelLabel, hasDC, hasDA }
    }
    const normalizedLevelName = normalizeDisplayText(stripAccessVariantSuffix(level.name))
    if (normalizedLevelName) {
      if (levelLabel.toLowerCase() === 'unknown' || levelLabel.toLowerCase() === 'as player') {
        return { label: normalizedLevelName, canAddLevelSuffix: false, levelLabel, hasDC, hasDA }
      }
      if (normalizedLevelName !== familyName) {
        return {
          label: normalizedLevelName,
          canAddLevelSuffix: true,
          levelLabel,
          hasDC,
          hasDA,
        }
      }
    }
  }

  if (normalizedVariantName && parseRomanNumeral(normalizedVariantName.trim().toUpperCase()) !== null) {
    return {
      label: normalizedVariantName,
      canAddLevelSuffix: true,
      levelLabel,
      hasDC,
      hasDA,
    }
  }

  if (familyName && useTitleLabels) {
    const parentheticalVariant = getParentheticalVariantParts(familyName)
    if (parentheticalVariant) {
      const normalizedLevelName = normalizeDisplayText(stripAccessVariantSuffix(level.name))
      if (normalizedLevelName === parentheticalVariant.baseName) {
        return {
          label: hasDC ? '(DC)' : parentheticalVariant.variants[0],
          canAddLevelSuffix: false,
          levelLabel,
          hasDC,
          hasDA,
        }
      }

      const matchingVariant = parentheticalVariant.variants.find(variant =>
        normalizedLevelName === `${parentheticalVariant.baseName} ${variant}` ||
        normalizedLevelName.replace(/\s+/g, '').toLowerCase() ===
          `${parentheticalVariant.baseName}${variant}`.replace(/\s+/g, '').toLowerCase()
      )
      if (matchingVariant) {
        return {
          label: matchingVariant,
          canAddLevelSuffix: false,
          levelLabel,
          hasDC,
          hasDA,
        }
      }
    }

    const condensedTitle = getCondensedTitleVariant(level.name, familyName)
    if (condensedTitle) {
      if (levelLabel.toLowerCase() === 'as player') {
        return {
          label: normalizeDisplayText(condensedTitle),
          canAddLevelSuffix: false,
          levelLabel,
          hasDC,
          hasDA,
        }
      }
      if (parseRomanNumeral(condensedTitle.toUpperCase()) !== null) {
        return {
          label: normalizeDisplayText(condensedTitle),
          canAddLevelSuffix: true,
          levelLabel,
          hasDC,
          hasDA,
        }
      }
      return {
        label: normalizeDisplayText(condensedTitle),
        canAddLevelSuffix: true,
        levelLabel,
        hasDC,
        hasDA,
      }
    }

    const normalizedLevelName = normalizeDisplayText(stripAccessVariantSuffix(level.name))
    if (normalizedLevelName === familyName) {
      return {
        label: familyName,
        canAddLevelSuffix: true,
        levelLabel,
        hasDC,
        hasDA,
      }
    }
  }

  if (normalizedVariantName) {
    return {
      label: normalizedVariantName,
      canAddLevelSuffix: true,
      levelLabel,
      hasDC,
      hasDA,
    }
  }

  return {
    label: normalizeDisplayText(level.levelDisplay),
    canAddLevelSuffix: true,
    levelLabel,
    hasDC,
    hasDA,
  }
}

function normalizeComparableValue(value?: string): string {
  return normalizeDisplayText(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
}

function hasDifferentObtainMethods(first: LevelVariant, second: LevelVariant): boolean {
  const serialize = (level: LevelVariant) =>
    level.obtainVariants
      .map(variant => [
        normalizeComparableValue(variant.location),
        normalizeComparableValue(variant.price),
        variant.priceType,
        String(variant.daRequired),
        String(Boolean(variant.dcRequired)),
        String(Boolean(variant.dmRequired)),
        normalizeComparableValue(variant.requiredItems),
      ].join('|'))
      .sort()
      .join('||')

  return serialize(first) !== serialize(second)
}

function hasSameDisplayedLevelAndStats(first: LevelVariant, second: LevelVariant): boolean {
  return String(first.actualLevel ?? first.levelDisplay) === String(second.actualLevel ?? second.levelDisplay) &&
    normalizeComparableValue(first.damage) === normalizeComparableValue(second.damage) &&
    normalizeComparableValue(first.stats) === normalizeComparableValue(second.stats) &&
    normalizeComparableValue(first.resists) === normalizeComparableValue(second.resists)
}

function shouldAddLevelSuffixForDuplicate(
  levels: LevelVariant[],
  labels: LevelVariantLabelInfo[],
  index: number
): boolean {
  const label = labels[index]
  if (!label.canAddLevelSuffix) return false

  return labels.some((otherLabel, otherIndex) =>
    otherIndex !== index &&
    otherLabel.label === label.label &&
    hasSameDisplayedLevelAndStats(levels[index], levels[otherIndex]) &&
    hasDifferentObtainMethods(levels[index], levels[otherIndex])
  )
}

function getAccessDuplicateSuffix(
  levels: LevelVariant[],
  labels: LevelVariantLabelInfo[],
  index: number
): 'DC' | 'DA' | undefined {
  const label = labels[index]

  const duplicateLabels = labels.filter((otherLabel, otherIndex) =>
    otherIndex !== index &&
      otherLabel.label === label.label &&
      hasSameDisplayedLevelAndStats(levels[index], levels[otherIndex]) &&
      hasDifferentObtainMethods(levels[index], levels[otherIndex])
  )

  if (duplicateLabels.length === 0) return undefined
  if (!label.hasDC && !label.hasDA && duplicateLabels.every(otherLabel => !otherLabel.hasDC && !otherLabel.hasDA)) {
    return undefined
  }

  if (label.hasDC) return 'DC'
  if (duplicateLabels.some(otherLabel => otherLabel.hasDC)) return undefined
  if (label.hasDA) return 'DA'

  return undefined
}

function hasAccessDisambiguatedDuplicate(
  levels: LevelVariant[],
  labels: LevelVariantLabelInfo[],
  index: number
): boolean {
  const label = labels[index]

  return labels.some((otherLabel, otherIndex) =>
    otherIndex !== index &&
      otherLabel.label === label.label &&
      (label.hasDC || label.hasDA || otherLabel.hasDC || otherLabel.hasDA) &&
      hasSameDisplayedLevelAndStats(levels[index], levels[otherIndex]) &&
      hasDifferentObtainMethods(levels[index], levels[otherIndex])
  )
}

function shouldUseCompactDcOnlyLabel(
  levels: LevelVariant[],
  labels: LevelVariantLabelInfo[]
): boolean {
  if (levels.length !== 2) return false

  const [firstLabel, secondLabel] = labels
  if (firstLabel.label !== secondLabel.label) return false
  if (firstLabel.hasDC === secondLabel.hasDC) return false
  if (firstLabel.hasDA || secondLabel.hasDA) return false

  return hasSameDisplayedLevelAndStats(levels[0], levels[1]) &&
    hasDifferentObtainMethods(levels[0], levels[1])
}

export function getLevelVariantLabels(
  levels: LevelVariant[],
  familyName?: string,
  itemType?: ItemType
): string[] {
  const useTitleLabels = familyName ? hasTitleDrivenVariantNames(levels, familyName) : false
  const labels = levels.map(level => getLevelVariantLabelInfo(level, familyName, useTitleLabels, itemType))
  const useCompactDcOnlyLabel = shouldUseCompactDcOnlyLabel(levels, labels)

  return labels.map((label, index) => {
    if (useCompactDcOnlyLabel && label.hasDC) return '(DC)'
    const accessDuplicateSuffix = getAccessDuplicateSuffix(levels, labels, index)
    if (accessDuplicateSuffix) {
      return `${label.label} (${accessDuplicateSuffix})`
    }
    if (hasAccessDisambiguatedDuplicate(levels, labels, index)) return label.label
    if (!shouldAddLevelSuffixForDuplicate(levels, labels, index)) return label.label
    return `${label.label} (${label.levelLabel})`
  })
}

export function getLevelVariantLabel(
  level: LevelVariant,
  familyName?: string,
  useTitleLabels: boolean = false,
  itemType?: ItemType
): string {
  return getLevelVariantLabelInfo(level, familyName, useTitleLabels, itemType).label
}

export function shouldHideVariantColumn(
  levels: LevelVariant[],
  familyName?: string,
  itemType?: ItemType
): boolean {
  if (levels.length === 0) return true

  const variantLabels = getLevelVariantLabels(levels, familyName, itemType)

  const redundantExact = variantLabels.every((label, index) => {
    const level = levels[index]
    return label === String(level.actualLevel ?? level.levelDisplay)
  })
  const hasDuplicateLevels = new Set(
    levels.map(level => String(level.actualLevel ?? level.levelDisplay))
  ).size !== levels.length

  if (redundantExact && !hasDuplicateLevels) return true

  return false
}

export function shouldShowVariantColumn(
  levels: LevelVariant[],
  familyName?: string,
  itemType?: ItemType,
  hideVariantColumn: boolean = false
): boolean {
  const hasVariantNames = levels.some(level => Boolean(level.variantName))
  const useTitleLabels = familyName ? hasTitleDrivenVariantNames(levels, familyName) : false
  const hasRedundantVariantColumn = shouldHideVariantColumn(levels, familyName, itemType)

  return !hasRedundantVariantColumn && (!hideVariantColumn || hasVariantNames || useTitleLabels)
}

export function shouldUseSplitVariantRows(levels: LevelVariant[]): boolean {
  if (levels.length < 8) return false

  const dcLevels = levels.filter(level =>
    level.obtainVariants.some(variant => variant.dcRequired || variant.priceType === 'dc')
  )
  if (dcLevels.length === 0 || dcLevels.length === levels.length) return false

  const nonDcLevels = levels.filter(level => !dcLevels.includes(level))
  const nonDcKeys = new Set(nonDcLevels.map(level => String(level.actualLevel ?? level.levelDisplay)))
  const dcKeys = new Set(dcLevels.map(level => String(level.actualLevel ?? level.levelDisplay)))

  return nonDcKeys.size === dcKeys.size && [...nonDcKeys].every(key => dcKeys.has(key))
}

export function chunkVariantRows<T>(items: T[], maxPerRow: number = 8): T[][] {
  if (items.length <= maxPerRow) return [items]

  const rowCount = Math.min(3, Math.ceil(items.length / maxPerRow))
  const baseSize = Math.floor(items.length / rowCount)
  const remainder = items.length % rowCount
  const rows: T[][] = []
  let start = 0

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const size = baseSize + (rowIndex < remainder ? 1 : 0)
    rows.push(items.slice(start, start + size))
    start += size
  }

  return rows.filter(row => row.length > 0)
}
