import { expect, test, type Page } from '@playwright/test'
import { phone } from './phone'

/**
 * Vertical-rhythm guard for the assembled recipe page (#538 regression). The unit
 * tests assert each component's own class strings; nothing covered the gaps *between*
 * sibling blocks. #537 moved „Tryb gotowania” into the action row, the row lost the
 * bottom margin the button used to provide, and it sat flush against
 * „Składniki/Przygotowanie” on production — green unit tests, broken layout.
 *
 * This renders the real page and measures the gaps around the action row from the
 * laid-out DOM (not class strings): fail if the row loses meaningful separation from
 * the content block below it (the exact regression) or from the header above it.
 * Checked at desktop (lg, the 4-column row) and phone (375 px, stacked). Guest-only —
 * the bug reproduces logged out — so no sign-in. Read-only: local dev hits the
 * production DB (docs/dev-qa-login.md), so the spec only reads.
 *
 * Run: pnpm test:reflow (project `layout`). Docs: context/foundation/test-plan.md §6.5b.
 */

// Below mb-8 (2rem = 32 px) and mt-6 (1.5rem = 24 px). A floor, not the exact value:
// it must catch a collapse to ~0 (the bug) without pinning the margin to the pixel.
const MIN_GAP_BELOW = 20
const MIN_GAP_ABOVE = 16

/** First live recipe reachable from a category, so the test runs against real content. */
async function firstRecipePath(page: Page): Promise<string> {
  const res = await page.goto('/przepisy/ciasta')
  expect(res?.status(), '/przepisy/ciasta did not render').toBe(200)
  const href = await page.locator('main a[href^="/przepis/"]').first().getAttribute('href')
  expect(href, 'no recipe link on /przepisy/ciasta').toBeTruthy()
  return new URL(href!, 'http://x').pathname
}

/**
 * The gaps around the recipe-page action row, read from the rendered boxes. The row is
 * the grid holding „Udostępnij przepis”, last in the header's text column; the content
 * below is the ingredients/steps grid (`.recipe-print-grid`) and the block above is the
 * row's previous sibling (the description or the versions bar). Anchored on structure,
 * not on margin classes, and guarded so a moved row errors instead of measuring the
 * wrong block.
 */
function measureActionRowGaps() {
  const content = document.querySelector('.recipe-print-grid')
  if (!content) return { error: 'recipe content grid (.recipe-print-grid) not found' }
  const share = [...document.querySelectorAll('header button')].find((b) => /Udostępnij/.test(b.textContent ?? ''))
  const row = share?.closest('div.grid')
  if (!row) return { error: 'no action row (a grid with „Udostępnij”) in the recipe header' }

  const above = row.previousElementSibling
  const rowBox = row.getBoundingClientRect()
  return {
    below: Math.round(content.getBoundingClientRect().top - rowBox.bottom),
    above: above ? Math.round(rowBox.top - above.getBoundingClientRect().bottom) : null,
  }
}

async function expectActionRowSeparated(page: Page) {
  const gaps = await page.evaluate(measureActionRowGaps)
  expect(gaps, 'error' in gaps ? gaps.error : undefined).not.toHaveProperty('error')
  const { below, above } = gaps as { below: number; above: number | null }

  expect(below, `action row sits flush against „Składniki/Przygotowanie” (${below} px below; need ≥ ${MIN_GAP_BELOW})`).toBeGreaterThanOrEqual(MIN_GAP_BELOW)
  if (above !== null) {
    expect(above, `action row sits flush against the header (${above} px above; need ≥ ${MIN_GAP_ABOVE})`).toBeGreaterThanOrEqual(MIN_GAP_ABOVE)
  }
}

test.describe('desktop (lg)', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('recipe action row keeps its gap to the header and the content below', async ({ page }) => {
    const path = await firstRecipePath(page)
    const res = await page.goto(path)
    expect(res?.status(), `${path} did not render`).toBe(200)
    await page.waitForLoadState('networkidle')
    await expectActionRowSeparated(page)
  })
})

test.describe('phone (375 px)', () => {
  test.use(phone(375))

  test('recipe action row keeps its gap to the header and the content below', async ({ page }) => {
    const path = await firstRecipePath(page)
    const res = await page.goto(path)
    expect(res?.status(), `${path} did not render`).toBe(200)
    await page.waitForLoadState('networkidle')
    await expectActionRowSeparated(page)
  })
})
