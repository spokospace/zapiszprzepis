import { cache } from 'react'
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase.types'

type Recipe = Database['public']['Tables']['recipes']['Row']

/** A row of the guest-safe public_recipes view: no user_id, no gallery, plus the author. */
type PublicRecipe = Omit<Recipe, 'user_id' | 'image_urls' | 'source_fingerprint' | 'extracted_at' | 'updated_at'> & {
  author_name: string | null
  /** Optional until the E01-S07 view migration is applied; the page degrades without them. */
  author_username?: string | null
  gallery_count?: number | null
  /** 'f' | 'm' | null, optional until the E01-S23 migration; neutral wording without it. */
  author_gender_form?: string | null
  /** Optional until the E01-S21 view migration (#296); the versions feature stays hidden without them. */
  dish?: string | null
  dish_accusative?: string | null
  variant_note?: string | null
  /** coalesce(updated_at, created_at) for sitemap <lastmod>; optional until the Phase-1 view migration (#363). */
  last_modified?: string | null
}

/**
 * One guest-safe read of the recipe for this slug, shared by the layout,
 * generateMetadata and the page through React cache() so a single render hits
 * the DB once.
 * Everyone reads through the public_recipes view (recipes itself is owner-only
 * RLS). The slug resolves to the oldest row — the one that keeps the bare slug
 * once E01-S03b's global-unique slug migration lands; until then two genuinely
 * different recipes may still share a title, so the oldest (created_at, then id)
 * is the deterministic, link-stable winner. `isOwner` is the signed-in visitor
 * owning that row (refresh/delete are the owner's; others only read).
 */
export const loadRecipe = cache(async (slug: string) => {
  const supabase = await createSupabaseServerClient()
  const user = await getCurrentUser()
  const [{ data: rows, error }, { data: own }] = await Promise.all([
    supabase
      .from('public_recipes')
      .select('*')
      .eq('slug', slug)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(1),
    // (user_id, slug) is unique per user, so at most one own row for this slug.
    user
      ? supabase.from('recipes').select('id').eq('slug', slug).eq('user_id', user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const recipe = ((rows ?? []) as PublicRecipe[])[0] ?? null
  return { recipe, error, isOwner: own?.id != null && recipe?.id === own.id, user }
})
