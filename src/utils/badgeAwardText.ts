const BADGE_AWARD_PATTERN =
  /\bOwn\s+(?:this|any)\s+(?:item|armor|weapon|house style|house|pet|guest)\s+to\s+obtain\s+(?:the\s+)?([^.\n;]+?)\s+badges?\b/gi

function normalizeBadgeName(name: string): string {
  return name
    .replace(/\([^)]*\)/g, ' ')
    .replace(/^the\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitBadgeList(value: string): string[] {
  return value
    .split(/\s*(?:,|&|\band\b)\s*/i)
    .map(normalizeBadgeName)
    .filter(Boolean)
}

export function extractAwardedBadgeNames(texts: Array<string | undefined | null>): string[] {
  const names: string[] = []

  for (const text of texts) {
    if (!text) continue
    for (const match of text.matchAll(BADGE_AWARD_PATTERN)) {
      names.push(...splitBadgeList(match[1] ?? ''))
    }
  }

  return [...new Set(names)]
}

export function normalizeBadgeLookupKey(value: string): string {
  return normalizeBadgeName(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}
