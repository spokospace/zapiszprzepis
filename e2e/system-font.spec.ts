import { expect, test, type Cookie, type Page } from '@playwright/test'
import { existsSync, readFileSync } from 'fs'
import { phone, scaleFonts, sidewaysScroll, strandedChars } from './phone'
import { qaSessionFile, type QaAccount } from './qa-session'

/**
 * Every main screen on a phone with Android's system font at its largest, ×2 (the
 * WCAG 1.4.4 resize level): the page must never scroll sideways — as rendered, while
 * the MENU drawer is open, and after it closes (#448). At ×2 a single long word (a
 * heading, the logo, a category name) outgrows a 320–412 px screen unless its box
 * lets it wrap. Signed-in screens use the dev QA session from reflow.setup.ts and
 * skip when /api/dev/login is off. Read-only: local dev runs against the production DB.
 *
 * Run: pnpm test:reflow.
 */

const WIDTHS = [320, 360, 412]
const FONT = 2

interface Screen {
  path: string | ((page: Page) => Promise<string | null>)
  as?: QaAccount
}

/** A live recipe, and the profile of whoever added it (only some recipes link one). */
async function firstRecipe(page: Page) {
  await page.goto('/przepisy/ciasta')
  return page.locator('main a[href^="/przepis/"]').first().getAttribute('href')
}
async function profile(page: Page) {
  const recipe = await firstRecipe(page)
  if (!recipe) return null
  await page.goto(recipe)
  const link = page.locator('a[href^="/u/"]').first()
  return (await link.count()) ? link.getAttribute('href') : null
}

const SCREENS: Record<string, Screen> = {
  home: { path: '/' },
  category: { path: '/przepisy/ciasta' },
  'category, other tags': { path: '/przepisy/zupy' },
  // A selected chip adds „, wybrany” to its sr-only text (the case reported on #448).
  'category, tag selected': { path: '/przepisy/zupy?tag=warzywne' },
  search: { path: '/szukaj' },
  'search results': { path: '/szukaj?q=ciasto' },
  recipe: { path: firstRecipe },
  profile: { path: profile },
  login: { path: '/login' },
  terms: { path: '/regulamin' },
  'display preferences': { path: '/wyswietlanie' },
  // The "Szukaj w:" scope pills only render for a signed-in user (#478).
  'search results (signed in)': { path: '/szukaj?q=ciasto', as: 'full' },
  'home (signed in)': { path: '/', as: 'full' },
  'my recipes': { path: '/recipes', as: 'full' },
  favourites: { path: '/ulubione', as: 'full' },
  notifications: { path: '/powiadomienia', as: 'full' },
  settings: { path: '/settings', as: 'full' },
  'add recipe': { path: '/dodaj', as: 'full' },
  'add recipe (code gate)': { path: '/dodaj', as: 'free' },
}

for (const [name, screen] of Object.entries(SCREENS)) {
  for (const width of WIDTHS) {
    test.describe(`${width} px`, () => {
      test.use(phone(width))

      test(`${name}: no sideways scroll at system font ×${FONT}, menu open and closed`, async ({ page }) => {
        if (screen.as) {
          const file = qaSessionFile(screen.as)
          test.skip(!existsSync(file), 'no QA session: /api/dev/login is disabled (see docs/dev-qa-login.md)')
          const { cookies } = JSON.parse(readFileSync(file, 'utf8')) as { cookies: Cookie[] }
          await page.context().addCookies(cookies)
        }
        const path = typeof screen.path === 'string' ? screen.path : await screen.path(page)
        test.skip(!path, 'no live data for this screen')
        // An error page never scrolls sideways either: the screen itself must render.
        const response = await page.goto(path!)
        expect(response?.status(), `${path} did not render`).toBe(200)
        await page.waitForLoadState('networkidle')
        await scaleFonts(page, FONT)
        expect(await sidewaysScroll(page), 'as rendered').toBeNull()
        expect(await strandedChars(page), 'a lone letter or arrow on its own line (#478)').toBeNull()

        const menu = page.locator('button[aria-controls="app-menu"]')
        if (!(await menu.isVisible())) return
        await menu.click()
        await expect(page.locator('dialog#app-menu')).toHaveJSProperty('open', true)
        expect(await sidewaysScroll(page), 'menu open').toBeNull()
        await page.getByRole('button', { name: 'Zamknij' }).click()
        await expect(page.locator('dialog#app-menu')).toHaveJSProperty('open', false)
        expect(await sidewaysScroll(page), 'menu closed').toBeNull()
      })
    })
  }
}
