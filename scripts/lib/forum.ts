import * as fs from 'node:fs'
import * as path from 'node:path'

export const FORUM_BASE = 'https://forums2.battleon.com/f'

const FORUM_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
}

const pageCache = new Map<string, string>()
const inFlightPageCache = new Map<string, Promise<string>>()

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function loadForumCookie(label = 'scraper'): string {
  if (process.env.FORUM_COOKIE) return process.env.FORUM_COOKIE

  const envPath = path.resolve(import.meta.dirname, '../../.env')
  if (!fs.existsSync(envPath)) {
    throw new Error(`FORUM_COOKIE is required in the environment or .env to run ${label}.`)
  }

  const content = fs.readFileSync(envPath, 'utf-8')
  const match = content.match(/FORUM_COOKIE=["'](.+?)["']\s*$/m)
  if (!match) {
    throw new Error(`FORUM_COOKIE not found in .env for ${label}.`)
  }

  return match[1]
}

export async function withRetry<T>(
  label: string,
  operation: () => Promise<T>,
  options: { attempts?: number; delayMs?: number; retryHttp500?: boolean } = {}
): Promise<T> {
  const { attempts = 3, delayMs = 900, retryHttp500 = false } = options
  let lastError: unknown

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      if (!retryHttp500 && /^HTTP 500:/i.test(message)) break
      if (attempt === attempts) break
      console.warn(`Retrying ${label} after ${message} (${attempt}/${attempts})`)
      await sleep(delayMs * attempt)
    }
  }

  throw lastError
}

export async function fetchForumPage(
  url: string,
  cookie: string,
  options: { timeoutMs?: number; useCache?: boolean; attempts?: number; delayMs?: number } = {}
): Promise<string> {
  const { timeoutMs = 45000, useCache = true, attempts = 3, delayMs = 900 } = options
  if (useCache) {
    const cached = pageCache.get(url)
    if (cached !== undefined) return cached

    const inFlight = inFlightPageCache.get(url)
    if (inFlight) return inFlight
  }

  const fetchPromise = withRetry(
    url,
    async () => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            Cookie: cookie,
            ...FORUM_HEADERS,
          },
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`)
        return response.text()
      } finally {
        clearTimeout(timer)
      }
    },
    { attempts, delayMs }
  )

  if (useCache) inFlightPageCache.set(url, fetchPromise)

  const html = await fetchPromise.finally(() => {
    inFlightPageCache.delete(url)
  })

  if (useCache) pageCache.set(url, html)
  return html
}

export function directForumPostUrl(messageId: string): string {
  return `${FORUM_BASE}/fb.asp?m=${messageId}`
}

export function clearForumPageCache(): void {
  pageCache.clear()
  inFlightPageCache.clear()
}
