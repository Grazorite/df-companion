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

// A detail route whose primary media is always expected (pet with a known image).
const PRIMARY_IMAGE_ROUTE = '/pets/pet-dragon'

test(
  'primary detail image loads eagerly with high fetch priority',
  { timeout: 45_000 },
  async () => {
    const testPage = await createTestPage(harness, { viewport: { width: 1440, height: 900 } })
    const { page } = testPage

    try {
      await page.goto(`${harness.baseUrl}${PRIMARY_IMAGE_ROUTE}`, {
        waitUntil: 'domcontentloaded',
      })
      await page.locator('main h1').waitFor()

      // The primary media image is the first content <img> inside the detail media region.
      const primary = page.locator('main [data-primary-media] img').first()
      await primary.waitFor({ state: 'attached', timeout: 10_000 })

      const attrs = await primary.evaluate((img: HTMLImageElement) => ({
        loading: img.getAttribute('loading'),
        fetchpriority: img.getAttribute('fetchpriority'),
        decoding: img.getAttribute('decoding'),
      }))

      assert.equal(attrs.loading, 'eager', 'primary detail image should load eagerly')
      assert.equal(attrs.fetchpriority, 'high', 'primary detail image should request high priority')
      assert.equal(attrs.decoding, 'async', 'primary detail image should decode asynchronously')
    } finally {
      await testPage.close()
    }
  }
)

test(
  'primary detail media reserves space before the image finishes loading',
  { timeout: 45_000 },
  async () => {
    const testPage = await createTestPage(harness, { viewport: { width: 1440, height: 900 } })
    const { page } = testPage

    try {
      // Stall the image bytes so we can observe the reserved box before load completes.
      await page.route(
        (url) => /\.(?:png|jpe?g|gif|webp)(?:\?|$)/i.test(url.href),
        async () => {
          // Never fulfill during this test; we only inspect the reserved container.
        }
      )

      await page.goto(`${harness.baseUrl}${PRIMARY_IMAGE_ROUTE}`, {
        waitUntil: 'domcontentloaded',
      })
      await page.locator('main h1').waitFor()

      const box = page.locator('main [data-primary-media]').first()
      await box.waitFor({ state: 'attached', timeout: 10_000 })
      const height = await box.evaluate((el) => el.getBoundingClientRect().height)

      assert.ok(
        height > 40,
        `primary media container should reserve height before load, saw ${height}px`
      )
    } finally {
      await page.unrouteAll({ behavior: 'ignoreErrors' })
      await testPage.close()
    }
  }
)

test(
  'secondary and alternative images remain lazily loaded',
  { timeout: 45_000 },
  async () => {
    const testPage = await createTestPage(harness, { viewport: { width: 1440, height: 900 } })
    const { page } = testPage

    try {
      // A weapon with captioned alternative images exercises the alt-image toggle path.
      await page.goto(`${harness.baseUrl}/weapons?type=sword-axe-mace`, {
        waitUntil: 'domcontentloaded',
      })
      await page.locator('main a.group').first().waitFor()
      await page.locator('main a.group').first().click()
      await page.locator('main h1').waitFor()

      // Any image that is NOT the primary media must stay lazy. The primary media region is
      // marked with data-primary-media; every other <img> in main should be loading="lazy".
      const nonPrimaryEager = await page.evaluate(() => {
        const primaryRegion = document.querySelector('main [data-primary-media]')
        const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('main img'))
        return imgs
          .filter((img) => !primaryRegion || !primaryRegion.contains(img))
          .filter((img) => img.getAttribute('loading') !== 'lazy')
          .map((img) => img.getAttribute('alt') || img.src)
      })

      assert.deepEqual(
        nonPrimaryEager,
        [],
        `non-primary images should stay lazy, but these were not: ${nonPrimaryEager.join(', ')}`
      )
    } finally {
      await testPage.close()
    }
  }
)

test(
  'a failed expected image renders the missing-image placeholder',
  { timeout: 45_000 },
  async () => {
    const testPage = await createTestPage(harness, { viewport: { width: 1440, height: 900 } })
    const { page } = testPage

    try {
      // Force the primary image request to fail so the placeholder path is exercised.
      await page.route(
        (url) => /\.(?:png|jpe?g|gif|webp)(?:\?|$)/i.test(url.href),
        (route) => route.abort()
      )

      await page.goto(`${harness.baseUrl}${PRIMARY_IMAGE_ROUTE}`, {
        waitUntil: 'domcontentloaded',
      })
      await page.locator('main h1').waitFor()

      // The shared placeholder exposes an "Image unavailable" label.
      await page
        .locator('main')
        .getByText(/Image unavailable/i)
        .first()
        .waitFor({ state: 'visible', timeout: 10_000 })
    } finally {
      await page.unrouteAll({ behavior: 'ignoreErrors' })
      await testPage.close()
    }
  }
)

