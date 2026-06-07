import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env'

/**
 * Delete recipe endpoint
 * POST /api/recipes/delete?slug=...
 *
 * Requires authentication (RLS enforces user_id check).
 * Deletes recipe and associated share records.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
      },
    })

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Parse form data or query params
    let slug: string | null = null

    try {
      const formData = await request.formData()
      slug = formData.get('slug') as string | null
    } catch {
      // If not form data, try URL params
      slug = request.nextUrl.searchParams.get('slug')
    }

    if (!slug) {
      return NextResponse.json({ error: 'Missing slug parameter' }, { status: 400 })
    }

    // Get recipe to verify ownership (RLS will enforce this)
    const { data: recipe, error: getError } = await supabase
      .from('recipes')
      .select('id')
      .eq('slug', slug)
      .single()

    if (getError || !recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })
    }

    // Delete recipe (cascade deletes recipe_shares via FK)
    const { error: deleteError } = await supabase.from('recipes').delete().eq('id', recipe.id)

    if (deleteError) {
      console.error('[delete] Database error:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete recipe' },
        { status: 500 }
      )
    }

    // Redirect to recipes list
    return NextResponse.redirect(new URL('/recipes', request.url), { status: 303 })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('[delete] Unhandled error:', errorMsg)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
