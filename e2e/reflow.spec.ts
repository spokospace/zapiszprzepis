import { expect, test, type Cookie, type Page } from '@playwright/test'
import { existsSync, readFileSync } from 'fs'
import { qaSessionFile, type QaAccount } from './qa-session'

/**
 * WCAG 1.4.10 Reflow guard for the E01 screens: at 320 px wide with the recipe text
 * scale at A++ (1.3), worst-case user/extracted strings must wrap, never scroll the
 * page sideways. Read-only (local dev runs against the production DB): the
 * worst-case strings are a search query typed into the URL, a seeded list snapshot
 * in sessionStorage, and text swapped into the rendered DOM. Signed-in screens use
 * the dev QA sessions saved by reflow.setup.ts and skip when /api/dev/login is off.
 *
 * Run: pnpm test:reflow (starts `next dev` unless one is already on E2E_PORT;
 * needs .env.local). Docs: context/foundation/test-plan.md §6.5a.
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

/** Recipe cards (grid and row variants): the title link and the source badge. */
async function injectCards(page: Page) {
  await inject(page, 'main article h3 a, main article a h3', LONG_TITLE)
  // The source is a badge clipped on the photo now (E01-S31 §3), not a <p> line: a long
  // run-together title must wrap, a long source name must clip inside the badge.
  await inject(page, 'main article span.truncate', `${LONG_WORD}.pl`, 6)
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
  // Two worst-case list names, both unbroken, must not widen the recipe page. The prev/next
  // nav reads this tab's snapshot of the list (E01-S07); the header's „← {lista}” (C3,
  // E01-S28) reads the recorded return point, which wins over the snapshot (handoff 13 §3)
  // and which firstRecipeSlug's own visit to /przepisy/ciasta would otherwise set to „Ciasta”.
  const snapshot = {
    label: LONG_WORD,
    href: '/przepisy/x',
    items: [
      { slug: 'reflow-prev', title: LONG_TITLE },
      { slug, title: 'x' },
      { slug: 'reflow-next', title: LONG_TITLE },
    ],
  }
  const returnPoint = { href: '/przepisy/x', label: LONG_WORD }
  await page.addInitScript(
    ([snap, point]) => {
      window.sessionStorage.setItem('zp-list:kategoria', snap)
      window.sessionStorage.setItem('returnPoint', point)
    },
    [JSON.stringify(snapshot), JSON.stringify(returnPoint)] as const,
  )
  await open(page, `/przepis/${slug}?from=kategoria`)
  await expect(page.getByRole('link', { name: `Wróć: ${LONG_WORD}` })).toBeVisible()

  await expect(page.getByRole('navigation', { name: 'Poprzedni i następny przepis' })).toContainText(LONG_WORD)

  const ingredient = 'section[aria-labelledby="ingredients-heading"] label'
  await inject(page, 'h1', LONG_TITLE)
  // The source is a badge on the photo now (E01-S31 §3); a long name must clip, not widen.
  await inject(page, 'header a[aria-label^="Otwórz oryginał"] span.truncate', `${LONG_WORD}.pl`)
  await inject(page, 'header p a[href^="/u/"]', LONG_WORD)
  await inject(page, `${ingredient} > span.text-scalable`, LONG_TITLE)
  // Descendant, not `> b`: with a household measure (#505) the amount sits in a wrapper
  // span, so a recipe whose every row has one had no direct <b> and failed the inject.
  await inject(page, `${ingredient} b`, LONG_AMOUNT, 1)
  await inject(page, `${ingredient} >> nth=1 >> b`, LONG_WORD, 1)
  await inject(page, 'section[aria-labelledby="steps-heading"] li p.text-scalable', LONG_TITLE, 2)
  await expectNoHorizontalScroll(page)
})

/*
 * Every other E01 screen, signed-in ones included, checked twice: as it renders, and
 * with a long word appended to each content text that may wrap (in <main> and an open
 * <dialog>), standing in for any user/extracted string the screen shows.
 */

interface Screen {
  name: string
  path: string | ((page: Page) => Promise<string | null>)
  /** Dev-only QA account (docs/dev-qa-login.md); read-only use. */
  as?: QaAccount
  /** Opens an overlay after load. */
  overlay?: (page: Page) => Promise<void>
}

async function recipePath(page: Page) {
  return `/przepis/${await firstRecipeSlug(page)}`
}

/** A profile linked from a recipe; only recipes added by a user with a username have one. */
async function profilePath(page: Page): Promise<string | null> {
  await open(page, '/szukaj?q=a')
  const recipes = await page
    .locator('main a[href^="/przepis/"]')
    .evaluateAll((links) => links.slice(0, 10).map((a) => a.getAttribute('href')!))
  for (const recipe of recipes) {
    await open(page, recipe)
    const link = page.locator('a[href^="/u/"]').first()
    if (await link.count()) return link.getAttribute('href')
  }
  return null
}

