export function normalizeDisplayText(text?: string): string {
  if (!text) return ''

  return text
    .replace(/\bD-Amulet\/D-Coins\b/g, 'DA/DC')
    .replace(/\bD-Amulet\/DC\b/g, 'DA/DC')
    .replace(/\bD-Amulet\b/g, 'DA')
    .replace(/\bD-Coins?\b/g, 'DC')
}

export function displayTitle(text?: string): string {
  const normalized = normalizeDisplayText(text).replace(/\s+,/g, ',').trim()
  const trailingArticleMatch = normalized.match(/^(.+?),\s*The$/i)

  if (trailingArticleMatch) {
    return `The ${trailingArticleMatch[1].trim()}`
  }

  return normalized
}

export function titleSortKey(text?: string): string {
  return displayTitle(text)
    .replace(/^The\s+/i, '')
    .toLowerCase()
}

export function compareTitles(first?: string, second?: string): number {
  return titleSortKey(first).localeCompare(titleSortKey(second))
}
