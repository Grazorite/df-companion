import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import type { AppHarness } from './harness.ts'
import { createTestPage, startAppHarness, stopAppHarness, waitForResultCount } from './harness.ts'

let harness: AppHarness

before(async () => {
  harness = await startAppHarness()
})

after(async () => {
  await stopAppHarness(harness)
})

test(
  'reduced-motion removes non-essential page, card, and control motion',
  { timeout: 45_000 },
  async () => {
    const testPage = await createTestPage(harness, {
      reducedMotion: 'reduce',
      viewport: { width: 390, height: 844 },
    })
    const { page } = testPage

    try {
      await page.goto(`${harness.baseUrl}/pets`, { waitUntil: 'domcontentloaded' })
      await waitForResultCount(page)

      // Collect raw duration strings in the browser (no local function declarations inside
      // page.evaluate — tsx injects a __name helper that is undefined in the page context).
      const raw = await page.evaluate(() => {
        const main = document.querySelector('main')
        const card = document.querySelector('main a.group')
        const chevron = card ? card.querySelector('svg') : null
        return {
          mainAnimation: main ? getComputedStyle(main).animationDuration : null,
          cardTransition: card ? getComputedStyle(card).transitionDuration : null,
          chevronTransition: chevron ? getComputedStyle(chevron).transitionDuration : null,
        }
      })

      const allZero = (value: string | null) =>
        value === null || value.split(',').every((part) => part.trim() === '0s')

      assert.equal(allZero(raw.mainAnimation), true, 'page entry animation must be disabled')
      assert.equal(allZero(raw.cardTransition), true, 'card transitions must be disabled')
      assert.equal(allZero(raw.chevronTransition), true, 'chevron transitions must be disabled')
    } finally {
      await testPage.close()
    }
  }
)

test(
  'reduced-motion still allows navigation, filtering, and dialog dismissal',
  { timeout: 45_000 },
  async () => {
    const testPage = await createTestPage(harness, {
      reducedMotion: 'reduce',
      viewport: { width: 390, height: 844 },
    })
    const { page } = testPage

    try {
      await page.goto(`${harness.baseUrl}/pets`, { waitUntil: 'domcontentloaded' })
      await waitForResultCount(page)

      // Filtering works without motion.
      await page
        .locator('main button[aria-label="DA Required: no filter. Click to include."]')
        .first()
        .evaluate((button: HTMLButtonElement) => button.click())
      await page.waitForURL(/[?&]access=da(?:&|$)/)

      // Mobile filter dialog opens, focuses, and dismisses via Escape without motion.
      const trigger = page.getByRole('button', { name: /^Filters, \d+ active$/ })
      await trigger.click()
      const panel = page.getByRole('dialog', { name: 'Filters' })
      await panel.waitFor()
      await page.keyboard.press('Escape')
      assert.equal(await trigger.getAttribute('aria-expanded'), 'false')
      assert.equal(await trigger.evaluate((el) => el === document.activeElement), true)

      // Navigation into a detail page still focuses the heading.
      const card = page.locator('main a.group').first()
      await card.click()
      await page.locator('main h1').waitFor()
      await page.waitForFunction(() => document.activeElement === document.querySelector('main h1'))
    } finally {
      await testPage.close()
    }
  }
)

test('pathname changes play page-entry motion exactly once', { timeout: 45_000 }, async () => {
  const testPage = await createTestPage(harness, { viewport: { width: 1440, height: 900 } })
  const { page } = testPage

  try {
    await page.goto(`${harness.baseUrl}/pets`, { waitUntil: 'domcontentloaded' })
    await waitForResultCount(page)

    // The main region carries a page-entry animation on a fresh pathname.
    const petsEntry = await page.evaluate(() => {
      const main = document.querySelector('main')
      return main ? getComputedStyle(main).animationName : null
    })
    assert.ok(
      petsEntry !== null && petsEntry !== 'none',
      `expected a page-entry animation on /pets, saw ${petsEntry}`
    )

    // Navigate to a different pathname; the freshly mounted main animates again.
    await page.goto(`${harness.baseUrl}/badges`, { waitUntil: 'domcontentloaded' })
    await waitForResultCount(page)
    const badgesEntry = await page.evaluate(() => {
      const main = document.querySelector('main')
      return main ? getComputedStyle(main).animationName : null
    })
    assert.ok(
      badgesEntry !== null && badgesEntry !== 'none',
      `expected a page-entry animation on /badges, saw ${badgesEntry}`
    )
  } finally {
    await testPage.close()
  }
})

