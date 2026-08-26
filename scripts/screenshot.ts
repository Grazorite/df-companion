/**
 * Visual verification utility for AI agents.
 *
 * Takes a screenshot of a running dev server page and saves it to .tmp/screenshots/.
 * Requires `npm run dev` to be running on localhost:5173.
 *
 * Usage:
 *   npx tsx scripts/screenshot.ts <path-or-url> [--width=1280] [--height=720] [--full-page] [--name=custom-name]
 *
 * Examples:
 *   npx tsx scripts/screenshot.ts /housing?type=wall-item&category=effect
 *   npx tsx scripts/screenshot.ts /pets/goldfish-knight --width=1440 --height=900
 *   npx tsx scripts/screenshot.ts /classes --full-page --name=classes-overview
 *   npx tsx scripts/screenshot.ts http://localhost:5173/badges
 *
 * Output:
 *   .tmp/screenshots/<timestamp>-<slug>.png
 *   Prints the output path to stdout for the calling agent to read_file or view.
 */

import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
import { resolve } from 'path'

const DEV_SERVER = 'http://localhost:5173'
const OUTPUT_DIR = resolve(import.meta.dirname, '..', '.tmp', 'screenshots')

function parseArgs(args: string[]) {
  let pathOrUrl = ''
  let width = 1280
  let height = 720
  let fullPage = false
  let name = ''

  for (const arg of args) {
    if (arg.startsWith('--width=')) {
      width = parseInt(arg.slice(8), 10)
    } else if (arg.startsWith('--height=')) {
      height = parseInt(arg.slice(9), 10)
    } else if (arg === '--full-page') {
      fullPage = true
    } else if (arg.startsWith('--name=')) {
      name = arg.slice(7)
    } else if (!arg.startsWith('--')) {
      pathOrUrl = arg
    }
  }

  return { pathOrUrl, width, height, fullPage, name }
}

async function main() {
  const { pathOrUrl, width, height, fullPage, name } = parseArgs(process.argv.slice(2))

  if (!pathOrUrl) {
    console.error('Usage: npx tsx scripts/screenshot.ts <path-or-url> [options]')
    console.error('  e.g. npx tsx scripts/screenshot.ts /housing?type=wall-item')
    process.exit(1)
  }

  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${DEV_SERVER}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`

  mkdirSync(OUTPUT_DIR, { recursive: true })

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const slug = name || pathOrUrl.replace(/^https?:\/\/[^/]+/, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'page'
  const filename = `${timestamp}-${slug}.png`
  const outputPath = resolve(OUTPUT_DIR, filename)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width, height } })
  const page = await context.newPage()

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    // Allow any animations/transitions to settle
    await page.waitForTimeout(500)
    await page.screenshot({ path: outputPath, fullPage })
    console.log(outputPath)
  } catch (error) {
    console.error(`Failed to screenshot ${url}:`, error instanceof Error ? error.message : error)
    process.exit(1)
  } finally {
    await browser.close()
  }
}

main()
