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

export function obtainMethodFingerprint(method: ObtainVariant): string {
  return [
    normalizeComparableText(method.location),
    normalizeComparableText(method.price),
    method.priceType,
    normalizeComparableText(method.requiredItems),
    normalizeComparableText(method.requirements),
    String(Boolean(method.daRequired)),
    String(obtainVariantHasDC(method)),
    String(Boolean(method.dmRequired) || method.priceType === 'dm'),
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
