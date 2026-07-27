import type { ObtainVariant } from '../types/item'
import { obtainVariantHasDC } from './variantHelpers'

const GENERIC_NAME_TOKENS = new Set([
  'all',
  'amulet',
  'backguard',
  'band',
  'belt',
  'bracer',
  'cap',
  'cape',
  'cloak',
  'cover',
  'cowl',
  'goggles',
  'guard',
  'hat',
  'helm',
  'helmet',
  'hood',
  'mask',
  'masks',
  'of',
  'the',
  'version',
  'versions',
  'visage',
  'visor',
  'wing',
  'wings',
])

function normalizeComparableText(value?: string): string {
  return (value ?? '').toLowerCase().replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
}

/**
 * Normalize obtain-recipe text (required items / requirements) for related-item
 * matching by dropping parenthetical variant/version labels such as "(Amalgam)",
 * "(Destiny)", "(Doom)" or "(I)". This lets sibling variant families that merge
 * from the same base materials — differing only by their own variant label —
 * still register as sharing an obtain method (e.g. Exalted Blaster Amalgam /
 * Destiny / Doom all merge from "Uaanta's Blaster III/IV" in the same shop).
 * Genuinely different materials remain distinct, so the match stays conservative.
 */
function normalizeObtainRecipe(value?: string): string {
  return normalizeComparableText(value)
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function obtainMethodFingerprint(method: ObtainVariant): string {
  return [
    normalizeComparableText(method.location),
    normalizeComparableText(method.price),
    method.priceType,
    normalizeObtainRecipe(method.requiredItems),
    normalizeObtainRecipe(method.requirements),
    String(Boolean(method.daRequired)),
    String(obtainVariantHasDC(method)),
    String(Boolean(method.dmRequired) || method.priceType === 'dm'),
  ].join('|')
}

/**
 * A relaxed fingerprint for inferred related-item matching. It only considers
 * the shop location, price type, and recipe materials (variant-normalized) —
 * not the exact price, DA/DC/DM flags, or access requirements. This lets items
 * sold from the same shop at the same price type (e.g. all "Rare Pets" DC items)
 * match each other even if their exact costs differ, since the conservative
 * name-similarity threshold (0.55+) already prevents false positives.
 */
export function obtainMethodInferenceFingerprint(method: ObtainVariant): string {
  return [
    normalizeComparableText(method.location),
    method.priceType,
    normalizeObtainRecipe(method.requiredItems),
    normalizeObtainRecipe(method.requirements),
  ].join('|')
}

export function getRelatedNameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/['’]s\b/g, '')
    .replace(/[^a-z0-9.]+/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !/^[ivxlcdm]+$/i.test(token))
    .filter((token) => !/^\d+(?:\.\d+)?$/.test(token))
    .filter((token) => !GENERIC_NAME_TOKENS.has(token))
}

export function relatedNameScore(firstName: string, secondName: string): number {
  const firstTokens = getRelatedNameTokens(firstName)
  const secondTokens = getRelatedNameTokens(secondName)
  if (firstTokens.length === 0 || secondTokens.length === 0) return 0

  const secondSet = new Set(secondTokens)
  const intersection = firstTokens.filter((token) => secondSet.has(token)).length
  const union = new Set([...firstTokens, ...secondTokens]).size
  const jaccard = union > 0 ? intersection / union : 0

  let commonPrefix = 0
  const prefixLimit = Math.min(firstTokens.length, secondTokens.length)
  while (commonPrefix < prefixLimit && firstTokens[commonPrefix] === secondTokens[commonPrefix]) {
    commonPrefix += 1
  }

  const firstTokenScore = firstTokens[0] === secondTokens[0] ? 0.35 : 0
  const overlapScore = jaccard * 0.4
  const prefixScore = (commonPrefix / prefixLimit) * 0.25

  return firstTokenScore + overlapScore + prefixScore
}
