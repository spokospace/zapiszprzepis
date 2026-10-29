import { expect, test, type Page } from '@playwright/test'

/**
 * Placement of the list-position link and the breadcrumbs (#574, then the 2026-10-28
 * handoff). From lg they sit in one row above the recipe header: "← {lista} · N z M" on
 * the left, "Przepisy › {Kategoria} › {Przepis}" on the right. The row is a single 44 px
 * line, not the full-width block #574 removed. Below lg the list bar stays hidden (C3);
 * the phone list nav sits at the end of the recipe. Measured from the laid-out DOM, not
 * from class strings.
 *
 * Guest-only and read-only, like recipe-layout.spec.ts: it only reads the live page.
 * Run: pnpm test:reflow (project `layout`).
 */

// The phone header starts right under <main>'s top padding (py-8 = 32 px) with no row above it.
const MAX_HEADER_OFFSET = 48
// The row is min-h 44 px; a little slack for wrapping at the lg width.
const MAX_LIST_ROW_HEIGHT = 56

/** First live recipe reachable from a category, so the test runs against real content. */
async function firstRecipePath(page: Page): Promise<string> {
  const res = await page.goto('/przepisy/ciasta')
  expect(res?.status(), '/przepisy/ciasta did not render').toBe(200)
  const href = await page.locator('main a[href^="/przepis/"]').first().getAttribute('href')
  expect(href, 'no recipe link on /przepisy/ciasta').toBeTruthy()
  return new URL(href!, 'http://x').pathname
}

/** Pixels from the top of <main> to the first element matching `selector`, or null. */
function offsetFromMain(page: Page, selector: string): Promise<number | null> {
  return page.evaluate((sel) => {
    const main = document.querySelector('main')
    const el = main?.querySelector(sel)
    if (!main || !el) return null
    return Math.round(el.getBoundingClientRect().top - main.getBoundingClientRect().top)
  }, selector)
}

/** Opens the first live recipe and waits for the page to settle. */
async function openFirstRecipe(page: Page) {
  const path = await firstRecipePath(page)
  const res = await page.goto(path)
  expect(res?.status(), `${path} did not render`).toBe(200)
  await page.waitForLoadState('networkidle')
}

/** Boxes of the list-bar row, the header, and the title, read from the rendered page. */
function measureListBar() {
  const main = document.querySelector('main')
  const header = main?.querySelector('header')
  const title = header?.querySelector('h1')
  if (!main || !header || !title) return { error: 'recipe header (main > header > h1) not found' }
  // The breadcrumbs are the nav with aria-label "Okruszki", a sibling of the header (from lg).
  const crumbs = [...main.querySelectorAll('nav[aria-label="Okruszki"] a')].find((a) => a.textContent?.trim() === 'Przepisy')
  if (!crumbs) return { error: 'breadcrumbs („Przepisy”) not found in <main>' }
  const row = crumbs.closest('nav')?.parentElement
  if (!row) return { error: 'list-bar row (breadcrumbs parent) not found' }

  const crumbsBox = crumbs.getBoundingClientRect()
  const rowBox = row.getBoundingClientRect()
  const headerBox = header.getBoundingClientRect()
  const titleBox = title.getBoundingClientRect()
  return {
    rowHeight: Math.round(rowBox.height),
    rowAboveHeader: rowBox.bottom <= headerBox.top,
    crumbsAboveTitle: crumbsBox.bottom <= titleBox.top,
  }
}

test.describe('desktop (lg)', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('the list bar and breadcrumbs sit in one row above the title', async ({ page }) => {
    await openFirstRecipe(page)

    const measured = await page.evaluate(measureListBar)
    expect(measured, 'error' in measured ? measured.error : undefined).not.toHaveProperty('error')
    const { rowHeight, rowAboveHeader, crumbsAboveTitle } = measured as {
      rowHeight: number
      rowAboveHeader: boolean
      crumbsAboveTitle: boolean
    }

    expect(rowHeight, `the list-bar row is ${rowHeight} px tall; it should stay one line (need ≤ ${MAX_LIST_ROW_HEIGHT})`).toBeLessThanOrEqual(MAX_LIST_ROW_HEIGHT)
    expect(rowAboveHeader, 'the list-bar row should sit above the recipe header').toBe(true)
    expect(crumbsAboveTitle, 'the breadcrumbs should sit above the title').toBe(true)
  })

  test('the photo sits flush with the top of the recipe header', async ({ page }) => {
    await openFirstRecipe(page)

    const photo = await page.evaluate(() => {
      const header = document.querySelector('main header')
      const img = header?.querySelector('img')
      if (!header || !img) return null
      return Math.round(img.getBoundingClientRect().top - header.getBoundingClientRect().top)
    })
    expect(photo, 'recipe photo (main header img) not found').not.toBeNull()
    expect(photo, `the photo starts ${photo} px below the header top; it should sit flush with it`).toBeLessThanOrEqual(1)
  })
})

test.describe('phone (390 px)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('the list bar stays hidden and the header still starts at the top', async ({ page }) => {
    await openFirstRecipe(page)

    // Below lg the desktop list bar must not leak into the header column.
    await expect(
      page.locator('main header nav[aria-label="Lista przepisów"]'),
      'the list bar should stay hidden below lg',
    ).toBeHidden()

    const offset = await offsetFromMain(page, 'header')
    expect(offset, 'recipe header (main > header) not found').not.toBeNull()
    expect(offset, `the header starts ${offset} px below <main> on a phone (need ≤ ${MAX_HEADER_OFFSET})`).toBeLessThanOrEqual(MAX_HEADER_OFFSET)
  })
})
