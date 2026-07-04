export function normalizeDisplayText(text?: string): string {
  if (!text) return ''

  return text
    .replace(/\bD-Coins?\b/g, 'DC')
    .replace(/\bD-Amulet\/DC\b/g, 'D-Amulet/DC')
}
