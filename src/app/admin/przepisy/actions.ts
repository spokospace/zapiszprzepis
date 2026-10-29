'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { revalidateRecipeCaches } from '@/lib/recipe-cache'
import { requirePermission } from '@/lib/staff/context'
import { flashPath } from '@/lib/staff/flash'
import {
  callAdminData,
  DELETE_RECIPE_CONFIRMATION,
  parseLoserIds,
  parseRecipeId,
  parseRedirectSlug,
  parseTaxonomy,
  UUID_RE,
} from '@/lib/staff/recipes'

const LIST = '/admin/przepisy'
const detail = (id: number) => `${LIST}/${id}`

/** Guests see a recipe change at most one cache TTL late; this makes it immediate (after the commit). */
function refresh(id: number | null, ...slugs: (string | null | undefined)[]): void {
  for (const slug of slugs) if (slug) revalidateRecipeCaches(slug)
  revalidatePath(LIST)
  if (id !== null) revalidatePath(detail(id))
}

function text(formData: FormData, name: string, max = 200): string {
  return String(formData.get(name) ?? '').trim().slice(0, max)
}

/** "Ukryj przepis": gone for guests and users at once; reversible with „Odkryj”. */
export async function hideRecipe(formData: FormData): Promise<void> {
  const staff = await requirePermission('recipes.hide')
  const id = parseRecipeId(formData.get('id'))
  if (id === null) redirect(flashPath(LIST, { error: 'invalid_input' }))

  const reason = text(formData, 'reason')
  const result = await callAdminData<string>(staff.supabase, 'admin_hide_recipe', { p_recipe: id, p_reason: reason || null })
  if (result.error) redirect(flashPath(detail(id), { error: result.error }))

  refresh(id, result.data)
  redirect(flashPath(detail(id), { ok: 'hidden' }))
}

export async function unhideRecipe(formData: FormData): Promise<void> {
  const staff = await requirePermission('recipes.hide')
  const id = parseRecipeId(formData.get('id'))
  if (id === null) redirect(flashPath(LIST, { error: 'invalid_input' }))

  const result = await callAdminData<string>(staff.supabase, 'admin_unhide_recipe', { p_recipe: id })
  if (result.error) redirect(flashPath(detail(id), { error: result.error }))

  refresh(id, result.data)
  redirect(flashPath(detail(id), { ok: 'unhidden' }))
}

/** "Usuń przepis": archived first (restorable), favorites go with it; the typed phrase is checked here before the call. */
export async function deleteRecipe(formData: FormData): Promise<void> {
  const staff = await requirePermission('recipes.delete')
  const id = parseRecipeId(formData.get('id'))
  if (id === null) redirect(flashPath(LIST, { error: 'invalid_input' }))

  if (text(formData, 'confirm').toLocaleUpperCase('pl-PL') !== DELETE_RECIPE_CONFIRMATION) {
    redirect(flashPath(detail(id), { error: 'confirm_mismatch' }))
  }

  // An empty field is no redirect; a filled one must be a slug (or an address of a recipe).
  const rawRedirect = text(formData, 'redirect', 300)
  const redirectTo = rawRedirect ? parseRedirectSlug(rawRedirect) : null
  if (rawRedirect && !redirectTo) redirect(flashPath(detail(id), { error: 'invalid_redirect' }))

  const result = await callAdminData<string>(staff.supabase, 'admin_delete_recipe', {
    p_recipe: id,
    p_redirect_to_slug: redirectTo,
  })
  if (result.error) redirect(flashPath(detail(id), { error: result.error }))

  refresh(id, result.data, redirectTo)
  redirect(flashPath(LIST, { ok: 'deleted' }))
}

/** „Przywróć” on the deleted list: the row, its id and slug come back; the lost favorites do not. */
export async function restoreRecipe(formData: FormData): Promise<void> {
  const staff = await requirePermission('recipes.restore')
  const id = parseRecipeId(formData.get('id'))
  if (id === null) redirect(flashPath(LIST, { error: 'invalid_input' }))

  const result = await callAdminData<string>(staff.supabase, 'admin_restore_recipe', { p_recipe: id })
  if (result.error) redirect(flashPath(LIST, { error: result.error }))

  refresh(id, result.data)
  redirect(flashPath(detail(id), { ok: 'restored' }))
}

/** "Scal duplikaty": the listed recipes are folded into this one; their links redirect here. */
export async function mergeRecipes(formData: FormData): Promise<void> {
  const staff = await requirePermission('recipes.merge')
  const id = parseRecipeId(formData.get('id'))
  if (id === null) redirect(flashPath(LIST, { error: 'invalid_input' }))

  const losers = parseLoserIds(text(formData, 'losers', 400), id)
  if (!losers) redirect(flashPath(detail(id), { error: 'invalid_input' }))
  if (text(formData, 'confirm').toLocaleUpperCase('pl-PL') !== 'SCAL') {
    redirect(flashPath(detail(id), { error: 'confirm_mismatch' }))
  }

  const result = await callAdminData<{ canonical_slug?: string; loser_slugs?: string[] }>(staff.supabase, 'admin_merge_recipes', {
    p_canonical: id,
    p_losers: losers,
  })
  if (result.error) redirect(flashPath(detail(id), { error: result.error }))

  refresh(id, result.data?.canonical_slug, ...(result.data?.loser_slugs ?? []))
  redirect(flashPath(detail(id), { ok: 'merged' }))
}

/** "Cofnij scalenie": the duplicates come back under their old ids (see the migration for the link rule). */
export async function unmergeRecipes(formData: FormData): Promise<void> {
  const staff = await requirePermission('recipes.merge')
  const id = parseRecipeId(formData.get('id'))
  if (id === null) redirect(flashPath(LIST, { error: 'invalid_input' }))
  const mergeId = text(formData, 'mergeId', 64)
  if (!UUID_RE.test(mergeId)) redirect(flashPath(detail(id), { error: 'invalid_input' }))

  const result = await callAdminData<{ restored_slugs?: string[] }>(staff.supabase, 'admin_unmerge', { p_merge: mergeId })
  if (result.error) redirect(flashPath(detail(id), { error: result.error }))

  refresh(id, ...(result.data?.restored_slugs ?? []))
  redirect(flashPath(detail(id), { ok: 'unmerged' }))
}

/** "Zmień kategorię i tagi": checked against the closed lists here, and again by the database. */
export async function setTaxonomy(formData: FormData): Promise<void> {
  const staff = await requirePermission('recipes.taxonomy')
  const id = parseRecipeId(formData.get('id'))
  if (id === null) redirect(flashPath(LIST, { error: 'invalid_input' }))

  const parsed = parseTaxonomy(
    text(formData, 'category', 40),
    formData.getAll('tags').map((t) => String(t)),
  )
  if (!parsed) redirect(flashPath(detail(id), { error: 'invalid_input' }))

  const result = await callAdminData<string>(staff.supabase, 'admin_set_taxonomy', {
    p_recipe: id,
    p_category: parsed.category,
    p_tags: parsed.tags,
  })
  if (result.error) redirect(flashPath(detail(id), { error: result.error }))

  refresh(id, result.data)
  redirect(flashPath(detail(id), { ok: 'taxonomy' }))
}
