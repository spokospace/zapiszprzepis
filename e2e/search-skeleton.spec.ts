import { expect, test, type Page } from '@playwright/test'

/**
 * /szukaj is a saved page: everyone first gets its skeleton, and the results arrive from the
 * database in the browser. The skeleton must land where they do, so nothing jumps. This reads
 * the skeleton twice, as saved (no JavaScript) and while the search request is held, then
 * releases the request and reads the real page. Guest-only and read-only.
 *
 * Needs a production server, like recipe-skeleton.spec.ts:
 *   pnpm build && E2E_PORT=7733 pnpm exec next start -p 7733
 *   E2E_PORT=7733 pnpm test:skeleton
 */

const WIDTHS = [360, 390, 768, 1024, 1280, 1920]
/** Pixels of slack for x, width and the top offset. */
const TOL = 2
const PATH = '/szukaj?q=ciasto'

interface Box {
  x: number
  y: number
  w: number
  h: number
}

interface Boxes {
  tabs: Box
  cards: Box
  /** Below lg only: from lg the field is in the app header. */
  field: Box | null
}

async function readBoxes(page: Page, selectors: { tabs: string; cards: string; field: string }): Promise<Boxes> {
  return page.evaluate((s) => {
    const rect = (selector: string) => {
      const el = document.querySelector(selector)
      if (!el) return null
      const r = el.getBoundingClientRect()
      if (r.width === 0) return null
      return { x: Math.round(r.x), y: Math.round(r.y + window.scrollY), w: Math.round(r.width), h: Math.round(r.height) }
    }
    const tabs = rect(s.tabs)
    const cards = rect(s.cards)
    if (!tabs || !cards) throw new Error('search block not found')
    return { tabs, cards, field: rect(s.field) }
  }, selectors)
}

const SKELETON = {
  tabs: 'main [data-skeleton="tabs"]',
  cards: 'main [data-skeleton="cards"]',
  field: 'main [data-skeleton="field"]',
}
const PAGE = { tabs: 'main [role="tablist"]', cards: 'main ol', field: 'main form[role="search"]' }

function expectSame(skeleton: Boxes, real: Boxes, label: string) {
  for (const key of ['tabs', 'cards'] as const) {
    expect(Math.abs(skeleton[key].x - real[key].x), `${label}: ${key} x`).toBeLessThanOrEqual(TOL)
    expect(Math.abs(skeleton[key].y - real[key].y), `${label}: ${key} top`).toBeLessThanOrEqual(TOL)
    expect(Math.abs(skeleton[key].w - real[key].w), `${label}: ${key} width`).toBeLessThanOrEqual(TOL)
  }
  expect(Math.abs(skeleton.tabs.h - real.tabs.h), `${label}: tabs height`).toBeLessThanOrEqual(TOL)
}

for (const width of WIDTHS) {
  test(`search skeleton matches the results at ${width} px`, async ({ page, browser }) => {
    await page.setViewportSize({ width, height: 900 })

    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    await page.route('**/rest/v1/rpc/search_recipes', async (route) => {
      await gate
      await route.continue()
    })

    await page.goto(PATH)
    await expect(page.getByText('Szukamy przepisów…')).toBeAttached()
    await expect(page.locator(SKELETON.cards)).toBeVisible()
    // Hydrated: the real field is on the page below lg, and the skeleton is the screen's own.
    const held = await readBoxes(page, SKELETON)

    release()
    await expect(page.locator(PAGE.cards)).toBeVisible({ timeout: 30_000 })
    const real = await readBoxes(page, PAGE)
    expectSame(held, real, 'held')

    const saved = await browser.newContext({ javaScriptEnabled: false, viewport: { width, height: 900 } })
    const file = await saved.newPage()
    await file.goto(PATH)
    const fallback = await readBoxes(file, SKELETON)
    expectSame(fallback, real, 'saved')
    if (real.field && fallback.field) {
      expect(Math.abs(fallback.field.y - real.field.y), 'field top').toBeLessThanOrEqual(TOL)
      expect(Math.abs(fallback.field.h - real.field.h), 'field height').toBeLessThanOrEqual(TOL)
    }
    await saved.close()
  })
}
