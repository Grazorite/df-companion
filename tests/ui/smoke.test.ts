import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import type { AppHarness } from './harness.ts'
import { createTestPage, startAppHarness, stopAppHarness, waitForResultCount } from './harness.ts'

const LIST_ROUTES = [
  { path: '/badges', heading: 'Badges' },
  { path: '/pets', heading: 'Pets & Guests' },
  { path: '/accessories?type=helm', heading: 'Accessories' },
  { path: '/weapons?type=sword-axe-mace', heading: 'Weapons' },
  { path: '/housing?type=wall-item', heading: 'Housing & House Items' },
  { path: '/classes?type=class', heading: 'Classes / Abilities' },
] as const

let harness: AppHarness

before(async () => {
  harness = await startAppHarness()
})

after(async () => {
  await stopAppHarness(harness)
})

test(
  'shipped list routes expose their primary content and results',
  { timeout: 90_000 },
  async () => {
    const testPage = await createTestPage(harness, { viewport: { width: 1440, height: 900 } })
    const { page } = testPage

    try {
      for (const route of LIST_ROUTES) {
        await page.goto(`${harness.baseUrl}${route.path}`, { waitUntil: 'domcontentloaded' })
        await waitForResultCount(page)

        assert.equal(await page.locator('main').count(), 1, `${route.path} should have one main`)
        assert.match(
          (await page.locator('main h1').first().textContent()) ?? '',
          new RegExp(route.heading, 'i'),
          `${route.path} should expose its page heading`
        )
        assert.ok(
          (await page.locator('main a.group').count()) > 0,
          `${route.path} should render linked result cards`
        )
      }
    } finally {
      await testPage.close()
    }
  }
)

test('mobile list layouts do not overflow the document', { timeout: 45_000 }, async () => {
  const testPage = await createTestPage(harness, { viewport: { width: 390, height: 844 } })
  const { page } = testPage

  try {
    await page.goto(`${harness.baseUrl}/weapons?type=sword-axe-mace`, {
      waitUntil: 'domcontentloaded',
    })
    await waitForResultCount(page)

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    assert.ok(
      dimensions.scrollWidth <= dimensions.clientWidth,
      `document width ${dimensions.scrollWidth}px exceeds viewport ${dimensions.clientWidth}px`
    )
  } finally {
    await testPage.close()
  }
})

test('reduced-motion preference disables page and card motion', { timeout: 45_000 }, async () => {
  const testPage = await createTestPage(harness, {
    reducedMotion: 'reduce',
    viewport: { width: 390, height: 844 },
  })
  const { page } = testPage

  try {
    await page.goto(`${harness.baseUrl}/pets`, { waitUntil: 'domcontentloaded' })
    await waitForResultCount(page)

    const durations = await page.evaluate(() => {
      const main = document.querySelector('main')
      const card = document.querySelector('main a.group')
      return {
        cardTransition: card ? getComputedStyle(card).transitionDuration : null,
        mainAnimation: main ? getComputedStyle(main).animationDuration : null,
      }
    })

    assert.equal(durations.mainAnimation, '0s')
    assert.equal(durations.cardTransition, '0s')
  } finally {
    await testPage.close()
  }
})
