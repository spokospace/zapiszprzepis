import { expect, test, type Page } from '@playwright/test'

/**
 * WCAG 1.4.10 Reflow guard for the E01 screens: at 320 px wide with the recipe text
 * scale at A++ (1.3), worst-case user/extracted strings must wrap, never scroll the
 * page sideways. Guest-only and read-only (local dev runs against the production DB):
 * the worst-case strings are a search query typed into the URL, a seeded list
 * snapshot in sessionStorage, and text swapped into the rendered DOM.
 *
 * Run: pnpm test:reflow (starts `next dev` unless one is already on E2E_PORT).
 */

// 40 characters with no break opportunity: a run-together title, a URL-ish author.
const LONG_WORD = 'Najsmaczniejszaszarlotkababcizjablkamiii'
const LONG_AMOUNT = '1 i 1/2 szklanki (ok. 375 ml)'
const LONG_TITLE = `${LONG_WORD} ${LONG_WORD}`

test.use({ viewport: { width: 320, height: 800 } })

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('zp-text-scale', 'A++'))
})

async function expectNoHorizontalScroll(page: Page) {
  // A re-render (hydration recovery, a client fetch) replaces injected nodes and would
  // let the check pass on the original, short strings: every marked node must survive.
  const lost = await page
    .locator('[data-reflow-injected]')
    .evaluateAll((els) => els.filter((el) => el.textContent !== el.getAttribute('data-reflow-injected')).length)
  expect(lost, 'injected worst-case strings were lost to a re-render').toBe(0)

  const { scrollWidth, innerWidth, culprits } = await page.evaluate(() => {
    const vw = window.innerWidth
    // Name the innermost elements sticking out (their box, or their text past a
    // visible-overflow box), so a failure says where to look.
    const sticksOut = (el: Element) =>
      el.getBoundingClientRect().right > vw + 0.5 ||
      (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === 'visible')
    const culprits = [...document.querySelectorAll('body *')]
      .filter((el) => el.getClientRects().length > 0 && sticksOut(el))
      .filter((el) => ![...el.children].some(sticksOut))
      .slice(0, 5)
      .map((el) => `<${el.tagName.toLowerCase()} class="${el.className}">${(el.textContent ?? '').slice(0, 40)}`)
    return { scrollWidth: document.documentElement.scrollWidth, innerWidth: vw, culprits }
  })
  expect(scrollWidth, `page is wider than the viewport; overflowing: ${culprits.join(' | ')}`).toBeLessThanOrEqual(
    innerWidth,
  )
}

/**
 * Replaces the text of every match (up to `max`) with `text` and marks the node, so
 * expectNoHorizontalScroll can tell it survived; fails when nothing matches.
 */
async function inject(page: Page, selector: string, text: string, max = 3) {
  const count = await page.locator(selector).evaluateAll(
    (els, [value, limit]) => {
      els.slice(0, Number(limit)).forEach((el) => {
        el.textContent = String(value)
        el.setAttribute('data-reflow-injected', String(value))
      })
      return Math.min(els.length, Number(limit))
    },
    [text, max],
  )
  expect(count, `no element matches ${selector}`).toBeGreaterThan(0)
}

/** Navigates and waits until React has hydrated, so injected text is not overwritten. */
async function open(page: Page, path: string) {
  await page.goto(path)
  await page.waitForLoadState('networkidle')
}

async function firstRecipeSlug(page: Page): Promise<string> {
  await open(page, '/przepisy/ciasta')
  const href = await page.locator('main a[href^="/przepis/"]').first().getAttribute('href')
  expect(href).toBeTruthy()
  return new URL(href!, 'http://x').pathname.replace('/przepis/', '')
}

/** Recipe cards (grid and row variants): title, description and source lines. */
async function injectCards(page: Page) {
  await inject(page, 'main article h3 a, main article a h3', LONG_TITLE)
  await inject(page, 'main article p', `${LONG_WORD}.pl`, 6)
}

test('category list reflows at 320 px, A++', async ({ page }) => {
  await open(page, '/przepisy/ciasta')
  await injectCards(page)
  await expectNoHorizontalScroll(page)
})

test('search results reflow at 320 px, A++', async ({ page }) => {
  await open(page, '/szukaj?q=ciasto')
  await injectCards(page)
  await expectNoHorizontalScroll(page)
})

test('search with no results reflows at 320 px, A++', async ({ page }) => {
  // A real worst case: the query itself, echoed in the status line and the web-search button.
  await open(page, `/szukaj?q=${LONG_WORD}${LONG_WORD}`)
  await expect(page.locator('#no-results-heading')).toBeVisible()
  await expectNoHorizontalScroll(page)
})

test('recipe page reflows at 320 px, A++', async ({ page }) => {
  const slug = await firstRecipeSlug(page)
  // The list bar and prev/next read this tab's snapshot of the list the visitor came from.
  const snapshot = {
    label: `Wyniki: „${LONG_WORD}”`,
    href: '/szukaj?q=x',
    items: [
      { slug: 'reflow-prev', title: LONG_TITLE },
      { slug, title: 'x' },
      { slug: 'reflow-next', title: LONG_TITLE },
    ],
  }
  await page.addInitScript((value) => window.sessionStorage.setItem('zp-list:szukaj', value), JSON.stringify(snapshot))
  await open(page, `/przepis/${slug}?from=szukaj`)
  await expect(page.getByRole('navigation', { name: 'Lista przepisów' })).toContainText(LONG_WORD)

  await expect(page.getByRole('navigation', { name: 'Poprzedni i następny przepis' })).toContainText(LONG_WORD)

  const ingredient = 'section[aria-labelledby="ingredients-heading"] label'
  await inject(page, 'h1', LONG_TITLE)
  await inject(page, 'header p span:has-text("Źródło:")', `Źródło: ${LONG_WORD}.pl`)
  await inject(page, 'header p a[href^="/u/"]', LONG_WORD)
  await inject(page, `${ingredient} > span.text-scalable`, LONG_TITLE)
  await inject(page, `${ingredient} > b`, LONG_AMOUNT, 1)
  await inject(page, `${ingredient} >> nth=1 >> b`, LONG_WORD, 1)
  await inject(page, 'section[aria-labelledby="steps-heading"] li p.text-scalable', LONG_TITLE, 2)
  await expectNoHorizontalScroll(page)
})
