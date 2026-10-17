import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Static guard for #233: text renders in system fonts (Arial body, the default
 * `monospace` stack for `font-mono`), so no page should preload a web font. A
 * next/font call anywhere under src/ makes Next hint its .woff2 files on every
 * route that loads it. If the design adopts a typeface, load only that one and
 * update this guard.
 */
const SRC = join(process.cwd(), 'src')
const read = (f: string) => readFileSync(join(SRC, f), 'utf8')
const sources = (readdirSync(SRC, { recursive: true }) as string[]).filter(
  (f) => /\.(ts|tsx)$/.test(f) && !f.endsWith('.test.ts'),
)

describe('web fonts', () => {
  it('no source file loads a font through next/font', () => {
    expect(sources.filter((f) => /from\s+['"]next\/font\//.test(read(f)))).toEqual([])
  })

  it('the theme maps no font token to a next/font variable', () => {
    // A leftover mapping would point `font-mono` at an undefined variable and the
    // access-code field would fall back to the body's Arial.
    expect(read('app/globals.css').match(/^.*--font-(sans|mono)\s*:.*$/gm)).toBeNull()
  })
})
