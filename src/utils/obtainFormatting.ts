import type { PriceType } from '../types/item'
import { normalizeDisplayText } from './displayText'

export function getCurrencyTextClass(text?: string, fallback?: Extract<PriceType, 'dc' | 'dm'>): string {
  const normalized = text?.toLowerCase() ?? ''
  if (fallback === 'dc' || normalized.includes('dragon coin') || /\bdc\b/.test(normalized)) {
    return 'text-gold'
  }
  if (
    fallback === 'dm' ||
    normalized.includes("defender's medal") ||
    normalized.includes('defender medal') ||
    /\bdm\b/.test(normalized)
  ) {
    return 'text-slate-300'
  }
  return 'text-text-primary'
}

export function rephraseTimedSellback(text: string): string {
  const timedPattern = /^(\d[\d,]*)\s+(Dragon Coins?|Gold|Defender'?s? Medals?)\s+before\s+(.+?),\s*(\d[\d,]*)\s+(Dragon Coins?|Gold|Defender'?s? Medals?)\s+after\s+\3$/i
  const match = text.match(timedPattern)

  if (!match) return text

  const [, beforeAmount, beforeCurrency, timeframe, afterAmount] = match
  const currency = beforeCurrency.toLowerCase().includes('dragon')
    ? 'DC'
    : beforeCurrency.toLowerCase().includes('gold')
      ? 'Gold'
      : beforeCurrency.toLowerCase().includes('medal')
        ? 'DM'
        : beforeCurrency

  return `${beforeAmount} ${currency} (<${timeframe}) / ${afterAmount} ${currency} (>${timeframe})`
}

export function getSeparatedObtainLines(
  text?: string,
  options?: {
    rephraseTimedSellback?: boolean
    splitOn?: 'slash' | 'or'
  }
): string[] {
  const normalized = normalizeDisplayText(text)
  if (!normalized) return []

  const displayText = options?.rephraseTimedSellback
    ? rephraseTimedSellback(normalized)
    : normalized
  const separator = options?.splitOn === 'or' ? /\s+OR\s+/ : /\s+\/\s+/

  return displayText
    .split(separator)
    .map(line => line.trim())
    .filter(Boolean)
}
