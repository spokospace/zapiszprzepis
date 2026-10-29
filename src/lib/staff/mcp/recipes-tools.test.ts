import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('@/lib/recipe-cache', () => ({ revalidateRecipeCaches: vi.fn() }))

import { revalidateRecipeCaches } from '@/lib/recipe-cache'
import { finishRecipeMerge, finishRecipeSlug } from '../recipe-finish'
import { buildTools, parseArgs, toolsFor, type McpTool } from './tools'

const tools = buildTools()
const recipeTools = tools.filter((t) => t.resource === 'recipes')
const tool = (name: string): McpTool => {
  const found = tools.find((t) => t.name === name)
  if (!found) throw new Error(`no tool ${name}`)
  return found
}

describe('recipe MCP tools — what is exposed', () => {
  it('has the reads and every operation, named <resource>_<operation>', () => {
    expect(recipeTools.map((t) => t.name).sort()).toEqual(
      [
        'recipes_delete',
        'recipes_get',
        'recipes_hide',
        'recipes_list',
        'recipes_merge',
        'recipes_restore',
        'recipes_set_taxonomy',
        'recipes_unhide',
        'recipes_unmerge',
      ].sort(),
    )
  })

  it('asks for the permission of the panel button, and marks the same ones destructive', () => {
    expect(tool('recipes_list').permission).toBe('recipes.read')
    expect(tool('recipes_hide').permission).toBe('recipes.hide')
    expect(tool('recipes_restore').permission).toBe('recipes.restore')
    expect(tool('recipes_set_taxonomy').permission).toBe('recipes.taxonomy')
    expect(recipeTools.filter((t) => t.destructive).map((t) => t.name).sort()).toEqual(['recipes_delete', 'recipes_merge', 'recipes_unmerge'])
  })

  it('shows a moderator everything but restore (that one is admin only)', () => {
    const moderator = new Set(['recipes.read', 'recipes.hide', 'recipes.delete', 'recipes.merge', 'recipes.taxonomy'])
    const names = toolsFor(tools, moderator).filter((t) => t.resource === 'recipes').map((t) => t.name)
    expect(names).toContain('recipes_delete')
    expect(names).not.toContain('recipes_restore')
  })

  it('every tool calls an admin_*_as function the Phase 2 migrations define', () => {
    const dir = join(process.cwd(), 'supabase', 'migrations')
    const sql = readdirSync(dir)
      .filter((f) => f.startsWith('20261029'))
      .map((f) => readFileSync(join(dir, f), 'utf8'))
      .join('\n')
    for (const t of recipeTools) {
      expect(t.spec.rpc, t.name).toMatch(/^admin_[a-z_]+_as$/)
      expect(sql, t.name).toContain(`function public.${t.spec.rpc}(`)
    }
  })

  it('describes the list arguments as JSON Schema arrays with the item bounds under items', () => {
    const schema = tool('recipes_merge').inputSchema as { properties: Record<string, Record<string, unknown>>; required: string[] }
    expect(schema.required).toEqual(['canonical_id', 'duplicate_ids'])
    expect(schema.properties.duplicate_ids).toMatchObject({
      type: 'array',
      minItems: 1,
      maxItems: 20,
      uniqueItems: true,
      items: { type: 'integer', minimum: 1 },
    })
    const tags = (tool('recipes_set_taxonomy').inputSchema as { properties: Record<string, { items: { enum: string[] } }> }).properties.tags
    expect(tags.items.enum).toContain('grill')
  })
})

describe('recipe MCP tools — argument checks', () => {
  it('turns the merge arguments into the SQL parameters', () => {
    const parsed = parseArgs(tool('recipes_merge'), { canonical_id: 5, duplicate_ids: [6, 7], confirm: 'merge' })
    expect(parsed).toMatchObject({ ok: true, params: { p_canonical: 5, p_losers: [6, 7] }, confirm: 'merge' })
  })

  it.each([
    ['an empty list', { canonical_id: 5, duplicate_ids: [] }, 'at least 1'],
    ['more than twenty', { canonical_id: 5, duplicate_ids: Array.from({ length: 21 }, (_, i) => i + 10) }, 'at most 20'],
    ['a repeated id', { canonical_id: 5, duplicate_ids: [6, 6] }, 'not repeat'],
    ['a non-integer item', { canonical_id: 5, duplicate_ids: [6, 'x'] }, 'an integer'],
    ['an item below one', { canonical_id: 5, duplicate_ids: [0] }, 'at least 1'],
    ['a scalar for a list', { canonical_id: 5, duplicate_ids: 6 }, 'must be a list'],
  ])('refuses %s', (_label, args, fragment) => {
    const parsed = parseArgs(tool('recipes_merge'), args)
    expect(parsed.ok).toBe(false)
    expect(!parsed.ok && parsed.message).toContain(fragment)
  })

  it('keeps tags to the closed list and to six', () => {
    const t = tool('recipes_set_taxonomy')
    expect(parseArgs(t, { recipe_id: 5, tags: ['grill', 'szybkie'] })).toMatchObject({ ok: true, params: { p_recipe: 5, p_tags: ['grill', 'szybkie'] } })
    expect(parseArgs(t, { recipe_id: 5, tags: [] })).toMatchObject({ ok: true, params: { p_tags: [] } })
    expect(parseArgs(t, { recipe_id: 5, tags: ['coined-by-hand'] }).ok).toBe(false)
    expect(parseArgs(t, { recipe_id: 5, tags: ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(() => 'grill') }).ok).toBe(false)
  })

  it('passes the list filter only with a known value', () => {
    expect(parseArgs(tool('recipes_list'), { filter: 'hidden' }).ok).toBe(true)
    expect(parseArgs(tool('recipes_list'), { filter: 'everything' }).ok).toBe(false)
  })
})

describe('recipe MCP tools — cache invalidation after a change', () => {
  const ctx = (result: unknown) => ({ result, actorId: 'a', tokenId: 1, rpc: vi.fn() })
  beforeEach(() => vi.clearAllMocks())

  it('empties the cache of the one recipe a hide, delete or taxonomy change touched', async () => {
    expect(await finishRecipeSlug(ctx('zupa'))).toEqual({ ok: true, data: { slug: 'zupa' } })
    expect(revalidateRecipeCaches).toHaveBeenCalledWith('zupa')
  })

  it('empties every page a merge or an unmerge touched and returns the function result as it is', async () => {
    const merged = { merge_id: 'm', canonical_slug: 'sernik', loser_slugs: ['sernik-2', 'sernik-3'] }
    expect(await finishRecipeMerge(ctx(merged))).toEqual({ ok: true, data: merged })
    expect(vi.mocked(revalidateRecipeCaches).mock.calls.map((c) => c[0])).toEqual(['sernik', 'sernik-2', 'sernik-3'])

    vi.clearAllMocks()
    await finishRecipeMerge(ctx({ canonical_id: 5, restored_slugs: ['sernik-2'] }))
    expect(vi.mocked(revalidateRecipeCaches).mock.calls.map((c) => c[0])).toEqual(['sernik-2'])
  })

  it('does not fail the call when there is nothing to empty', async () => {
    expect(await finishRecipeSlug(ctx(null))).toEqual({ ok: true, data: { slug: null } })
    expect(revalidateRecipeCaches).not.toHaveBeenCalled()
  })
})
