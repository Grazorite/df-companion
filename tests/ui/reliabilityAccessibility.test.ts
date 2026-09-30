import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import type { Page } from 'playwright'
import type { AppHarness } from './harness.ts'
import { createTestPage, startAppHarness, stopAppHarness, waitForResultCount } from './harness.ts'

let harness: AppHarness

before(async () => {
  harness = await startAppHarness()
})

after(async () => {
  await stopAppHarness(harness)
})

function isDatasetContentRequest(url: URL, filename: string) {
  return url.pathname.endsWith(`/${filename}`) && !/[?&]import(?:&|=|$)/.test(url.href)
}

async function openPets(page: Page) {
  await page.goto(`${harness.baseUrl}/pets`, { waitUntil: 'domcontentloaded' })
  await page.locator('main h1').waitFor()
}

test('dataset failure is distinct from an empty result and retry recovers without reload', async () => {
  const testPage = await createTestPage(harness, { viewport: { width: 1440, height: 900 } })
  const { page } = testPage
  let failedRequests = 0

  try {
    await page.route(
      (url) => isDatasetContentRequest(url, 'pets.json'),
      (route) => {
        failedRequests += 1
        return route.abort()
      }
    )

    await openPets(page)

    const alert = page.getByRole('alert')
    await alert.waitFor({ state: 'visible', timeout: 10_000 })
    assert.match((await alert.textContent()) ?? '', /couldn.t load|unable to load/i)
    assert.equal(await page.getByText(/No entries found/i).count(), 0)

    await page.unrouteAll({ behavior: 'wait' })
    await page.getByRole('button', { name: /try again|retry/i }).click()
    await waitForResultCount(page)

    assert.ok(failedRequests >= 1)
    assert.equal(await page.getByRole('alert').count(), 0)
    assert.ok((await page.locator('main a.group').count()) > 0)
  } finally {
    await page.unrouteAll({ behavior: 'ignoreErrors' })
    await testPage.close()
  }
})

test('a valid zero-result search remains an empty state without retry UI', async () => {
  const testPage = await createTestPage(harness, { viewport: { width: 1440, height: 900 } })
  const { page } = testPage

  try {
    await openPets(page)
    await waitForResultCount(page)
    await page.getByRole('searchbox').fill('no-such-dragonfable-entry-zzzz')
    await page.getByText(/No entries found/i).waitFor({ state: 'visible' })

    assert.equal(await page.getByRole('alert').count(), 0)
    assert.equal(await page.getByRole('button', { name: /try again|retry/i }).count(), 0)
  } finally {
    await testPage.close()
  }
})

test('element legend is keyboard operable and exposes collapsible semantics', async () => {
  const testPage = await createTestPage(harness, { viewport: { width: 1440, height: 900 } })
  const { page } = testPage

  try {
    await openPets(page)
    await waitForResultCount(page)

    const trigger = page.getByRole('button', { name: 'Legend' })
    await trigger.focus()
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false')
    assert.ok(await trigger.getAttribute('aria-controls'))

    await page.keyboard.press('Enter')
    assert.equal(await trigger.getAttribute('aria-expanded'), 'true')
    await page.getByText('Elements', { exact: true }).waitFor({ state: 'visible' })

    await page.keyboard.press('Space')
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false')
    assert.equal(await trigger.evaluate((element) => element === document.activeElement), true)
  } finally {
    await testPage.close()
  }
})

test('route headings produce useful document titles', async () => {
  const testPage = await createTestPage(harness, { viewport: { width: 1440, height: 900 } })
  const { page } = testPage

  try {
    await openPets(page)
    await page.waitForFunction(() => document.title.includes('Pets'))
    assert.match(await page.title(), /Pets.*DragonFable Companion/i)

    const firstCard = page.locator('main a.group').first()
    const cardName = (await firstCard.locator('h2, h3').first().textContent())?.trim()
    await firstCard.click()
    const heading = page.locator('main h1')
    await heading.waitFor()
    await page.waitForFunction(
      (text) => Boolean(text && document.title.includes(text)),
      (await heading.textContent())?.trim()
    )
    assert.ok(cardName)
    assert.match(await page.title(), /DragonFable Companion/i)
  } finally {
    await testPage.close()
  }
})

test('shipped list routes expose one main landmark and named interactive controls', async () => {
  const testPage = await createTestPage(harness, { viewport: { width: 1440, height: 900 } })
  const { page } = testPage
  const routes = ['/badges', '/pets', '/accessories', '/weapons', '/housing', '/classes']

  try {
    for (const route of routes) {
      await page.goto(`${harness.baseUrl}${route}`, { waitUntil: 'domcontentloaded' })
      await waitForResultCount(page)

      assert.equal(
        await page.locator('main').count(),
        1,
        `${route} should expose one main landmark`
      )
      const heading = page.locator('main h1')
      assert.equal(await heading.count(), 1, `${route} should expose one primary heading`)
      const headingText = (await heading.textContent())?.trim() ?? ''
      await page.waitForFunction((text) => document.title.includes(text), headingText)

      const unnamed = await page
        .locator(
          'main button:visible, main a[href]:visible, main input:visible, main select:visible'
        )
        .evaluateAll((elements) =>
          elements
            .filter((element) => {
              const labelledBy = element.getAttribute('aria-labelledby')
              const labelledText = labelledBy
                ? labelledBy
                    .split(/\s+/)
                    .map((id) => document.getElementById(id)?.textContent ?? '')
                    .join(' ')
                : ''
              const imageAlt = Array.from(element.querySelectorAll('img'))
                .map((image) => image.alt)
                .join(' ')
              const name = [
                element.getAttribute('aria-label'),
                labelledText,
                element.textContent,
                element.getAttribute('placeholder'),
                element.getAttribute('title'),
                imageAlt,
              ]
                .filter(Boolean)
                .join(' ')
                .trim()
              return name.length === 0
            })
            .map((element) => element.outerHTML.slice(0, 160))
        )

      assert.deepEqual(unnamed, [], `${route} has unnamed interactive controls`)
    }
  } finally {
    await testPage.close()
  }
})

test('result announcements debounce rapid search input', async () => {
  const testPage = await createTestPage(harness, { viewport: { width: 1440, height: 900 } })
  const { page } = testPage

  try {
    await openPets(page)
    await waitForResultCount(page)

    const announcement = page.getByTestId('results-announcement')
    await assert.doesNotReject(() =>
      announcement
        .waitFor({ state: 'attached' })
        .then(() =>
          page.waitForFunction(() =>
            /entries found/i.test(
              document.querySelector('[data-testid="results-announcement"]')?.textContent ?? ''
            )
          )
        )
    )
    const initial = (await announcement.textContent())?.trim()
    assert.match(initial ?? '', /entries found/i)

    await page.getByRole('searchbox').pressSequentially('zzzzzz', { delay: 20 })
    await page.waitForTimeout(100)
    assert.equal((await announcement.textContent())?.trim(), initial)

    await page.waitForFunction(
      (previous) =>
        document.querySelector('[data-testid="results-announcement"]')?.textContent?.trim() !==
        previous,
      initial,
      { timeout: 2_000 }
    )
    assert.match((await announcement.textContent()) ?? '', /0 entries found/i)
  } finally {
    await testPage.close()
  }
})
