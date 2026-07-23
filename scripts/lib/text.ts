export function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&apos;/g, "'")
}

export function stripSimpleHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<hr[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function stripForumHtml(
  html: string,
  warningLabel = 'stripForumHtml',
  options: { includeListItemClosers?: boolean } = {}
): string {
  let depth = 0
  let processed = ''
  let i = 0
  const maxIterations = Math.max(html.length * 3, 100000)
  let iterations = 0
  let inTag = false
  let tagStart = -1

  while (i < html.length && iterations < maxIterations) {
    iterations += 1
    const char = html[i]

    if (char === '<' && !inTag) {
      const nextChars = html.slice(i, i + 12)
      if (/^<[a-zA-Z!/]/.test(nextChars)) {
        inTag = true
        tagStart = i
      } else {
        processed += char
      }
      i += 1
      continue
    }

    if (char === '>' && inTag) {
      inTag = false
      const tagContent = html.slice(tagStart, i + 1)

      if (/<ul|<ol/i.test(tagContent)) {
        depth += 1
        processed += '\n'
      } else if (/<\/ul|<\/ol/i.test(tagContent)) {
        depth = Math.max(0, depth - 1)
        processed += '\n'
      } else if (/<li/i.test(tagContent)) {
        const indent = '  '.repeat(Math.max(0, depth))
        processed += `\n${indent}• `
      } else if (options.includeListItemClosers && /<\/li/i.test(tagContent)) {
        processed += '\n'
      } else if (/<br/i.test(tagContent) || /<\/p/i.test(tagContent) || /<hr/i.test(tagContent)) {
        processed += '\n'
      }

      i += 1
      continue
    }

    if (inTag) {
      i += 1
      continue
    }

    processed += char
    i += 1
  }

  if (iterations >= maxIterations) {
    console.warn(`⚠️  ${warningLabel} reached iteration limit`)
  }

  return processed
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function normalizeStructuredText(html: string): string {
  return decodeHtml(stripForumHtml(html))
}

export function slugify(value: string, maxLength?: number): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return maxLength ? slug.slice(0, maxLength) : slug
}

export function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}
