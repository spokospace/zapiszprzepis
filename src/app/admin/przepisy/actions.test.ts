import { describe, it, expect, vi, beforeEach } from 'vitest'

// redirect() and notFound() end the action by throwing, as Next's do.
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`)
  }),
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND')
  }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/recipe-cache', () => ({ revalidateRecipeCaches: vi.fn() }))
vi.mock('@/lib/staff/context', () => ({ requirePermission: vi.fn() }))

import { revalidateRecipeCaches } from '@/lib/recipe-cache'
import { requirePermission } from '@/lib/staff/context'
import { deleteRecipe, hideRecipe, mergeRecipes, restoreRecipe, setTaxonomy, unhideRecipe, unmergeRecipes } from './actions'

function form(fields: Record<string, string | string[]>) {
  const data = new FormData()
  for (const [k, v] of Object.entries(fields)) for (const one of Array.isArray(v) ? v : [v]) data.append(k, one)
  return data
}

/** A staff session whose rpc answers with `data` (or `error`). */
function staffWith(data: unknown = 'zupa', error: { message: string } | null = null) {
  const supabase = { rpc: vi.fn(async () => ({ data, error })) }
  vi.mocked(requirePermission).mockResolvedValue({ supabase, user: { id: 'staff-1' }, permissions: new Set() } as never)
  return supabase
}

async function redirectOf(run: Promise<unknown>) {
  try {
    await run
  } catch (e) {
    return (e as Error).message
  }
  return null
}

describe('recipe moderation — the permission gate', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each([
    ['hideRecipe', hideRecipe, 'recipes.hide'],
    ['unhideRecipe', unhideRecipe, 'recipes.hide'],
    ['deleteRecipe', deleteRecipe, 'recipes.delete'],
    ['restoreRecipe', restoreRecipe, 'recipes.restore'],
    ['mergeRecipes', mergeRecipes, 'recipes.merge'],
    ['unmergeRecipes', unmergeRecipes, 'recipes.merge'],
    ['setTaxonomy', setTaxonomy, 'recipes.taxonomy'],
  ] as const)('%s answers 404 without %s and never reaches the database', async (_name, action, permission) => {
    vi.mocked(requirePermission).mockImplementation(async () => {
      throw new Error('NOT_FOUND')
    })
    await expect(action(form({ id: '5', confirm: 'USUŃ' }))).rejects.toThrow('NOT_FOUND')
    expect(requirePermission).toHaveBeenCalledWith(permission)
  })
})

describe('hide / unhide', () => {
  beforeEach(() => vi.clearAllMocks())

  it('hides through the wrapper, empties the caches of that slug and says so', async () => {
    const supabase = staffWith('zupa')
    const to = await redirectOf(hideRecipe(form({ id: '5', reason: ' spam ' })))
    expect(supabase.rpc).toHaveBeenCalledWith('admin_hide_recipe', { p_recipe: 5, p_reason: 'spam' })
    expect(revalidateRecipeCaches).toHaveBeenCalledWith('zupa')
    expect(to).toBe('REDIRECT /admin/przepisy/5?ok=hidden')
  })

  it('sends no reason when the field is empty', async () => {
    const supabase = staffWith('zupa')
    await redirectOf(hideRecipe(form({ id: '5' })))
    expect(supabase.rpc).toHaveBeenCalledWith('admin_hide_recipe', { p_recipe: 5, p_reason: null })
  })

  it('shows the Polish error code and leaves the caches alone when the database refuses', async () => {
    staffWith(null, { message: 'forbidden' })
    expect(await redirectOf(hideRecipe(form({ id: '5' })))).toBe('REDIRECT /admin/przepisy/5?error=forbidden')
    expect(revalidateRecipeCaches).not.toHaveBeenCalled()
  })

  it('refuses an id that is not a number before any call', async () => {
    const supabase = staffWith()
    expect(await redirectOf(hideRecipe(form({ id: 'abc' })))).toBe('REDIRECT /admin/przepisy?error=invalid_input')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('unhides and empties the caches', async () => {
    const supabase = staffWith('zupa')
    expect(await redirectOf(unhideRecipe(form({ id: '5' })))).toBe('REDIRECT /admin/przepisy/5?ok=unhidden')
    expect(supabase.rpc).toHaveBeenCalledWith('admin_unhide_recipe', { p_recipe: 5 })
    expect(revalidateRecipeCaches).toHaveBeenCalledWith('zupa')
  })
})

describe('deleteRecipe', () => {
  beforeEach(() => vi.clearAllMocks())

  it('needs the typed phrase and calls nothing without it', async () => {
    const supabase = staffWith()
    expect(await redirectOf(deleteRecipe(form({ id: '5', confirm: 'tak' })))).toBe('REDIRECT /admin/przepisy/5?error=confirm_mismatch')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('accepts the phrase in any case, deletes without a redirect and returns to the list', async () => {
    const supabase = staffWith('zupa')
    expect(await redirectOf(deleteRecipe(form({ id: '5', confirm: ' usuń ' })))).toBe('REDIRECT /admin/przepisy?ok=deleted')
    expect(supabase.rpc).toHaveBeenCalledWith('admin_delete_recipe', { p_recipe: 5, p_redirect_to_slug: null })
    expect(revalidateRecipeCaches).toHaveBeenCalledWith('zupa')
  })

  it('normalises a pasted address into a slug and empties the target page cache too', async () => {
    const supabase = staffWith('zupa')
    await redirectOf(deleteRecipe(form({ id: '5', confirm: 'USUŃ', redirect: 'https://zapiszprzepis.pl/przepis/rosol' })))
    expect(supabase.rpc).toHaveBeenCalledWith('admin_delete_recipe', { p_recipe: 5, p_redirect_to_slug: 'rosol' })
    expect(revalidateRecipeCaches).toHaveBeenCalledWith('rosol')
  })

  it('refuses a redirect that is not a slug, before any call', async () => {
    const supabase = staffWith()
    expect(await redirectOf(deleteRecipe(form({ id: '5', confirm: 'USUŃ', redirect: 'Nie Slug!' })))).toBe(
      'REDIRECT /admin/przepisy/5?error=invalid_redirect',
    )
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('shows the database refusing a redirect to a hidden recipe', async () => {
    staffWith(null, { message: 'invalid_redirect' })
    expect(await redirectOf(deleteRecipe(form({ id: '5', confirm: 'USUŃ', redirect: 'rosol' })))).toBe(
      'REDIRECT /admin/przepisy/5?error=invalid_redirect',
    )
  })
})

describe('restoreRecipe', () => {
  beforeEach(() => vi.clearAllMocks())

  it('restores and lands on the recipe', async () => {
    const supabase = staffWith('zupa')
    expect(await redirectOf(restoreRecipe(form({ id: '5' })))).toBe('REDIRECT /admin/przepisy/5?ok=restored')
    expect(supabase.rpc).toHaveBeenCalledWith('admin_restore_recipe', { p_recipe: 5 })
  })

  it('names a taken slug on the list', async () => {
    staffWith(null, { message: 'slug_taken' })
    expect(await redirectOf(restoreRecipe(form({ id: '5' })))).toBe('REDIRECT /admin/przepisy?error=slug_taken')
  })
})

describe('mergeRecipes / unmergeRecipes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('merges the listed duplicates and empties every affected cache', async () => {
    const supabase = staffWith({ canonical_slug: 'sernik', loser_slugs: ['sernik-2', 'sernik-3'] })
    expect(await redirectOf(mergeRecipes(form({ id: '5', losers: '6, 7', confirm: 'scal' })))).toBe('REDIRECT /admin/przepisy/5?ok=merged')
    expect(supabase.rpc).toHaveBeenCalledWith('admin_merge_recipes', { p_canonical: 5, p_losers: [6, 7] })
    expect(vi.mocked(revalidateRecipeCaches).mock.calls.map((c) => c[0])).toEqual(['sernik', 'sernik-2', 'sernik-3'])
  })

  it('refuses a merge into itself, a bad list or a missing phrase before any call', async () => {
    const supabase = staffWith()
    expect(await redirectOf(mergeRecipes(form({ id: '5', losers: '5', confirm: 'SCAL' })))).toBe('REDIRECT /admin/przepisy/5?error=invalid_input')
    expect(await redirectOf(mergeRecipes(form({ id: '5', losers: 'a,b', confirm: 'SCAL' })))).toBe('REDIRECT /admin/przepisy/5?error=invalid_input')
    expect(await redirectOf(mergeRecipes(form({ id: '5', losers: '6', confirm: '' })))).toBe('REDIRECT /admin/przepisy/5?error=confirm_mismatch')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('shows a hidden canonical as its own error', async () => {
    staffWith(null, { message: 'canonical_hidden' })
    expect(await redirectOf(mergeRecipes(form({ id: '5', losers: '6', confirm: 'SCAL' })))).toBe('REDIRECT /admin/przepisy/5?error=canonical_hidden')
  })

  it('unmerges by a merge id that is a UUID, and refuses anything else', async () => {
    const supabase = staffWith({ restored_slugs: ['sernik-2'] })
    const uuid = '3f2b8a52-5b0c-4d8e-9a55-0c1d2e3f4a5b'
    expect(await redirectOf(unmergeRecipes(form({ id: '5', mergeId: uuid })))).toBe('REDIRECT /admin/przepisy/5?ok=unmerged')
    expect(supabase.rpc).toHaveBeenCalledWith('admin_unmerge', { p_merge: uuid })
    expect(revalidateRecipeCaches).toHaveBeenCalledWith('sernik-2')
    expect(await redirectOf(unmergeRecipes(form({ id: '5', mergeId: 'nope' })))).toBe('REDIRECT /admin/przepisy/5?error=invalid_input')
  })
})

describe('setTaxonomy', () => {
  beforeEach(() => vi.clearAllMocks())

  it('saves a known category and known tags', async () => {
    const supabase = staffWith('zupa')
    expect(await redirectOf(setTaxonomy(form({ id: '5', category: 'zupy', tags: ['grill', 'szybkie'] })))).toBe(
      'REDIRECT /admin/przepisy/5?ok=taxonomy',
    )
    expect(supabase.rpc).toHaveBeenCalledWith('admin_set_taxonomy', { p_recipe: 5, p_category: 'zupy', p_tags: ['grill', 'szybkie'] })
    expect(revalidateRecipeCaches).toHaveBeenCalledWith('zupa')
  })

  it('refuses a tag or category outside the closed lists before any call', async () => {
    const supabase = staffWith()
    expect(await redirectOf(setTaxonomy(form({ id: '5', category: 'zupy', tags: ['coined-by-hand'] })))).toBe('REDIRECT /admin/przepisy/5?error=invalid_input')
    expect(await redirectOf(setTaxonomy(form({ id: '5', category: 'nope' })))).toBe('REDIRECT /admin/przepisy/5?error=invalid_input')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })
})
