import * as fs from 'node:fs'
import * as path from 'node:path'

interface LocatorLike {
  click(options?: { force?: boolean; timeout?: number }): Promise<void>
  first(): LocatorLike
  screenshot(options: { path: string; timeout?: number }): Promise<Buffer>
}

interface PageLike {
  addInitScript(options: { content: string }): Promise<void>
  addScriptTag(options: { url: string }): Promise<void>
  close(): Promise<void>
  goto(url: string, options: { timeout: number; waitUntil: 'domcontentloaded' | 'networkidle' }): Promise<unknown>
  locator(selector: string): LocatorLike
  setContent(
    html: string,
    options: { timeout: number; waitUntil: 'domcontentloaded' | 'networkidle' }
  ): Promise<void>
  setViewportSize(size: { width: number; height: number }): Promise<void>
  waitForSelector(
    selector: string,
    options: { state: 'visible'; timeout: number }
  ): Promise<unknown>
  waitForTimeout(timeout: number): Promise<void>
}

interface BrowserLike {
  close(): Promise<void>
  newPage(): Promise<PageLike>
}

interface ChromiumLike {
  launch(options: { headless: boolean }): Promise<BrowserLike>
}

interface PlaywrightLike {
  chromium: ChromiumLike
}

export interface GuestCharacterCaptureRequest {
  charPageUrl: string
  force?: boolean
  name: string
  slug: string
}

const CAPTURE_DIR = path.resolve(import.meta.dirname, '../../public/generated/guests/charpages')
const CAPTURE_PUBLIC_PATH = '/generated/guests/charpages'
const RUFFLE_SCRIPT_URL =
  process.env.RUFFLE_SCRIPT_URL ?? 'https://unpkg.com/@ruffle-rs/ruffle/ruffle.js'
const CANVAS_SELECTOR = 'ruffle-player canvas, canvas'
const RENDER_WAIT_MS = Number.parseInt(process.env.GUEST_CHARPAGE_RENDER_WAIT_MS ?? '25000', 10)

let warnedMissingPlaywright = false

function isPlaywrightModule(value: unknown): value is PlaywrightLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    'chromium' in value &&
    typeof (value as { chromium?: unknown }).chromium === 'object'
  )
}

async function loadPlaywright(): Promise<PlaywrightLike | undefined> {
  try {
    const dynamicImport = new Function('specifier', 'return import(specifier)') as (
      specifier: string
    ) => Promise<unknown>
    const module = await dynamicImport('playwright')
    if (isPlaywrightModule(module)) return module
  } catch {
    // Optional dependency; warn below once.
  }

  if (!warnedMissingPlaywright) {
    console.warn(
      '⚠️  Guest CharPage capture skipped: install Playwright locally with `npm install`, then `npx playwright install chromium`.'
    )
    warnedMissingPlaywright = true
  }
  return undefined
}

function outputPathForSlug(slug: string): { filePath: string; publicPath: string } {
  const filename = `${slug}.png`
  return {
    filePath: path.join(CAPTURE_DIR, filename),
    publicPath: `${CAPTURE_PUBLIC_PATH}/${filename}`,
  }
}

function normalizeRuffleEmbedTag(tag: string): string {
  if (/^<ruffle-embed\b/i.test(tag)) {
    return /<\/ruffle-embed>\s*$/i.test(tag)
      ? tag
      : `${tag.replace(/\/?>\s*$/i, '>')}</ruffle-embed>`
  }

  return tag
}

async function fetchCharacterEmbed(charPageUrl: string): Promise<string | undefined> {
  try {
    const response = await fetch(charPageUrl)
    if (!response.ok) return undefined

    const html = await response.text()
    const ruffleEmbedMatch = html.match(/<ruffle-embed\b[\s\S]*?(?:<\/ruffle-embed>|\/?>)/i)
    if (ruffleEmbedMatch) return normalizeRuffleEmbedTag(ruffleEmbedMatch[0])

    const legacyEmbedMatch =
      html.match(/<embed\b[^>]*charactersheet[^>]*>/i) ??
      html.match(/<embed\b[^>]*application\/x-shockwave-flash[^>]*>/i)
    return legacyEmbedMatch ? normalizeRuffleEmbedTag(legacyEmbedMatch[0]) : undefined
  } catch {
    return undefined
  }
}

function buildCharacterCaptureHtml(embedHtml: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <script>
      window.RufflePlayer = window.RufflePlayer || {};
      window.RufflePlayer.config = {
        autoplay: "on",
        unmuteOverlay: "hidden",
        splashScreen: false
      };
    </script>
    <script src="${RUFFLE_SCRIPT_URL}"></script>
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 490px;
        height: 700px;
        overflow: hidden;
        background: transparent;
      }
      ruffle-embed, embed, object, canvas {
        width: 490px;
        height: 700px;
        display: block;
      }
    </style>
  </head>
  <body>${embedHtml}</body>
</html>`
}

export function hasGuestCharacterCapture(slug: string): string | undefined {
  const { filePath, publicPath } = outputPathForSlug(slug)
  return fs.existsSync(filePath) ? publicPath : undefined
}

export async function captureGuestCharacterPage({
  charPageUrl,
  force = false,
  name,
  slug,
}: GuestCharacterCaptureRequest): Promise<string | undefined> {
  const existing = hasGuestCharacterCapture(slug)
  if (existing && !force) return existing
  const hadExistingCapture = Boolean(existing)

  const playwright = await loadPlaywright()
  if (!playwright) return undefined

  fs.mkdirSync(CAPTURE_DIR, { recursive: true })
  const { filePath, publicPath } = outputPathForSlug(slug)
  const browser = await playwright.chromium.launch({ headless: true })

  try {
    const page = await browser.newPage()
    try {
      await page.setViewportSize({ width: 900, height: 1150 })
      await page.addInitScript({
        content: `
          window.RufflePlayer = window.RufflePlayer || {};
          window.RufflePlayer.config = {
            autoplay: "on",
            unmuteOverlay: "hidden",
            splashScreen: false,
          };
        `,
      })
      const embedHtml = await fetchCharacterEmbed(charPageUrl)
      if (embedHtml) {
        await page.setContent(buildCharacterCaptureHtml(embedHtml), {
          waitUntil: 'domcontentloaded',
          timeout: 60_000,
        })
      } else {
        await page.goto(charPageUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
        await page.addScriptTag({ url: RUFFLE_SCRIPT_URL })
      }
      await page.waitForSelector(CANVAS_SELECTOR, { state: 'visible', timeout: 45_000 })
      const canvas = page.locator(CANVAS_SELECTOR).first()
      await page.waitForTimeout(2_000)
      try {
        await page.locator('#play-button').first().click({ force: true, timeout: 10_000 })
      } catch {
        await canvas.click({ force: true, timeout: 10_000 })
      }
      await page.waitForTimeout(Number.isFinite(RENDER_WAIT_MS) ? RENDER_WAIT_MS : 25_000)
      await canvas.screenshot({ path: filePath, timeout: 30_000 })
      console.log(`📸 Captured CharPage image for ${name}: ${publicPath}`)
      return publicPath
    } finally {
      await page.close()
    }
  } catch (error) {
    if (!hadExistingCapture && fs.existsSync(filePath)) fs.unlinkSync(filePath)
    console.warn(
      `⚠️  Could not capture CharPage image for ${name}: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
    return existing
  } finally {
    await browser.close()
  }
}
