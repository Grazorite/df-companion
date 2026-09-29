import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import type { AppHarness } from './harness.ts'
import { createTestPage, startAppHarness, stopAppHarness } from './harness.ts'

let harness: AppHarness

before(async () => {
  harness = await startAppHarness()
})

after(async () => {
  await stopAppHarness(harness)
})

// Full category datasets that the palette must NOT request on first open.
const FULL_DATASET_PATTERN =
  /\/(?:badges|pets|guests|artifacts|belts|bracers|capes-wings|helms|necklaces|rings|trinkets|weapons-|housing-|class-)/

async function openPalette(page: import('playwright').Page) {
  await page.goto(`${harness.baseUrl}/`, { waitUntil: 'domcontentloaded' })
  await page.locator('main h1').waitFor()
  // Cmd/Ctrl+K opens the palette.
  await page.keyboard.press('ControlOrMeta+k')
  await page.getByRole('dialog').waitFor()
}

test(
  'opening the palette requests only the compact search index, not full datasets',
  { timeout: 45_000 },
  async () => {
    const testPage = await createTestPage(harness, { viewport: { width: 1440, height: 900 } })
    const { page } = testPage

    const dataRequests: string[] = []
    page.on('request', (request) => {
      const url = request.url()
      // Only count genuine dataset CONTENT fetches. In the Vite dev server, `?url` imports in the
      // module graph produce `?import&url` / `?import` meta-requests that return a tiny URL-string
      // module, not the dataset — those are a dev-only artifact (in production they are build-time
      // constants with no request), so they are excluded here.
      if (/\.json(?:\?|$)/.test(url) && !/[?&]import(?:&|=|$)/.test(url)) dataRequests.push(url)
    })

    try {
      await openPalette(page)
      await page.getByPlaceholder(/Search badges/i).fill('dragon')
      // Give the index fetch + search time to resolve.
      await page.waitForTimeout(1_000)

      // The compact index must have been requested (its content, not a meta-request).
      const requestedIndex = dataRequests.some((url) => /search-index/.test(url))
      assert.ok(requestedIndex, 'palette should fetch the compact search index')

      // No full category dataset CONTENT should have been fetched by opening/searching the palette.
      // (manifests carry only counts and may load for nav badges; those are allowed.)
      const fullDatasetRequests = dataRequests.filter(
        (url) => FULL_DATASET_PATTERN.test(url) && !/manifest|search-index/.test(url)
      )
      assert.deepEqual(
        fullDatasetRequests.map((url) => url.replace(harness.baseUrl, '')),
        [],
        'palette must not load full category datasets on open'
      )
    } finally {
      await testPage.close()
    }
  }
)

test('palette results navigate to a working detail route', { timeout: 45_000 }, async () => {
  const testPage = await createTestPage(harness, { viewport: { width: 1440, height: 900 } })
  const { page } = testPage

  try {
    await openPalette(page)
    await page.getByPlaceholder(/Search badges/i).fill('dragon')

    const firstResult = page.getByRole('option').first()
    await firstResult.waitFor({ state: 'visible', timeout: 10_000 })
    await firstResult.click()

    // Navigation lands on a detail page with a heading (route resolved to a real entry).
    await page.locator('main h1').waitFor({ timeout: 10_000 })
    assert.match(page.url(), /\/(badges|pets|guests|accessories|weapons|housing|classes)\//)
  } finally {
    await testPage.close()
  }
})

test('a failed index load surfaces retry feedback', { timeout: 45_000 }, async () => {
  const testPage = await createTestPage(harness, { viewport: { width: 1440, height: 900 } })
  const { page } = testPage

  try {
    // Fail only the compact index CONTENT fetch (not Vite's `?import` meta-request, which the
    // palette chunk itself needs to load in dev), so the palette mounts but the index load fails.
    await page.route(
      (url) => /search-index\.json/.test(url.href) && !/[?&]import(?:&|=|$)/.test(url.href),
      (route) => route.abort()
    )

    await openPalette(page)
    await page.getByPlaceholder(/Search badges/i).fill('dragon')

    // A retry affordance must appear (button labelled Retry / Try again).
    const retry = page.getByRole('button', { name: /retry|try again/i })
    await retry.waitFor({ state: 'visible', timeout: 10_000 })
    assert.ok(await retry.isVisible(), 'index load failure should offer a retry control')
  } finally {
    await page.unrouteAll({ behavior: 'ignoreErrors' })
    await testPage.close()
  }
})