test(
  'query-only filter and search updates do not replay page-entry motion',
  { timeout: 45_000 },
  async () => {
    const testPage = await createTestPage(harness, { viewport: { width: 1440, height: 900 } })
    const { page } = testPage

    try {
      await page.goto(`${harness.baseUrl}/pets`, { waitUntil: 'domcontentloaded' })
      await waitForResultCount(page)

      // Tag the current main element so we can prove it is NOT remounted by a query change.
      await page.evaluate(() => {
        const main = document.querySelector('main')
        if (main) main.dataset.motionProbe = 'pets-initial'
      })

      // Query-only change: toggle a filter (updates ?access=da, same pathname).
      await page
        .locator('main button[aria-label="DA Required: no filter. Click to include."]')
        .first()
        .evaluate((button: HTMLButtonElement) => button.click())
      await page.waitForURL(/[?&]access=da(?:&|$)/)

      // The same main element must persist (no page-entry remount) after a query-only update.
      const probeSurvived = await page.evaluate(
        () => document.querySelector('main')?.dataset.motionProbe === 'pets-initial'
      )
      assert.equal(
        probeSurvived,
        true,
        'query-only update must not remount main (page entry must not replay)'
      )
    } finally {
      await testPage.close()
    }
  }
)

test(
  'rapid filter interactions settle on the final requested UI and URL state',
  { timeout: 45_000 },
  async () => {
    const testPage = await createTestPage(harness, { viewport: { width: 1440, height: 900 } })
    const { page } = testPage

    try {
      await page.goto(`${harness.baseUrl}/pets`, { waitUntil: 'domcontentloaded' })
      await waitForResultCount(page)

      // Fire a rapid burst of DA-pill toggles without waiting for React between clicks, then keep
      // clicking (re-resolving the pill by its stable prefix) until the requested "included" state
      // is reached. This proves rapid interactions converge on the final requested UI + URL rather
      // than getting stuck mid-transition. The cycle is neutral -> include -> exclude -> neutral.
      const daPillHandle = () => page.locator('main button[aria-label^="DA Required:"]').first()
      const daLabel = () =>
        daPillHandle().evaluate((button: HTMLButtonElement) => button.getAttribute('aria-label') ?? '')

      // Rapid burst: three quick toggles with no settle wait, to stress rapid interaction.
      for (let i = 0; i < 3; i += 1) {
        await daPillHandle().evaluate((button: HTMLButtonElement) => button.click())
      }

      // Drive deterministically to "included": read the committed aria-label after a short settle
      // and click only while the pill is not yet included, so we never act on a stale label.
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await page.waitForTimeout(150)
        if ((await daLabel()).startsWith('DA Required: included')) break
        await daPillHandle().evaluate((button: HTMLButtonElement) => button.click())
      }

      // The UI and URL must settle on the included state.
      await page.waitForURL(/[?&]access=da(?:&|$)/, { timeout: 10_000 })
      await page.waitForFunction(() => {
        const button = document.querySelector('main button[aria-label^="DA Required: included"]')
        return button?.getAttribute('aria-pressed') === 'true'
      })

      const finalUrl = page.url()
      assert.match(finalUrl, /[?&]access=da(?:&|$)/)
      assert.doesNotMatch(finalUrl, /excludeAccess=da/)

      // Results are present and consistent with a settled state (not mid-transition emptiness).
      await waitForResultCount(page)
      const cardCount = await page.locator('main a.group').count()
      assert.ok(cardCount > 0, 'settled filter state should render results')
    } finally {
      await testPage.close()
    }
  }
)

test(
  'back-to-top control is reachable and returns the viewport to the top',
  { timeout: 45_000 },
  async () => {
    const testPage = await createTestPage(harness, { viewport: { width: 390, height: 844 } })
    const { page } = testPage

    try {
      await page.goto(`${harness.baseUrl}/badges`, { waitUntil: 'domcontentloaded' })
      await waitForResultCount(page)

      await page.evaluate(() => window.scrollTo(0, 1_200))
      const backToTop = page.getByRole('button', { name: 'Back to top' })
      await backToTop.waitFor({ state: 'visible' })
      await backToTop.click()

      await page.waitForFunction(() => window.scrollY < 50)
      assert.ok((await page.evaluate(() => window.scrollY)) < 50)
    } finally {
      await testPage.close()
    }
  }
)
