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

/**
 * Error thrown when the forum rate-limits us (HTTP 429) or is briefly
 * unavailable (HTTP 503). Carries an optional server-provided cooldown so the
 * retry loop can honor `Retry-After` instead of guessing.
 */
export class RetryableHttpError extends Error {
  readonly status: number
  readonly retryAfterMs?: number

  constructor(status: number, url: string, retryAfterMs?: number) {
    super(`HTTP ${status}: ${url}`)
    this.name = 'RetryableHttpError'
    this.status = status
    this.retryAfterMs = retryAfterMs
  }
}

/**
 * Detect the forum's signature for a post that no longer exists. Deleted or
 * moved threads make `printable.asp` / `fb.asp` return a hard HTTP 500 (rather
 * than a friendly "deleted or moved" page), which would otherwise abort a whole
 * scrape run. Scrapers use this to skip the dead post and keep going.
 */
export function isPostUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /^HTTP 500:/i.test(message)
}

/**
 * Parse an HTTP `Retry-After` header, which is either a number of seconds or an
 * HTTP date. Returns milliseconds, or undefined when absent/unparseable.
 */
export function parseRetryAfterMs(headerValue: string | null): number | undefined {
  if (!headerValue) return undefined

  const seconds = Number(headerValue)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)

  const dateMs = Date.parse(headerValue)
  if (Number.isFinite(dateMs)) return Math.max(0, dateMs - Date.now())

  return undefined
}

/**
 * Exponential backoff with full jitter. Jitter spreads retries from concurrent
 * workers so they don't stampede the forum in lockstep after a throttle.
 */
function computeBackoffMs(baseDelayMs: number, attempt: number): number {
  const ceiling = baseDelayMs * 2 ** (attempt - 1)
  return Math.round(Math.random() * ceiling)
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

      // Honor a server-provided cooldown for rate limits; otherwise back off
      // with jitter so parallel workers don't retry in lockstep.
      const serverRetryMs =
        error instanceof RetryableHttpError ? error.retryAfterMs : undefined
      const waitMs = serverRetryMs ?? computeBackoffMs(delayMs, attempt)
      console.warn(
        `Retrying ${label} after ${message} in ${waitMs}ms (${attempt}/${attempts})`
      )
      await sleep(waitMs)
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
        if (!response.ok) {
          if (response.status === 429 || response.status === 503) {
            throw new RetryableHttpError(
              response.status,
              url,
              parseRetryAfterMs(response.headers.get('retry-after'))
            )
          }
          throw new Error(`HTTP ${response.status}: ${url}`)
        }
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
