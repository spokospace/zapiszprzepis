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

/**
 * Text that strands a single character (#478): a word split across lines with a
 * one-letter piece ("Wszystkic|h"; a hyphenated "Wszyst-|kich" leaves a syllable on
 * both sides), or a lone "→" on its own line. Checked per text node on the short labels
 * that use `wrap-label` and on links ending in an arrow. Returns null when there are none.
 */
export async function strandedChars(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const found: string[] = []
    const targets = [...document.querySelectorAll<HTMLElement>('.wrap-label, a')].filter(
      (el) => el.classList.contains('wrap-label') || /→\s*$/.test(el.textContent ?? ''),
    )
    for (const el of targets) {
      if (el.getClientRects().length === 0) continue
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
        const range = document.createRange()
        const lines: string[] = []
        const words: number[][] = [] // per word, the length of each piece a line break leaves
        let top = NaN
        let inWord = false
        for (let i = 0; i < node.data.length; i++) {
          const ch = node.data[i]
          if (/\s/.test(ch)) {
            inWord = false
            continue
          }
          range.setStart(node, i)
          range.setEnd(node, i + 1)
          const rect = range.getClientRects()[0]
          if (!rect) continue
          const newLine = isNaN(top) || Math.abs(rect.top - top) > rect.height / 2
          if (newLine) {
            top = rect.top
            lines.push('')
          }
          lines[lines.length - 1] += ch
          if (!inWord) words.push([1])
          else if (newLine) words[words.length - 1].push(1)
          else words[words.length - 1][words[words.length - 1].length - 1]++
          inWord = true
        }
        const cutWord = words.some((w) => w.length > 1 && w.includes(1))
        const loneArrow = lines.length > 1 && lines[lines.length - 1] === '→'
        if (cutWord || loneArrow) found.push(`<${el.tagName.toLowerCase()}> ${lines.join(' ⏎ ')}`)
      }
    }
    return found.length ? found.slice(0, 5).join(' | ') : null
  })
}

/** The phone profile: touch, a mobile layout viewport, Pixel-class density. */
export const phone = (width: number, height = 800) => ({
  viewport: { width, height },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2.625,
})
