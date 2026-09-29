import { fileURLToPath } from 'node:url'
import { chromium, type Browser, type BrowserContextOptions, type Page } from 'playwright'
import { createServer, type ViteDevServer } from 'vite'

const PROJECT_ROOT = fileURLToPath(new URL('../..', import.meta.url))

export interface AppHarness {
  baseUrl: string
  browser: Browser
  server: ViteDevServer
}

export interface TestPage {
  close: () => Promise<void>
  page: Page
}

export async function startAppHarness(): Promise<AppHarness> {
  const server = await createServer({
    configFile: `${PROJECT_ROOT}/vite.config.ts`,
    root: PROJECT_ROOT,
    logLevel: 'silent',
    server: {
      host: '127.0.0.1',
      port: 0,
    },
  })

  await server.listen()
  const address = server.httpServer?.address()
  if (!address || typeof address === 'string') {
    await server.close()
    throw new Error('Vite did not expose a loopback test port')
  }

  try {
    const browser = await chromium.launch({ headless: true })
    return {
      baseUrl: `http://127.0.0.1:${address.port}`,
      browser,
      server,
    }
  } catch (error) {
    await server.close()
    throw error
  }
}

export async function stopAppHarness(harness: AppHarness): Promise<void> {
  await harness.browser.close()
  await harness.server.close()
}

export async function createTestPage(
  harness: AppHarness,
  options: BrowserContextOptions = {}
): Promise<TestPage> {
  const context = await harness.browser.newContext(options)
  const page = await context.newPage()
  return {
    page,
    close: () => context.close(),
  }
}

export async function waitForResultCount(page: Page): Promise<void> {
  await page
    .locator('main')
    .getByText(/\d+ (?:badges?|entries) found/i)
    .first()
    .waitFor({ state: 'visible', timeout: 30_000 })
}
