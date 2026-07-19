export function rephraseTimedSellback(sellback: string): string {
  const timedPattern = /^(\d[\d,]*)\s+(Dragon Coins?|Gold|Defender'?s? Medals?)\s+before\s+(.+?),\s*(\d[\d,]*)\s+(Dragon Coins?|Gold|Defender'?s? Medals?)\s+after\s+\3$/i
  const match = sellback.match(timedPattern)

  if (!match) return sellback

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
