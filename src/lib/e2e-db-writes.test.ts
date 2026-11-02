import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { dbWritesAllowed, PRODUCTION_SUPABASE_HOST } from '../../e2e/db-writes'

// #375 (audit A8): local dev and the e2e suite share the production database, so a
// test that adds a recipe must not run unless it is explicitly pointed elsewhere.

const ROOT = new URL('../../', import.meta.url)
const E2E_DIR = fileURLToPath(new URL('e2e/', ROOT))
const OTHER_PROJECT = 'https://test-project-ref.supabase.co'

describe('dbWritesAllowed', () => {
  it('refuses when writes were not asked for', () => {
    expect(dbWritesAllowed({ NEXT_PUBLIC_SUPABASE_URL: OTHER_PROJECT })).toBe(false)
    expect(dbWritesAllowed({ E2E_DB_WRITES: 'true', NEXT_PUBLIC_SUPABASE_URL: OTHER_PROJECT })).toBe(false)
  })

  it('refuses the production project even when writes were asked for', () => {
    expect(dbWritesAllowed({ E2E_DB_WRITES: '1', NEXT_PUBLIC_SUPABASE_URL: `https://${PRODUCTION_SUPABASE_HOST}` })).toBe(false)
    expect(dbWritesAllowed({ E2E_DB_WRITES: '1', NEXT_PUBLIC_SUPABASE_URL: `https://${PRODUCTION_SUPABASE_HOST.toUpperCase()}/` })).toBe(false)
  })

  it('refuses an unknown target, since local dev defaults to production', () => {
    expect(dbWritesAllowed({ E2E_DB_WRITES: '1' })).toBe(false)
    expect(dbWritesAllowed({ E2E_DB_WRITES: '1', NEXT_PUBLIC_SUPABASE_URL: ' ' })).toBe(false)
    expect(dbWritesAllowed({ E2E_DB_WRITES: '1', NEXT_PUBLIC_SUPABASE_URL: 'not a url' })).toBe(false)
  })

  it('allows a non-production project when writes were asked for', () => {
    expect(dbWritesAllowed({ E2E_DB_WRITES: '1', NEXT_PUBLIC_SUPABASE_URL: OTHER_PROJECT })).toBe(true)
    expect(dbWritesAllowed({ E2E_DB_WRITES: '1', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321' })).toBe(true)
  })
})

// --- Static guard: every e2e test that submits a recipe must call the guard first. ---

/** Labels of the add-recipe URL fields (/recipes and /dodaj). */
const RECIPE_URL_FIELD = /(URL|Link do) przepisu/i
/** Playwright methods that type text into a field. */
const TYPING = new Set(['fill', 'pressSequentially', 'type'])

function literalText(node: ts.Node | undefined): string | undefined {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : undefined
}

/**
 * A call that would add a recipe: typing a web address into any field, typing a
 * non-literal value into an add-recipe URL field, or POSTing to the /share target.
 */
function submitsRecipe(call: ts.CallExpression, source: ts.SourceFile): boolean {
  if (!ts.isPropertyAccessExpression(call.expression)) return false
  const method = call.expression.name.text
  const arg = call.arguments[0]
  const text = literalText(arg)
  if (TYPING.has(method)) {
    if (text !== undefined) return /^https?:\/\//i.test(text.trim())
    return RECIPE_URL_FIELD.test(call.expression.expression.getText(source))
  }
  if (method === 'post') return text !== undefined && text.startsWith('/share')
  return false
}

/** The functions a node sits in, innermost first: a test callback, a hook or a helper. */
function enclosingFunctions(node: ts.Node): ts.FunctionLikeDeclaration[] {
  const functions: ts.FunctionLikeDeclaration[] = []
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isFunctionLike(current) && 'body' in current) functions.push(current as ts.FunctionLikeDeclaration)
  }
  return functions
}

/** True when the function skips the test on `!dbWritesAllowed(...)` before the write. */
function guarded(body: ts.FunctionLikeDeclaration, before: number, source: ts.SourceFile): boolean {
  let found = false
  const visit = (node: ts.Node) => {
    if (found || node.getStart(source) >= before) return
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(source) === 'test.skip' &&
      node.arguments[0]?.getText(source).replace(/\s/g, '').startsWith('!dbWritesAllowed(')
    ) {
      found = true
      return
    }
    ts.forEachChild(node, visit)
  }
  if (body.body) visit(body.body)
  return found
}

