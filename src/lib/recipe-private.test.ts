import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getRecipePrivate } from './recipe-private'

const PHOTO = 'https://x.supabase.co/a.jpg'

function client(rows: Record<string, unknown>) {
  const filters: [string, string, unknown][] = []
  const fake = {
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => {
          filters.push([table, column, value])
          return query
        },
        maybeSingle: async () => ({ data: rows[table] ?? null }),
      }
      return query
    },
  }
  return { supabase: fake as unknown as SupabaseClient, filters }
}

describe('getRecipePrivate', () => {
  it('reads the gallery, the step photos and the owner flag of this recipe', async () => {
    const { supabase, filters } = client({
      recipe_gallery_images: { image_urls: [PHOTO] },
      public_recipes: { step_images: [PHOTO, ''] },
      recipes: { id: 7 },
    })
    expect(await getRecipePrivate(supabase, 'u1', 7)).toEqual({ isOwner: true, galleryImages: [PHOTO], stepImages: [PHOTO, ''] })
    expect(filters).toContainEqual(['recipes', 'user_id', 'u1'])
  })

  it('leaves out what it cannot read, and a reader who does not own the recipe is no owner', async () => {
    expect(await getRecipePrivate(client({}).supabase, 'u1', 7)).toEqual({ isOwner: false, galleryImages: [], stepImages: [] })
  })
})