test(
  'intentionally invisible items never render the missing-image placeholder',
  { timeout: 45_000 },
  async () => {
    const testPage = await createTestPage(harness, { viewport: { width: 1440, height: 900 } })
    const { page } = testPage

    try {
      // Invisible Cape is one of the hardcoded intentionally-imageless accessories.
      await page.goto(`${harness.baseUrl}/accessories/accessory-invisible-cape?type=cape-wing`, {
        waitUntil: 'domcontentloaded',
      })
      await page.locator('main h1').waitFor()

      const placeholderCount = await page
        .locator('main')
        .getByText(/Image unavailable/i)
        .count()
      assert.equal(
        placeholderCount,
        0,
        'intentionally invisible items must not show the missing-image placeholder'
      )
    } finally {
      await testPage.close()
    }
  }
)

test('mobile detail pages do not overflow the document', { timeout: 60_000 }, async () => {
  const testPage = await createTestPage(harness, { viewport: { width: 390, height: 844 } })
  const { page } = testPage

  const detailRoutes = [
    '/pets/pet-dragon',
    '/weapons?type=sword-axe-mace',
    '/accessories?type=helm',
    '/classes?type=class',
  ] as const

  try {
    // For list routes, open the first card to reach a detail page; for detail routes, use directly.
    for (const route of detailRoutes) {
      await page.goto(`${harness.baseUrl}${route}`, { waitUntil: 'domcontentloaded' })
      if (!route.includes('/pets/')) {
        await page.locator('main a.group').first().waitFor({ timeout: 15_000 })
        await page.locator('main a.group').first().click()
      }
      await page.locator('main h1').waitFor()

      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }))
      assert.ok(
        dimensions.scrollWidth <= dimensions.clientWidth + 1,
        `${route} detail overflows: scrollWidth ${dimensions.scrollWidth}px vs client ${dimensions.clientWidth}px`
      )
    }
  } finally {
    await testPage.close()
  }
})

test('wide stats tables scroll internally without shifting the document', {
  timeout: 45_000,
}, async () => {
  const testPage = await createTestPage(harness, { viewport: { width: 390, height: 844 } })
  const { page } = testPage

  try {
    // A multi-level weapon renders the "Stats by Level" table.
    await page.goto(`${harness.baseUrl}/weapons?type=sword-axe-mace`, {
      waitUntil: 'domcontentloaded',
    })
    await page.locator('main a.group').first().waitFor()
    await page.locator('main a.group').first().click()
    await page.locator('main h1').waitFor()

    // If a stats table is present, its scroll container may exceed the viewport internally, but the
    // document itself must not gain horizontal overflow from it.
    const overflow = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    assert.ok(
      overflow.scrollWidth <= overflow.clientWidth + 1,
      `stats table caused document overflow: ${overflow.scrollWidth}px vs ${overflow.clientWidth}px`
    )
  } finally {
    await testPage.close()
  }
})

test(
  'primary detail media keeps cumulative layout shift within budget',
  { timeout: 45_000 },
  async () => {
    const testPage = await createTestPage(harness, { viewport: { width: 390, height: 844 } })
    const { page } = testPage

    try {
      await page.goto(`${harness.baseUrl}${PRIMARY_IMAGE_ROUTE}`, { waitUntil: 'domcontentloaded' })
      await page.locator('main h1').waitFor()

      // Observe layout-shift entries for a short window after the detail settles.
      const cls = await page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            let total = 0
            const observer = new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) {
                const shift = entry as PerformanceEntry & {
                  value: number
                  hadRecentInput: boolean
                }
                if (!shift.hadRecentInput) total += shift.value
              }
            })
            observer.observe({ type: 'layout-shift', buffered: true })
            setTimeout(() => {
              observer.disconnect()
              resolve(total)
            }, 1_500)
          })
      )

      assert.ok(cls <= 0.1, `representative detail CLS ${cls.toFixed(4)} exceeded the 0.1 ceiling`)
    } finally {
      await testPage.close()
    }
  }
)
