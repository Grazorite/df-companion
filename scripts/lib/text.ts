export function normalizeTextEncodingArtifacts(text: string): string {
  return text
    .replace(/(\d+(?:st|nd|rd|th)?)\uFFFD(\d+(?:st|nd|rd|th)?)/gi, '$1-$2')
    .replace(/(\d)\uFFFD(\d)/g, '$1-$2')
    .replace(/(\d)(?:–|—)(\d)/g, '$1-$2')
    .replace(/([A-Za-z])\uFFFDs\b/g, "$1's")
    .replace(/\bDefender\uFFFDs\b/g, "Defender's")
    .replace(/\bYulgar\uFFFDs\b/g, "Yulgar's")
    .replace(/Dragon Coins\uFFFDor/g, 'Dragon Coins or')
    .replace(/time frame\uFFFDwould/g, 'time frame would')
    .replace(/used\uFFFDtwice/g, 'used twice')
    .replace(/succession\uFFFDon/g, 'succession on')
    .replace(/\uFFFD(\d[\d,]*\s+Gold)\uFFFD/g, '$1')
    .replace(/%\s*\uFFFD\s*(\d+)/g, '% +/- $1')
    .replace(/(\d+)\uFFFD(?=$|[\s",])/g, '$1')
    .replace(/\bB\uFFFDthory\b/g, 'Bathory')
    .replace(/\bBL\uFFFDHAJ\b/g, 'BLAHAJ')
    .replace(/\bVala\uFFFDka\b/g, 'Valaska')
    .replace(/atham\uFFFD/g, 'athame')
}

export function decodeHtml(text: string): string {
  return normalizeTextEncodingArtifacts(
    text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/&nbsp;/g, ' ')
      .replace(/&apos;/g, "'")
  )
}

/**
 * Remove struck-through content (`<s>`, `<strike>`, `<del>`) from forum HTML.
 *
 * The DragonFable encyclopedia strikes out deprecated entries (e.g. removed
 * obtain locations) rather than deleting them, so struck content must be
 * omitted from scraped data across every category. Struck hyperlinks are
 * removed together with an adjacent list separator so comma-joined lists (like
 * a Location field) do not keep dangling commas.
 */
export function stripStrikethrough(html: string): string {
  return (
    html
      // A hyperlink whose entire content is struck through, plus one trailing
      // separator if present (comma/semicolon/bullet).
      .replace(
        /<a\b[^>]*>\s*(?:<(?:s|strike|del)\b[^>]*>[\s\S]*?<\/(?:s|strike|del)>\s*)+<\/a>\s*(?:[,;·•]\s*)?/gi,
        ''
      )
      // Any remaining struck span, plus one trailing separator if present.
      .replace(/<(s|strike|del)\b[^>]*>[\s\S]*?<\/\1>\s*(?:[,;·•]\s*)?/gi, '')
  )
}

/**
 * Clean up separator artifacts left behind after struck content is removed:
 * collapse runs of commas and trim stray leading/trailing commas per line.
 */
function cleanSeparatorArtifacts(text: string, preserveIndentation = false): string {
  return text
    .split('\n')
    .map((line) => {
      const cleaned = line
        .replace(/,(?:\s*,)+/g, ',') // collapse consecutive commas
        .replace(/\s+,/g, ',') // drop space before a comma left by a removal
        .replace(/^\s*,\s*/, '') // leading comma
        .replace(/\s*,\s*$/, '') // trailing comma
        .trimEnd()
      return preserveIndentation ? cleaned : cleaned.replace(/[ \t]{2,}/g, ' ')
    })
    .join('\n')
}

export function stripSimpleHtml(html: string): string {
  return cleanSeparatorArtifacts(
    stripStrikethrough(html)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<hr[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  )
}

export function stripForumHtml(
  html: string,
  warningLabel = 'stripForumHtml',
  options: { includeListItemClosers?: boolean; preserveIndentation?: boolean } = {}
): string {
  html = stripStrikethrough(html)
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
      const placeholderMatch = html
        .slice(i)
        .match(/^<(?:x|y|target's name|target name|monster name|character name)>/i)
      if (placeholderMatch) {
        processed += placeholderMatch[0]
        i += placeholderMatch[0].length
        continue
      }
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

  return cleanSeparatorArtifacts(
    processed
      .replace(/\r/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
    options.preserveIndentation
  )
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
