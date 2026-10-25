import { type NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { checkUser } from '@/lib/supabase/user-check'
import { extractStoragePath, removeGallery } from '@/lib/recipe-image-archive'
import { isRecipeSharedError, RECIPE_SHARED_MESSAGE } from '@/lib/recipe-delete'
import { recipePath } from '@/lib/routes'
import { revalidateRecipeCaches } from '@/lib/recipe-cache'

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createSupabaseServerClient()

    const { user, transient } = await checkUser(supabase, 'deleteRecipe')

    // The session could not be checked: retryable, and not a reason to sign out.
    if (!user && transient) {
      return NextResponse.json({ error: 'Session check unavailable' }, { status: 503 })
    }
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    let slug: string | null = null
    try {
      const formData = await request.formData()
      slug = formData.get('slug') as string | null
    } catch {
      slug = request.nextUrl.searchParams.get('slug')
    }

    if (!slug) {
      return NextResponse.json({ error: 'Missing slug parameter' }, { status: 400 })
    }

    // Scope to the owner explicitly (defense in depth on top of owner-only RLS): if
    // recipes were readable across users, a bare slug lookup could resolve ANOTHER
    // user's recipe, whose RLS-protected DELETE matches 0 rows without an error and
    // fakes a successful delete.
    const { data: recipe, error: getError } = await supabase
      .from('recipes')
      .select('id, user_id, image_url')
      .eq('slug', slug)
      .eq('user_id', user.id)
      .single()

    if (getError || !recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })
    }

    // The row goes first: the database refuses it while others have the recipe
    // as a favorite (recipes_block_shared_delete), and a refused delete must
    // leave the images in place.
    const { error: deleteError } = await supabase.from('recipes').delete().eq('id', recipe.id)

    if (isRecipeSharedError(deleteError)) {
      // The recipe page's plain form gets the message inline; other clients the 409.
      if (request.headers.get('accept')?.includes('text/html')) {
        return NextResponse.redirect(new URL(`${recipePath(slug)}?delete_error=shared`, request.url), { status: 303 })
      }
      return NextResponse.json({ error: 'recipe_shared', message: RECIPE_SHARED_MESSAGE }, { status: 409 })
    }
    if (deleteError) {
      console.error('[delete] Database error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete recipe' }, { status: 500 })
    }

    if (recipe.image_url) {
      const storagePath = extractStoragePath(recipe.image_url)
      if (storagePath) {
        const { error: storageError } = await supabase.storage
          .from('recipe-images')
          .remove([storagePath])
        if (storageError) {
          console.warn('[delete] Storage cleanup failed:', storageError.message)
        }
      }
    }

    await removeGallery(supabase, recipe.user_id, recipe.id)

    // Drop the cached public list + this recipe's cached page at once (#445), so the
    // delete shows immediately rather than lingering up to the TTL.
    revalidateRecipeCaches(slug)

    return NextResponse.redirect(new URL('/recipes', request.url), { status: 303 })
  } catch (error) {
    console.error('[delete] Unhandled error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
