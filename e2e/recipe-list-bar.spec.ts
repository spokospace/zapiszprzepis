import { expect, test, type Page } from '@playwright/test'

/**
 * Desktop placement of the list-position link and the breadcrumbs (#574). They sit in
 * the recipe header's text column, above the title, from lg. Before the fix they were a
 * full-width row above the whole header, which added roughly 104 px of vertical space
 * before the photo. Measured from the laid-out DOM, not from class strings.
 *
 * Guest-only and read-only, like recipe-layout.spec.ts: it only reads the live page.
 * Run: pnpm test:reflow (project `layout`).
 */

// The header starts right under <main>'s top padding (py-8 = 32 px). The old full-width
// row put the header 104 px down. The floor leaves room for the padding and a small gap.
const MAX_HEADER_OFFSET = 48

/** First live recipe reachable from a category, so the test runs against real content. */
async function firstRecipePath(page: Page): Promise<string> {
  const res = await page.goto('/przepisy/ciasta')
  expect(res?.status(), '/przepisy/ciasta did not render').toBe(200)
  const href = await page.locator('main a[href^="/przepis/"]').first().getAttribute('href')
  expect(href, 'no recipe link on /przepisy/ciasta').toBeTruthy()
  return new URL(href!, 'http://x').pathname
}

/** Boxes of the header, the title and the breadcrumbs, read from the rendered page. */
function measureListBar() {
  const main = document.querySelector('main')
  const header = main?.querySelector('header')
  const title = header?.querySelector('h1')
  if (!main || !header || !title) return { error: 'recipe header (main > header > h1) not found' }
  // The breadcrumbs are the only "Przepisy" link in the header; from lg they are visible.
  const crumbs = [...header.querySelectorAll('a')].find((a) => a.textContent?.trim() === 'Przepisy')
  if (!crumbs) return { error: 'breadcrumbs („Przepisy”) not found in the recipe header' }

  const mainBox = main.getBoundingClientRect()
  const headerBox = header.getBoundingClientRect()
  const titleBox = title.getBoundingClientRect()
  const crumbsBox = crumbs.getBoundingClientRect()
  return {
    headerOffset: Math.round(headerBox.top - mainBox.top),
    crumbsAboveTitle: crumbsBox.bottom <= titleBox.top,
    crumbsInHeaderColumn: crumbsBox.right <= headerBox.right && crumbsBox.left >= headerBox.left,
  }
}

test.describe('desktop (lg)', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('the list bar and breadcrumbs sit above the title, not in a row over the header', async ({ page }) => {
    const path = await firstRecipePath(page)
    const res = await page.goto(path)
    expect(res?.status(), `${path} did not render`).toBe(200)
    await page.waitForLoadState('networkidle')

    const measured = await page.evaluate(measureListBar)
    expect(measured, 'error' in measured ? measured.error : undefined).not.toHaveProperty('error')
    const { headerOffset, crumbsAboveTitle, crumbsInHeaderColumn } = measured as {
      headerOffset: number
      crumbsAboveTitle: boolean
      crumbsInHeaderColumn: boolean
    }

    expect(headerOffset, `the header starts ${headerOffset} px below <main>; the old row put it at ~104 px (need ≤ ${MAX_HEADER_OFFSET})`).toBeLessThanOrEqual(MAX_HEADER_OFFSET)
    expect(crumbsAboveTitle, 'the breadcrumbs should sit above the title').toBe(true)
    expect(crumbsInHeaderColumn, 'the breadcrumbs should sit inside the header column').toBe(true)
  })
})
