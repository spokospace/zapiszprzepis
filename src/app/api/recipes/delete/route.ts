import { type NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { extractStoragePath } from '@/lib/recipe-image-archive'

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

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

    const { data: recipe, error: getError } = await supabase
      .from('recipes')
      .select('id, image_url')
      .eq('slug', slug)
      .single()

    if (getError || !recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })
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

    const { error: deleteError } = await supabase.from('recipes').delete().eq('id', recipe.id)

    if (deleteError) {
      console.error('[delete] Database error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete recipe' }, { status: 500 })
    }

    return NextResponse.redirect(new URL('/recipes', request.url), { status: 303 })
  } catch (error) {
    console.error('[delete] Unhandled error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
