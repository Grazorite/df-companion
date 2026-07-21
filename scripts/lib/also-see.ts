export interface ParsedAlsoSeeRef {
  name: string
  url?: string
}

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function extractAlsoSeeRefs(html: string): ParsedAlsoSeeRef[] {
  const match = html.match(
    /Also\s+See:\s*([\s\S]*?)(?=<br\s*\/?>\s*<br\s*\/?>|<i>\s*Thanks\s+to|Thanks\s+to|<font\s+color=['"]#eeeeee['"]|$)/i
  )
  if (!match) return []

  const sectionHtml = match[1]
  const refs: ParsedAlsoSeeRef[] = []
  const seen = new Set<string>()

  for (const anchor of sectionHtml.matchAll(/<a[^>]+href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = decodeHtml(anchor[2]).trim()
    const name = stripHtml(decodeHtml(anchor[3]))
    const key = `${name.toLowerCase()}|${url.toLowerCase()}`
    if (!name || seen.has(key)) continue
    seen.add(key)
    refs.push({ name, ...(url ? { url } : {}) })
  }

  return refs
}
