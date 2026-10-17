import { test, expect, type Cookie, type Page } from '@playwright/test'

/**
 * Reflow guard (WCAG 1.4.10): no E01 screen may scroll sideways at 320 px with the
 * largest content text size (A++). Every screen is checked twice: with the live data
 * as it renders, and "stressed", with a long unbroken token appended to every text
 * in the page content (<main> and the open menu drawer), standing in for a long
 * recipe title, ingredient amount, source name, search query, display name or tag.
 * Run: docs/reflow-guard.md.
 */

const LONG = 'Konstantynopolitańczykowianeczka-Brzęczyszczykiewicz'
/** The dev QA accounts: full access, and signed in without it. */
type Account = 'full' | 'free'

interface Screen {
  name: string
  /** A path, or a function that finds one (for screens that need a real recipe or user). */
  path: string | ((page: Page) => Promise<string | null>)
  as?: Account
  /** Opens an overlay after the page has loaded. */
  open?: (page: Page) => Promise<void>
}

async function firstRecipePath(page: Page): Promise<string | null> {
  await page.goto('/szukaj?q=ciasto')
  return page.locator('main a[href^="/przepis/"]').first().getAttribute('href')
}

/** A profile linked from a recipe ("Dodała/Dodał"); only recipes added by a user with a username have one. */
async function firstProfilePath(page: Page): Promise<string | null> {
  await page.goto('/szukaj?q=a')
  const recipes = await page.locator('main a[href^="/przepis/"]').evaluateAll((links) =>
    links.slice(0, 10).map((a) => a.getAttribute('href')!),
  )
  for (const recipe of recipes) {
    await page.goto(recipe)
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
  { name: 'search, long query', path: `/szukaj?q=${encodeURIComponent(`ciasto ${LONG}`)}` },
  { name: 'recipe', path: firstRecipePath },
  {
    name: 'cooking mode',
    path: firstRecipePath,
    open: async (page) => {
      await page.getByRole('button', { name: /Tryb gotowania/ }).first().click()
      await expect(page.locator('dialog[open]')).toBeVisible()
    },
  },
  { name: 'category', path: '/przepisy/desery' },
  { name: 'profile', path: firstProfilePath },
  { name: 'add recipe', path: '/dodaj', as: 'full' },
  { name: 'add recipe (code gate)', path: '/dodaj', as: 'free' },
  { name: 'notifications', path: '/powiadomienia', as: 'full' },
  { name: 'settings', path: '/settings', as: 'full' },
  { name: 'login', path: '/login' },
  { name: 'menu (guest)', path: '/', open: openMenu },
  { name: 'menu (signed in)', path: '/', as: 'full', open: openMenu },
]

/** Appends `long` to every text of the page content that is allowed to wrap. */
function stressContent(long: string) {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const texts: Text[] = []
  while (walker.nextNode()) texts.push(walker.currentNode as Text)
  for (const text of texts) {
    const parent = text.parentElement
    if (!parent?.closest('main, dialog[open]') || parent.closest('script, style')) continue
    // Short UI labels ("A++", "12") and deliberately unbreakable ones (white-space:
    // nowrap buttons) are not content; a 10+ character text that may wrap is.
    if (text.data.trim().length < 10 || getComputedStyle(parent).whiteSpace === 'nowrap') continue
    text.data = `${text.data} ${long}`
  }
}

/** The page's and the open drawer's horizontal overflow, in px (0 = reflows). */
function horizontalOverflow() {
  const doc = document.documentElement
  // A drawer scrolls (or clips) inside itself, so the page width does not show its
  // overflow. Deliberate clipping is left out: sr-only labels and ellipsis truncation.
  const scrollers = [...document.querySelectorAll('dialog[open], dialog[open] *')].filter((el) => {
    const style = getComputedStyle(el)
    return /auto|scroll|hidden/.test(style.overflowX) && el.clientWidth > 1 && style.textOverflow !== 'ellipsis'
  })
  return {
    page: doc.scrollWidth - doc.clientWidth,
    drawer: Math.max(0, ...scrollers.map((el) => el.scrollWidth - el.clientWidth)),
  }
}

/** Resolved live-data paths (a search crawl each), shared by a screen's two runs. */
const resolved = new Map<Screen['path'], string | null>()
async function resolvePath(find: (page: Page) => Promise<string | null>, page: Page) {
  if (!resolved.has(find)) resolved.set(find, await find(page))
  return resolved.get(find)!
}

/** QA session cookies per account, so each worker signs in once per account. */
const sessions = new Map<Account, Cookie[]>()

test.use({ viewport: { width: 320, height: 720 } })

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    try {
      localStorage.setItem('zp-text-scale', 'A++')
    } catch {
      /* storage blocked: the page then renders at A, and the guard is weaker, not wrong */
    }
  })
})

for (const screen of SCREENS) {
  for (const stressed of [false, true]) {
    test(`${screen.name}${stressed ? ', long content' : ''} reflows at 320 px, A++`, async ({ page, context }) => {
      if (screen.as) {
        const cached = sessions.get(screen.as)
        if (cached) {
          await context.addCookies(cached)
        } else {
          // Dev-only QA sign-in (docs/dev-qa-login.md); 404 = not enabled in this env.
          const res = await page.request.get(`/api/dev/login?as=${screen.as}&next=/`, { maxRedirects: 0 })
          test.skip(res.status() === 404, '/api/dev/login is disabled (see docs/dev-qa-login.md)')
          expect(res.status(), `dev login as ${screen.as}`).toBe(307)
          sessions.set(screen.as, await context.cookies())
        }
      }
      const path = typeof screen.path === 'string' ? screen.path : await resolvePath(screen.path, page)
      if (!path) test.skip(true, 'no live data for this screen')
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      await screen.open?.(page)
      if (stressed) await page.evaluate(stressContent, LONG)

      expect(await page.evaluate(horizontalOverflow)).toEqual({ page: 0, drawer: 0 })
    })
  }
}
