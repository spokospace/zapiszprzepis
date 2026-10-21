import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.tsx$/.test(name) ? [path] : []
  })
}

describe('corner radii (style 1b)', () => {
  it('uses the radius tokens, not ad-hoc rounded-[Npx] values', () => {
    const offenders = sourceFiles(join(process.cwd(), 'src')).filter((file) =>
      /rounded-\[\d+px\]/.test(readFileSync(file, 'utf8')),
    )
    expect(offenders).toEqual([])
  })

  it('no longer uses the removed rounded-field / rounded-card aliases', () => {
    const offenders = sourceFiles(join(process.cwd(), 'src')).filter((file) =>
      /rounded-(field|card)\b/.test(readFileSync(file, 'utf8')),
    )
    expect(offenders).toEqual([])
  })

  it('defines the pill and tile tokens, and not the old aliases', () => {
    const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')
    expect(css).toMatch(/--radius-pill:\s*999px/)
    expect(css).toMatch(/--radius-tile:\s*4px/)
    expect(css).not.toMatch(/--radius-(field|card):/)
  })
})
