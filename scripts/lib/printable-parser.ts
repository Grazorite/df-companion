const FORUM_BASE = 'https://forums2.battleon.com/f'

const FORUM_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
}

export async function fetchPrintable(messageId: string, cookie: string, page?: number): Promise<string> {
  const pageParam = page && page > 1 ? `&mpage=${page}` : ''
  const url = `${FORUM_BASE}/printable.asp?m=${messageId}${pageParam}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 45000)

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Cookie: cookie,
        ...FORUM_HEADERS,
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`)
    return res.text()
  } finally {
    clearTimeout(timer)
  }
}

export function extractContent(html: string): string {
  if (html.includes('This message has been deleted or moved')) {
    return ''
  }

  const match = html.match(/<span\s+class=["']?msg["']?[^>]*>([\s\S]*?)<\/span>/i)
  if (!match) {
    throw new Error('Could not find printable content block')
  }

  return match[1]
}

export function convertImageTags(content: string): string {
  return content.replace(/\[image\]([\s\S]*?)\[\/image\]/gi, (_, url: string) => {
    const src = url.trim()
    return src ? `<img src="${src}">` : ''
  })
}

export function getPostContent(html: string): string {
  return convertImageTags(extractContent(html))
}
