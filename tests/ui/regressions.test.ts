import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import type { AppHarness } from './harness.ts'
import { createTestPage, startAppHarness, stopAppHarness, waitForResultCount } from './harness.ts'

const GALLERY_BUDGETS = [
  { path: '/badges', minimumResults: 100 },
  { path: '/pets', minimumResults: 250 },
  { path: '/accessories?type=helm', minimumResults: 900 },
  { path: '/weapons?type=sword-axe-mace', minimumResults: 800 },
  { path: '/housing?type=wall-item', minimumResults: 150 },
  { path: '/classes?type=class', minimumResults: 100 },
] as const

let harness: AppHarness

before(async () => {
  harness = await startAppHarness()
})

after(async () => {
  await stopAppHarness(harness)
})

test(
  'large galleries preserve total results while mounting a bounded first batch',
  { timeout: 90_000 },
  async () => {
    const testPage = await createTestPage(harness, { viewport: { width: 390, height: 844 } })
    const { page } = testPage

    try {
      for (const budget of GALLERY_BUDGETS) {
        await page.goto(`${harness.baseUrl}${budget.path}`, { waitUntil: 'domcontentloaded' })
        await waitForResultCount(page)

        const metrics = await page.evaluate(() => ({
          cards: document.querySelectorAll('main a.group').length,
          nodes: document.querySelectorAll('*').length,
          resultText: document.querySelector('main [aria-live="polite"]')?.textContent ?? '',
        }))
        const totalResults = Number(metrics.resultText.match(/\d+/)?.[0] ?? 0)

        assert.ok(
          totalResults >= budget.minimumResults,
          `${budget.path} reported only ${totalResults} results`
        )
        assert.ok(
          metrics.cards > 0 && metrics.cards <= 48,
          `${budget.path} mounted ${metrics.cards} cards instead of a bounded mobile batch`
        )
        assert.ok(
          metrics.cards < totalResults,
          `${budget.path} should filter the full dataset while rendering only a window`
        )
        assert.ok(
          metrics.nodes <= 2_500,
          `${budget.path} rendered ${metrics.nodes} DOM nodes above the optimized ceiling`
        )
        assert.equal(
          await page.getByRole('button', { name: /^Filters, \d+ active$/ }).count(),
          1,
          `${budget.path} should expose one mobile filter trigger`
        )
      }
    } finally {
      await testPage.close()
    }
  }
)

test(
  'progressive galleries append unique cards and reset after search',
  { timeout: 60_000 },
  async () => {
    const testPage = await createTestPage(harness, { viewport: { width: 390, height: 844 } })
    const { page } = testPage

    try {
      await page.goto(`${harness.baseUrl}/accessories?type=helm`, {
        waitUntil: 'domcontentloaded',
      })
      await waitForResultCount(page)

      const initialCards = await page.locator('main a.group').count()
      assert.equal(initialCards, 48)

      await page.getByRole('button', { name: /Show more results/i }).click()
      const expandedCards = await page.locator('main a.group').count()
      assert.ok(expandedCards > initialCards)

      const hrefs = await page
        .locator('main a.group')
        .evaluateAll((cards) => cards.map((card) => card.getAttribute('href')))
      assert.equal(new Set(hrefs).size, hrefs.length)

      const search = page.getByRole('searchbox')
      await search.fill('helm')
      assert.equal(await search.inputValue(), 'helm')
      await page.waitForURL(/q=helm/, { timeout: 10_000 })
      await page.waitForFunction(() => document.querySelectorAll('main a.group').length <= 48)
      assert.ok((await page.locator('main a.group').count()) <= 48)
    } finally {
      await testPage.close()
    }
  }
)

test(
  'search updates visible results before the URL debounce settles',
  { timeout: 45_000 },
  async () => {
    const testPage = await createTestPage(harness, { viewport: { width: 390, height: 844 } })
    const { page } = testPage

    try {
      await page.goto(`${harness.baseUrl}/weapons?type=sword-axe-mace`, {
        waitUntil: 'domcontentloaded',
      })
      await waitForResultCount(page)

      const search = page.getByRole('searchbox')
      await search.fill('abyssal')
      await page
        .locator('main [aria-live="polite"]')
        .filter({ hasText: /^4 entries found/ })
        .waitFor({ state: 'visible', timeout: 280 })
      assert.doesNotMatch(page.url(), /[?&]q=abyssal(?:&|$)/)

      await page.waitForURL(/q=abyssal/, { timeout: 10_000 })
    } finally {
      await testPage.close()
    }
  }
)

test('desktop galleries use the larger bounded batch', { timeout: 45_000 }, async () => {
  const testPage = await createTestPage(harness, { viewport: { width: 1440, height: 900 } })
  const { page } = testPage

  try {
    await page.goto(`${harness.baseUrl}/pets`, { waitUntil: 'domcontentloaded' })
    await waitForResultCount(page)
    await page.waitForFunction(() => document.querySelectorAll('main a.group').length === 72)
    assert.equal(await page.locator('main a.group').count(), 72)
  } finally {
    await testPage.close()
  }
})