async function openMenu(page: Page) {
  await page.locator('button[aria-controls="app-menu"]').click()
  await expect(page.locator('dialog#app-menu[open]')).toBeVisible()
}

const SCREENS: Screen[] = [
  { name: 'home (guest)', path: '/' },
  { name: 'home (signed in)', path: '/', as: 'full' },
  {
    name: 'cooking mode',
    path: recipePath,
    overlay: async (page) => {
      await page.getByRole('button', { name: /zacznij gotować/i }).first().click()
      await expect(page.locator('dialog[open]')).toBeVisible()
    },
  },
  { name: 'profile', path: profilePath },
  { name: 'add recipe', path: '/dodaj', as: 'full' },
  { name: 'add recipe (code gate)', path: '/dodaj', as: 'free' },
  { name: 'notifications', path: '/powiadomienia', as: 'full' },
  { name: 'settings', path: '/settings', as: 'full' },
  { name: 'display preferences', path: '/wyswietlanie' },
  { name: 'login', path: '/login' },
  { name: 'menu (guest)', path: '/', overlay: openMenu },
  { name: 'menu (signed in)', path: '/', as: 'full', overlay: openMenu },
  { name: 'recipe, all text', path: recipePath },
  // The S22 list card and the heart on its photo: guest (a link to login) and
  // signed in (the live heart), on all three lists that use it.
  { name: 'category, all text', path: '/przepisy/desery' },
  { name: 'category (signed in)', path: '/przepisy/desery', as: 'full' },
  { name: 'search, all text', path: '/szukaj?q=ciasto' },
  { name: 'search (signed in)', path: '/szukaj?q=ciasto', as: 'full' },
  { name: 'profile (signed in)', path: profilePath, as: 'full' },
]

async function signIn(page: Page, as: QaAccount) {
  const file = qaSessionFile(as)
  test.skip(!existsSync(file), 'no QA session: /api/dev/login is disabled (see docs/dev-qa-login.md)')
  const { cookies } = JSON.parse(readFileSync(file, 'utf8')) as { cookies: Cookie[] }
  await page.context().addCookies(cookies)
}

/** Appends `long` to every content text (10+ chars, wrappable) in <main> and an open <dialog>. */
function stressContent(long: string) {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const texts: Text[] = []
  while (walker.nextNode()) texts.push(walker.currentNode as Text)
  const stressed = new Set<Element>()
  for (const text of texts) {
    const parent = text.parentElement
    if (!parent?.closest('main, dialog[open]') || parent.closest('script, style')) continue
    if (text.data.trim().length < 10 || getComputedStyle(parent).whiteSpace === 'nowrap') continue
    text.data = `${text.data} ${long}`
    stressed.add(parent)
  }
  // Marked like inject() once all texts are long (a parent's textContent includes its
  // children's): expectNoHorizontalScroll fails if a re-render drops them.
  stressed.forEach((el) => el.setAttribute('data-reflow-injected', el.textContent ?? ''))
  return stressed.size
}

/** Widest overflow of a scrolling/clipping box in an open drawer (the page width can't show it). */
function drawerOverflow() {
  const boxes = [...document.querySelectorAll('dialog[open], dialog[open] *')].filter((el) => {
    const style = getComputedStyle(el)
    // sr-only (1 px) and ellipsis truncation clip on purpose.
    return /auto|scroll|hidden/.test(style.overflowX) && el.clientWidth > 1 && style.textOverflow !== 'ellipsis'
  })
  return Math.max(0, ...boxes.map((el) => el.scrollWidth - el.clientWidth))
}

/** Live-data paths (a search crawl each), shared by a screen's two runs in a worker. */
const resolved = new Map<Screen, string | null>()
async function resolvePath(screen: Screen, find: (page: Page) => Promise<string | null>, page: Page) {
  if (!resolved.has(screen)) resolved.set(screen, await find(page))
  return resolved.get(screen)!
}

for (const screen of SCREENS) {
  for (const stressed of [false, true]) {
    test(`${screen.name}${stressed ? ', long content' : ''} reflows at 320 px, A++`, async ({ page }) => {
      if (screen.as) await signIn(page, screen.as)
      const path = typeof screen.path === 'string' ? screen.path : await resolvePath(screen, screen.path, page)
      if (!path) test.skip(true, 'no live data for this screen')
      await open(page, path)
      await screen.overlay?.(page)
      if (stressed) expect(await page.evaluate(stressContent, LONG_WORD), 'no content text to stress').toBeGreaterThan(0)
      await expectNoHorizontalScroll(page)
      expect(await page.evaluate(drawerOverflow), 'an open drawer scrolls sideways').toBe(0)
    })
  }
}