/** Line numbers of recipe submissions that are not behind the guard (comments never count). */
function unguardedSubmissions(name: string, code: string): number[] {
  const source = ts.createSourceFile(name, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const lines: number[] = []
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && submitsRecipe(node, source)) {
      const start = node.getStart(source)
      if (!enclosingFunctions(node).some((fn) => guarded(fn, start, source))) {
        lines.push(source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return lines
}

describe('e2e suite and the production database', () => {
  it('knows the production host that wrangler.jsonc deploys with', () => {
    const wrangler = readFileSync(new URL('wrangler.jsonc', ROOT), 'utf8')
    const url = wrangler.match(/"NEXT_PUBLIC_SUPABASE_URL"\s*:\s*"([^"]+)"/)?.[1]
    expect(url).toBeDefined()
    expect(new URL(url!).hostname).toBe(PRODUCTION_SUPABASE_HOST)
  })

  it('guards every e2e test that submits a recipe', () => {
    // Specs, setup files and helper modules alike: a helper that adds a recipe needs the guard too.
    const files = readdirSync(E2E_DIR).filter((name) => name.endsWith('.ts'))
    expect(files).toContain('add-recipe.spec.ts')
    const offenders = files.flatMap((name) =>
      unguardedSubmissions(name, readFileSync(E2E_DIR + name, 'utf8')).map((line) => `e2e/${name}:${line}`),
    )
    expect(offenders, 'add `test.skip(!dbWritesAllowed(process.env), DB_WRITES_SKIP_REASON)` first in each test').toEqual([])
  })

  describe('the scan itself', () => {
    const wrap = (body: string) => `test('t', async ({ page }) => {\n${body}\n})\n`
    const GUARD = 'test.skip(!dbWritesAllowed(process.env), DB_WRITES_SKIP_REASON)'

    it('accepts a guarded submission and ignores non-URL input', () => {
      expect(unguardedSubmissions('a.ts', wrap(`${GUARD}\nawait page.getByLabel('URL przepisu').fill('https://x.pl/a')`))).toEqual([])
      expect(unguardedSubmissions('a.ts', wrap(`await page.getByLabel('URL przepisu').fill('to-nie-jest-url')`))).toEqual([])
      expect(unguardedSubmissions('a.ts', wrap(`await page.locator('#email').fill(email)`))).toEqual([])
    })

    it('flags a second, unguarded test in a file that has a guarded one', () => {
      const code = wrap(`${GUARD}\nawait page.getByLabel('URL przepisu').fill('https://x.pl/a')`) +
        wrap(`await page.getByLabel('URL przepisu').fill('https://youtube.com/watch?v=1')`)
      expect(unguardedSubmissions('a.ts', code)).toEqual([6])
    })

    it('does not count a commented-out guard or a guard placed after the write', () => {
      expect(unguardedSubmissions('a.ts', wrap(`// ${GUARD}\nawait page.getByLabel('URL przepisu').fill('https://x.pl/a')`))).toEqual([3])
      expect(unguardedSubmissions('a.ts', wrap(`await page.getByLabel('URL przepisu').fill('https://x.pl/a')\n${GUARD}`))).toEqual([2])
    })

    it('flags the /dodaj field with a variable URL, any field typed a web address, and a /share POST', () => {
      expect(unguardedSubmissions('a.ts', wrap(`await page.getByLabel('Link do przepisu').fill(url)`))).toEqual([2])
      expect(unguardedSubmissions('a.ts', wrap('await page.getByRole("textbox").fill(`https://x.pl/a`)'))).toEqual([2])
      expect(unguardedSubmissions('a.ts', wrap(`await request.post('/share', { form: { url: 'x' } })`))).toEqual([2])
    })

    it('checks hooks and helper modules, and other ways of typing', () => {
      const hook = `test.beforeEach(async ({ page }) => {\n  await page.getByLabel('URL przepisu').fill('https://x.pl/a')\n})\n`
      expect(unguardedSubmissions('a.ts', hook)).toEqual([2])
      const helper = `export async function addFromLink(page: Page, url: string) {\n  await page.getByLabel('Link do przepisu').fill(url)\n}\n`
      expect(unguardedSubmissions('helper.ts', helper)).toEqual([2])
      const guardedHelper = `export async function addFromLink(page: Page, url: string) {\n  ${GUARD}\n  await page.getByLabel('Link do przepisu').fill(url)\n}\n`
      expect(unguardedSubmissions('helper.ts', guardedHelper)).toEqual([])
      expect(unguardedSubmissions('a.ts', wrap(`await page.locator('input').pressSequentially('https://x.pl/a')`))).toEqual([2])
    })
  })
})
