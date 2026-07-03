/**
 * Variant Helper Utilities
 * 
 * Utility functions for working with multi-variant items, including price type
 * computation, family flag derivation, level normalization, and roman numeral parsing.
 */

import type { ItemFamily, PriceType } from '../types/item'

/**
 * Compute price type from price string and required items.
 * 
 * Logic:
 * - free: "N/A", "0 Gold", or "Free" with NO required items
 * - merge: "N/A" but HAS required items (merge shop)
 * - dc: Contains "Dragon Coin"
 * - dm: Contains "Defender's Medal"
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
  if (p.includes('dragon coin')) {
    return 'dc'
  }
  
  // DM
  if (p.includes("defender's medal")) {
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
export function computeFamilyFlags(family: ItemFamily): ItemFamily {
  let hasDA = false
  let hasDC = false
  let hasDM = false
  let hasFree = false
  let hasMerge = false
  const elementSet = new Set<string>()
  
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
  const firstLevel = family.levelVariants[0]?.levelDisplay
  const lastLevel = family.levelVariants.at(-1)?.levelDisplay
  
  // For multi-post families (Baron (Kitten, Cat)), don't add range suffix — name already contains variants
  let levelRange: string
  if (family.isMultiPost) {
    // Extract variant list from name: "Baron (Kitten, Cat)" -> "(Kitten, Cat)"
    const variantMatch = family.familyName.match(/\(([^)]+)\)/)
    levelRange = variantMatch ? variantMatch[1] : `${firstLevel}-${lastLevel}`
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
  const romanMap: Record<string, number> = {
    'I': 1,
    'II': 2,
    'III': 3,
    'IV': 4,
    'V': 5,
    'VI': 6,
    'VII': 7,
    'VIII': 8,
    'IX': 9,
    'X': 10,
  }
  
  return romanMap[s] ?? null
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