for (const returnMethod of ['in-app Back link', 'browser Back'] as const) {
  test(
    `${returnMethod} restores the originating card, scroll, and focus`,
    { timeout: 45_000 },
    async () => {
      const testPage = await createTestPage(harness, { viewport: { width: 390, height: 844 } })
      const { page } = testPage

      try {
        await page.goto(`${harness.baseUrl}/pets`, { waitUntil: 'domcontentloaded' })
        await waitForResultCount(page)
        await page.getByRole('button', { name: /Show more results/i }).click()
        const card = page.locator('main a.group').nth(80)
        const cardHref = await card.getAttribute('href')
        await card.scrollIntoViewIfNeeded()
        const savedScroll = await page.evaluate(() => window.scrollY)
        await card.click()
        await page.locator('main h1').waitFor()

        if (returnMethod === 'browser Back') {
          await page.goBack({ waitUntil: 'domcontentloaded' })
        } else {
          await page.getByRole('link', { name: /Back to Pets & Guests/i }).click()
        }
        await page.getByRole('heading', { name: 'Pets & Guests' }).waitFor()

        await page.waitForFunction(
          ({ expectedHref, expectedScroll }) =>
            document.activeElement?.getAttribute('href') === expectedHref &&
            Math.abs(window.scrollY - expectedScroll) <= 20,
          { expectedHref: cardHref, expectedScroll: savedScroll }
        )
        const restoredScroll = await page.evaluate(() => window.scrollY)
        const focusedHref = await page.evaluate(() => document.activeElement?.getAttribute('href'))
        assert.ok(Math.abs(restoredScroll - savedScroll) <= 20)
        assert.equal(focusedHref, cardHref)
      } finally {
        await testPage.close()
      }
    }
  )
}

test(
  'direct detail navigation starts focus at the detail heading',
  { timeout: 45_000 },
  async () => {
    const testPage = await createTestPage(harness, { viewport: { width: 390, height: 844 } })
    const { page } = testPage

    try {
      await page.goto(`${harness.baseUrl}/pets/pet-dragon`, { waitUntil: 'domcontentloaded' })
      const heading = page.locator('main h1')
      await heading.waitFor()
      await page.waitForFunction(() => document.activeElement === document.querySelector('main h1'))
      assert.match((await heading.textContent()) ?? '', /Dragon/)
      assert.match(
        (await page.locator('[aria-live="polite"]').first().textContent()) ?? '',
        /Dragon/
      )
    } finally {
      await testPage.close()
    }
  }
)

test(
  'query-only filter changes preserve the current scroll position',
  { timeout: 45_000 },
  async () => {
    const testPage = await createTestPage(harness, { viewport: { width: 390, height: 844 } })
    const { page } = testPage

    try {
      await page.goto(`${harness.baseUrl}/pets`, { waitUntil: 'domcontentloaded' })
      await waitForResultCount(page)
      await page.evaluate(() => window.scrollTo(0, 1_000))
      const savedScroll = await page.evaluate(() => window.scrollY)

      await page
        .locator('main button[aria-label="DA Required: no filter. Click to include."]')
        .evaluate((button: HTMLButtonElement) => button.click())
      await page.waitForURL(/[?&]access=da(?:&|$)/)

      const currentScroll = await page.evaluate(() => window.scrollY)
      assert.ok(
        Math.abs(currentScroll - savedScroll) <= 20,
        `query update moved scroll from ${savedScroll}px to ${currentScroll}px`
      )
    } finally {
      await testPage.close()
    }
  }
)

test('lazy detail routes show a detail-shaped fallback', { timeout: 45_000 }, async () => {
  const testPage = await createTestPage(harness, { viewport: { width: 390, height: 844 } })
  const { page } = testPage
  let releaseModule!: () => void
  const moduleGate = new Promise<void>((resolve) => {
    releaseModule = resolve
  })

  try {
    await page.route('**/src/pages/PetDetailPage.tsx*', async (route) => {
      await moduleGate
      await route.continue()
    })

    const navigation = page.goto(`${harness.baseUrl}/pets/pet-dragon`, {
      waitUntil: 'domcontentloaded',
    })
    try {
      await page.getByTestId('detail-page-skeleton').waitFor({ timeout: 5_000 })
    } finally {
      releaseModule()
      await navigation
    }
  } finally {
    releaseModule()
    await testPage.close()
  }
})

