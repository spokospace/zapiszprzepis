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
// the logo is the shared BrandLogo / LogoIcon + LogoWordmark everywhere (#331, #334).
describe('brand logo', () => {
  // A quoted path is a use (an image src); a comment naming the file is not.
  it('no source file under src/ uses the old /logo-lettering.svg or /logo.svg', () => {
    const offenders = sourceFiles(join(process.cwd(), 'src')).filter((file) =>
      /["'`]\/logo(-lettering)?\.svg["'`]/.test(readFileSync(file, 'utf8')),
    )
    expect(offenders).toEqual([])
  })

  // Handoff v8 (#339): the name is two words everywhere the user can see it; the
  // address stays lowercase „zapiszprzepis.pl”, which this pattern does not match.
  it('no source file under src/ spells the name as one word „ZapiszPrzepis”', () => {
    const offenders = sourceFiles(join(process.cwd(), 'src')).filter((file) =>
      readFileSync(file, 'utf8').includes('Zapisz' + 'Przepis'),
    )
    expect(offenders).toEqual([])
  })
})
