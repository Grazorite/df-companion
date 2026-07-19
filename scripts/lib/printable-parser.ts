const FORUM_BASE = 'https://forums2.battleon.com/f'

const FORUM_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
}

export interface ThreadPostContent {
  messageId: string
  sourceUrl: string
  html: string
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchForumPage(url: string, cookie: string): Promise<string> {
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

export async function fetchPrintable(messageId: string, cookie: string, page?: number): Promise<string> {
  const pageParam = page && page > 1 ? `&mpage=${page}` : ''
  const url = `${FORUM_BASE}/printable.asp?m=${messageId}${pageParam}`
  return fetchForumPage(url, cookie)
}

export async function fetchThreadPages(messageId: string, cookie: string, delayMs = 250): Promise<string> {
  const firstPageHtml = await fetchForumPage(`${FORUM_BASE}/fb.asp?m=${messageId}`, cookie)
  const pageNumbers = Array.from(
    new Set(
      [...firstPageHtml.matchAll(/\bmpage=(\d+)/gi)]
        .map(match => Number.parseInt(match[1], 10))
        .filter(pageNumber => pageNumber > 1)
    )
  ).sort((a, b) => a - b)

  const additionalPages: string[] = []
  for (const pageNumber of pageNumbers) {
    additionalPages.push(await fetchForumPage(`${FORUM_BASE}/tm.asp?m=${messageId}&mpage=${pageNumber}`, cookie))
    await sleep(delayMs)
  }

  return [firstPageHtml, ...additionalPages].join('\n')
}

export function extractThreadPostContents(threadHtml: string): ThreadPostContent[] {
  const posts: ThreadPostContent[] = []
  const regex =
    /<a\s+name=(\d+)\b[^>]*><\/a>[\s\S]*?<td\b[^>]*class=["']?msg["']?[^>]*>([\s\S]*?)<\/td>/gi

  for (const match of threadHtml.matchAll(regex)) {
    const messageId = match[1]
    posts.push({
      messageId,
      sourceUrl: `${FORUM_BASE}/fb.asp?m=${messageId}`,
      html: convertImageTags(match[2]),
    })
  }

  return posts
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

export function extractAllContent(html: string): string {
  if (html.includes('This message has been deleted or moved')) {
    return ''
  }

  const matches = [...html.matchAll(/<span\s+class=["']?msg["']?[^>]*>([\s\S]*?)<\/span>/gi)]
  if (matches.length === 0) {
    throw new Error('Could not find printable content block')
  }

  return matches.map(match => match[1]).join('\n<hr>\n')
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

export function getAllPostContent(html: string): string {
  return convertImageTags(extractAllContent(html))
}
