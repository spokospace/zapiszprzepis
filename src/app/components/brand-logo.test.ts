import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Every .ts/.tsx source file under `dir`, tests excluded (they name the file to forbid it). */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : []
  })
}

// #286 and #324 each brought the old lettering image back from stale docs (#320);
// the logo is the shared LogoIcon + LogoWordmark everywhere (#331).
describe('brand logo', () => {
  it('no source file under src/ uses the old /logo-lettering.svg', () => {
    const offenders = sourceFiles(join(process.cwd(), 'src')).filter((file) =>
      readFileSync(file, 'utf8').includes('/logo-lettering'),
    )
    expect(offenders).toEqual([])
  })
})
