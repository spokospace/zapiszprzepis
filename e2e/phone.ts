import type { Page } from '@playwright/test'

/**
 * Shared checks for the phone layout suites (#448): Android's system font size and
 * a page that must never scroll sideways.
 */

/**
 * Android's system font size enlarges every font, fixed px included, at an unchanged
 * viewport width; Chromium can't emulate that setting, so this multiplies each
 * element's computed font size instead (the hidden drawer's content included).
 */
export async function scaleFonts(page: Page, factor: number) {
  if (factor === 1) return
  await page.evaluate((f) => {
    const els = [...document.querySelectorAll<HTMLElement>('body, body *')]
    const sizes = els.map((el) => parseFloat(getComputedStyle(el).fontSize))
    els.forEach((el, i) => el.style.setProperty('font-size', `${sizes[i] * f}px`))
  }, factor)
}

/**
 * How the page scrolls sideways, or null when it does not: its width, the layout
 * viewport and a real scroll attempt, with the innermost elements sticking out.
 * Measured against the device width, not `innerWidth`: on a phone Chrome widens the
 * layout viewport to fit content that sticks out (1648 px on a 412 px screen,
 * #448), so `innerWidth` grows along with the overflow.
 */
export async function sidewaysScroll(page: Page): Promise<string | null> {
  const device = page.viewportSize()!.width
  return page.evaluate((W) => {
    const root = document.documentElement
    window.scrollTo(9999, window.scrollY)
    const scrollX = window.scrollX
    window.scrollTo(0, window.scrollY)
    if (root.scrollWidth <= W && window.innerWidth <= W && scrollX === 0) return null
    const past = (el: Element) => el.getClientRects().length > 0 && el.getBoundingClientRect().right > W + 0.5
    const culprits = [...document.querySelectorAll('body *')]
      .filter((el) => past(el) && ![...el.children].some(past))
      .slice(0, 4)
      .map((el) => `<${el.tagName.toLowerCase()} class="${String(el.className).slice(0, 60)}">${(el.textContent ?? '').trim().slice(0, 30)}`)
    return `scrollWidth ${root.scrollWidth}, innerWidth ${window.innerWidth}, scrollX ${scrollX} on a ${W} px screen; sticking out: ${culprits.join(' | ')}`
  }, device)
}

/** The phone profile: touch, a mobile layout viewport, Pixel-class density. */
export const phone = (width: number, height = 800) => ({
  viewport: { width, height },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2.625,
})
