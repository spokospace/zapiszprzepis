import { expect, test, type Page } from '@playwright/test'

/**
 * The recipe page's loading skeleton must land on the same grid as the page it loads into
 * (#637). The skeleton (`przepis/[slug]/loading.tsx`) had been a hand-written copy of the
 * layout; the header went from `1fr | 1.6fr` to two equal columns and the skeleton kept the
 * old split, so on desktop everything jumped when the recipe arrived. The layout strings now
 * live in `recipe-split.ts` and both sides read them; this measures the result, so a
 * placeholder that is rebuilt by hand again fails here.
 *
 * It opens a recipe from its category page and holds the in-app navigation's RSC request, so
 * the skeleton stays on screen while the boxes are read. Then it releases the request and
 * reads the same boxes from the page. Columns, widths and the top offset are compared
 * tightly; heights depend on the recipe (description length, the versions box), so the
 * header height only has to be in the same range. Guest-only and read-only, like the other
 * layout specs: it reads the production DB (docs/dev-qa-login.md).
 *
 * Needs a production server: `next dev` does not prefetch the links, and the prefetch is
 * what delivers loading.tsx, so there a click shows no skeleton at all. Run:
 *   pnpm build && E2E_PORT=7733 pnpm exec next start -p 7733
 *   E2E_PORT=7733 pnpm test:skeleton   (project `skeleton`, not part of test:reflow)
 */

const WIDTHS = [1024, 1280, 1440, 1920]
/** Pixels of slack for x, width and the top offset. */
const TOL = 2
/** The header height may differ by this share: the skeleton cannot know the recipe's text. */
const HEIGHT_RATIO = 0.35

interface Boxes {
  headerTop: number
  headerHeight: number
  photo: { x: number; y: number; w: number; h: number }
  text: { x: number; w: number }
  gridTop: number
  ingredients: { x: number; w: number }
  steps: { x: number; w: number }
}

/** First live recipe reachable from a category, so the test runs against real content. */
async function firstRecipePath(page: Page): Promise<string> {
  // networkidle: the links' prefetch brings loading.tsx, which is what a click then shows.
  const res = await page.goto('/przepisy/ciasta', { waitUntil: 'networkidle' })
  expect(res?.status(), '/przepisy/ciasta did not render').toBe(200)
  const href = await page.locator('main a[href^="/przepis/"]').first().getAttribute('href')
  expect(href, 'no recipe link on /przepisy/ciasta').toBeTruthy()
  return new URL(href!, 'http://x').pathname
}

/** The recipe page's blocks, read from the laid-out DOM; the same read serves both states. */
async function readBoxes(page: Page): Promise<Boxes> {
  return page.evaluate(() => {
    const rect = (el: Element | null | undefined) => {
      if (!el) throw new Error('recipe block not found')
      const r = el.getBoundingClientRect()
      return { x: Math.round(r.x), y: Math.round(r.y + window.scrollY), w: Math.round(r.width), h: Math.round(r.height) }
    }
    const header = document.querySelector('main header')
    const grid = header?.nextElementSibling
    const [photo, text] = Array.from(header?.children ?? [])
    const [ingredients, steps] = Array.from(grid?.children ?? [])
    return {
      headerTop: rect(header).y,
      headerHeight: rect(header).h,
      photo: rect(photo),
      text: { x: rect(text).x, w: rect(text).w },
      gridTop: rect(grid).y,
      ingredients: { x: rect(ingredients).x, w: rect(ingredients).w },
      steps: { x: rect(steps).x, w: rect(steps).w },
    }
  })
}

for (const width of WIDTHS) {
  test(`recipe skeleton matches the page grid at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const path = await firstRecipePath(page)

    // Hold the navigation's RSC request so loading.tsx stays on screen.
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    await page.route(
      (url) => url.pathname === path && url.searchParams.has('_rsc'),
      async (route) => {
        // Only the click's own request is held; a prefetch is the one that carries the skeleton.
        if (!route.request().headers()['next-router-prefetch']) await gate
        await route.continue()
      },
    )

    // The card's href may carry the list context as a query, so match on the path.
    await page.locator(`main a[href^="${path}"]`).first().click()
    await expect(page.getByText('Ładowanie przepisu…')).toBeAttached()
    const skeleton = await readBoxes(page)

    release()
    await expect(page.locator('main h1')).toBeVisible({ timeout: 60_000 })
    const real = await readBoxes(page)

    // Where the columns sit and how wide they are: the grid itself.
    expect(Math.abs(skeleton.headerTop - real.headerTop), 'header top').toBeLessThanOrEqual(TOL)
    for (const key of ['photo', 'text', 'ingredients', 'steps'] as const) {
      expect(Math.abs(skeleton[key].x - real[key].x), `${key} x`).toBeLessThanOrEqual(TOL)
      expect(Math.abs(skeleton[key].w - real[key].w), `${key} width`).toBeLessThanOrEqual(TOL)
    }
    expect(Math.abs(skeleton.photo.h - real.photo.h), 'photo height').toBeLessThanOrEqual(TOL)

    // Heights follow the recipe's text, so they only have to be in the same range.
    expect(Math.abs(skeleton.headerHeight - real.headerHeight) / real.headerHeight, 'header height').toBeLessThanOrEqual(
      HEIGHT_RATIO,
    )
  })
}
