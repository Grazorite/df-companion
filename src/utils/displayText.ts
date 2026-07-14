export function normalizeDisplayText(text?: string): string {
  if (!text) return ''

  return text
    .replace(/\bD-Amulet\/D-Coins\b/g, 'DA/DC')
    .replace(/\bD-Amulet\/DC\b/g, 'DA/DC')
    .replace(/\bD-Amulet\b/g, 'DA')
    .replace(/\bD-Coins?\b/g, 'DC')
}
