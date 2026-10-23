import { expect, test, type Page } from '@playwright/test'
import { phone, scaleFonts, sidewaysScroll } from './phone'

/**
 * Header MENU drawer on a phone (#448): opening and closing it must never leave the
 * page sideways-scrollable, also with a larger Android system font (`scaleFonts`).
 * Guest only and read-only (local dev runs against the production DB).
 *
 * Run: pnpm test:reflow (starts `next dev` unless one is already on E2E_PORT).
 */

const menuButton = (page: Page) => page.locator('button[aria-controls="app-menu"]')
const drawer = (page: Page) => page.locator('dialog#app-menu')

async function open(page: Page, path = '/') {
  // An error page never scrolls sideways either: the screen itself must render.
  expect((await page.goto(path))?.status(), `${path} did not render`).toBe(200)
  await page.waitForLoadState('networkidle')
}

/**
 * Opens the drawer with the MENU button and samples every frame of the slide-in:
 * the <dialog> box must stay inside the device width on all of them (#448), and the
 * panel inside it must actually move (the animation still runs).
 */
async function openAndSampleFrames(page: Page) {
  return page.evaluate(async (vw) => {
    const dialog = document.querySelector<HTMLDialogElement>('dialog#app-menu')!
    document.querySelector<HTMLButtonElement>('button[aria-controls="app-menu"]')!.click()
    let maxRight = 0
    let minLeft = Infinity
    let maxPanelShift = 0
    const start = performance.now()
    while (performance.now() - start < 500) {
      const box = dialog.getBoundingClientRect()
      maxRight = Math.max(maxRight, box.right)
      minLeft = Math.min(minLeft, box.left)
      const panel = dialog.firstElementChild!.getBoundingClientRect()
      maxPanelShift = Math.max(maxPanelShift, panel.right - box.right)
      await new Promise(requestAnimationFrame)
    }
    return { vw, maxRight, minLeft, maxPanelShift }
  }, page.viewportSize()!.width)
}

test.describe('phone, 412 px (Pixel 9)', () => {
  test.use(phone(412, 915))

  for (const factor of [1, 1.3, 2]) {
    test(`opening and closing never scrolls the page sideways, system font ×${factor}`, async ({ page }) => {
      await open(page)
      await scaleFonts(page, factor)
      expect(await sidewaysScroll(page), 'sideways before opening').toBeNull()

      const frames = await openAndSampleFrames(page)
      expect(frames.maxRight, 'drawer box past the right edge mid-animation').toBeLessThanOrEqual(frames.vw + 0.5)
      expect(frames.minLeft).toBeGreaterThanOrEqual(-0.5)
      expect(frames.maxPanelShift, 'the panel no longer slides in').toBeGreaterThan(0)

      await expect(drawer(page)).toHaveJSProperty('open', true)
      expect(await sidewaysScroll(page), 'sideways while open').toBeNull()
      // The drawer's own lists wrap instead of scrolling sideways.
      const navOverflow = await page
        .locator('dialog#app-menu nav')
        .evaluate((nav) => nav.scrollWidth - nav.clientWidth)
      expect(navOverflow).toBeLessThanOrEqual(0)

      await page.getByRole('button', { name: 'Zamknij' }).click()
      await expect(drawer(page)).toHaveJSProperty('open', false)
      expect(await sidewaysScroll(page), 'sideways after closing').toBeNull()
    })
  }

  test('locks the page scroll while open and restores it on close', async ({ page }) => {
    await open(page)
    const overflow = () => page.evaluate(() => getComputedStyle(document.documentElement).overflow)
    const before = await overflow()
    await menuButton(page).click()
    await expect(drawer(page)).toHaveJSProperty('open', true)
    expect(await overflow()).toBe('hidden')
    await page.getByRole('button', { name: 'Zamknij' }).click()
    await expect(drawer(page)).toHaveJSProperty('open', false)
    expect(await overflow()).toBe(before)
  })

  test('Zamknij closes and returns focus to MENU', async ({ page }) => {
    await open(page)
    await menuButton(page).click()
    await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible()
    await page.getByRole('button', { name: 'Zamknij' }).click()
    await expect(drawer(page)).toBeHidden()
    await expect(menuButton(page)).toBeFocused()
  })

  test('Escape closes and returns focus to MENU', async ({ page }) => {
    await open(page)
    await menuButton(page).click()
    await expect(drawer(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(drawer(page)).toBeHidden()
    await expect(menuButton(page)).toBeFocused()
  })

  test('a category link navigates and closes the drawer', async ({ page }) => {
    await open(page)
    await scaleFonts(page, 1.3)
    await menuButton(page).click()
    // Wait for the panel to finish sliding in (x = 0) before clicking a link deep inside
    // it, so under parallel load a click can't land mid-animation on the backdrop (and
    // just close the drawer). The category page is DB-backed, so allow the nav extra time.
    await expect.poll(async () => (await page.locator('dialog#app-menu > div').boundingBox())?.x).toBe(0)
    await page.locator('dialog#app-menu a[href="/przepisy/ciasta"]').click()
    await expect(page).toHaveURL(/\/przepisy\/ciasta$/, { timeout: 15000 })
    await expect(drawer(page)).toHaveJSProperty('open', false)
    expect(await sidewaysScroll(page), 'sideways after navigating').toBeNull()
  })

  test('the drawer fills the screen on a phone', async ({ page }) => {
    await open(page)
    await menuButton(page).click()
    const panel = page.locator('dialog#app-menu > div')
    await expect.poll(async () => (await panel.boundingBox())?.x).toBe(0)
    expect((await panel.boundingBox())?.width).toBe(412)
  })
})

test.describe('tablet, 768 px', () => {
  test.use({ viewport: { width: 768, height: 1024 } })

  test('a 460 px panel on the right; a click beside it closes, a click inside does not', async ({ page }) => {
    await open(page)
    await menuButton(page).click()
    const panel = page.locator('dialog#app-menu > div')
    await expect.poll(async () => (await panel.boundingBox())?.x).toBe(768 - 460)
    expect((await panel.boundingBox())?.width).toBe(460)

    await page.getByRole('heading', { name: 'Menu', level: 2 }).click()
    await expect(drawer(page)).toHaveJSProperty('open', true)

    await page.mouse.click(100, 500)
    await expect(drawer(page)).toHaveJSProperty('open', false)
  })
})

test.describe('reduced motion', () => {
  test.use({ viewport: { width: 412, height: 915 }, reducedMotion: 'reduce' })

  test('opens in place, without the slide', async ({ page }) => {
    await open(page)
    const frames = await openAndSampleFrames(page)
    expect(frames.maxPanelShift).toBe(0)
    expect(frames.maxRight).toBeLessThanOrEqual(frames.vw + 0.5)
  })
})