test('mobile More menu manages dismissal and focus', { timeout: 45_000 }, async () => {
  const testPage = await createTestPage(harness, { viewport: { width: 390, height: 844 } })
  const { page } = testPage

  try {
    await page.goto(`${harness.baseUrl}/`, { waitUntil: 'domcontentloaded' })
    const trigger = page.getByRole('button', { name: 'More sections' })

    await trigger.click()
    const panel = page.getByRole('dialog', { name: 'More sections' })
    await panel.waitFor()
    assert.equal(
      await panel
        .getByRole('button', { name: 'Search' })
        .evaluate((el) => el === document.activeElement),
      true
    )

    await page.keyboard.press('Escape')
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false')
    assert.equal(await trigger.evaluate((el) => el === document.activeElement), true)

    await trigger.click()
    await page.mouse.click(8, 8)
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false')

    await trigger.click()
    await panel.getByRole('button', { name: 'Close more sections' }).click()
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false')

    await trigger.click()
    await panel.getByRole('link', { name: /Classes \/ Abilities/ }).click()
    await page.waitForURL(/\/classes$/)
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false')
  } finally {
    await testPage.close()
  }
})

test('mobile browse controls provide 44px touch targets', { timeout: 45_000 }, async () => {
  const testPage = await createTestPage(harness, { viewport: { width: 390, height: 844 } })
  const { page } = testPage

  try {
    await page.goto(`${harness.baseUrl}/pets`, { waitUntil: 'domcontentloaded' })
    await waitForResultCount(page)
    await page.getByRole('button', { name: 'Filters, 0 active' }).click()

    const undersizedControls = await page
      .locator('button[aria-pressed]:visible')
      .evaluateAll((buttons) =>
        buttons
          .map((button) => ({
            height: button.getBoundingClientRect().height,
            label: button.getAttribute('aria-label') ?? button.textContent?.trim() ?? 'unlabelled',
          }))
          .filter(({ height }) => height < 44)
      )
    assert.deepEqual(undersizedControls, [])
  } finally {
    await testPage.close()
  }
})

test(
  'mobile filter panel round-trips URL state and preserves the primary subtype',
  { timeout: 45_000 },
  async () => {
    const testPage = await createTestPage(harness, { viewport: { width: 390, height: 844 } })
    const { page } = testPage

    try {
      page.setDefaultTimeout(5_000)
      await page.goto(`${harness.baseUrl}/pets?type=pet&access=da&category=rare&element=NAT`, {
        waitUntil: 'domcontentloaded',
      })
      await waitForResultCount(page)

      const trigger = page.getByRole('button', { name: 'Filters, 3 active' })
      await trigger.click()
      const panel = page.getByRole('dialog', { name: 'Filters' })
      await panel.waitFor()
      assert.equal(
        await panel
          .getByRole('button', { name: 'DA Required: included. Click to exclude.' })
          .getAttribute('aria-pressed'),
        'true'
      )
      assert.equal(
        await panel
          .getByRole('button', { name: 'Rare: included. Click to exclude.' })
          .getAttribute('aria-pressed'),
        'true'
      )
      assert.equal(
        await panel
          .getByRole('button', { name: 'NAT: included. Click to exclude.' })
          .getAttribute('aria-pressed'),
        'true'
      )

      await page.keyboard.press('Escape')
      assert.equal(await trigger.evaluate((element) => element === document.activeElement), true)
      await page.reload({ waitUntil: 'domcontentloaded' })
      await waitForResultCount(page)
      await page.getByRole('button', { name: 'Filters, 3 active' }).click()
      await page
        .getByRole('dialog', { name: 'Filters' })
        .getByRole('button', { name: 'Clear all' })
        .click()
      await page.waitForURL(/\/pets\?type=pet$/)
    } finally {
      await testPage.close()
    }
  }
)

test('mobile bottom navigation does not cover the final result', { timeout: 45_000 }, async () => {
  const testPage = await createTestPage(harness, { viewport: { width: 390, height: 844 } })
  const { page } = testPage

  try {
    await page.goto(`${harness.baseUrl}/badges`, { waitUntil: 'domcontentloaded' })
    await waitForResultCount(page)

    const showMore = page.getByRole('button', { name: /Show more results/i })
    for (let batch = 0; batch < 8 && (await showMore.count()) > 0; batch += 1) {
      await showMore.click()
    }

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    const positions = await page.evaluate(() => {
      const finalCard = Array.from(document.querySelectorAll<HTMLElement>('main a.group')).at(-1)
      const navigation = Array.from(
        document.querySelectorAll<HTMLElement>('nav[aria-label="Main navigation"]')
      ).find((element) => element.getBoundingClientRect().height > 0)
      return {
        cardBottom: finalCard?.getBoundingClientRect().bottom ?? Number.POSITIVE_INFINITY,
        navigationTop: navigation?.getBoundingClientRect().top ?? 0,
      }
    })
    assert.ok(
      positions.cardBottom <= positions.navigationTop,
      `final card ends at ${positions.cardBottom}px behind navigation beginning at ${positions.navigationTop}px`
    )
  } finally {
    await testPage.close()
  }
})
