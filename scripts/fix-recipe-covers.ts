import { createClient } from '@supabase/supabase-js'
import { archiveImage } from '../src/lib/recipe-image-archive'

/**
 * Re-archives the cover of specific recipes from a known-good source image and
 * repoints image_url at it. For recipes whose cover was picked wrong at
 * extraction time (a Facebook group post's representative image stored instead
 * of the dish) when the right photo lives somewhere the pipeline could not
 * reach automatically (a blog's schema.org image, a group photo in an album
 * `set=a.` the set=gm reader misses).
 *
 * Usage (one or more pairs):
 *   node --env-file=.env.local --import tsx scripts/fix-recipe-covers.ts <recipeId>=<imageUrl> ...
 *
 * The file is overwritten in place (<user>/<recipe>.<ext>); a `?v=<ts>` cache
 * buster on the stored URL forces Cloudflare and browsers off the old image.
 */
async function main(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('✗ Brak NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w .env.local')
    process.exit(1)
  }

  const pairs = process.argv
    .slice(2)
    .filter((a) => /^\d+=/.test(a))
    .map((a) => {
      const eq = a.indexOf('=')
      return { id: Number(a.slice(0, eq)), url: a.slice(eq + 1) }
    })
  if (pairs.length === 0) {
    console.error('✗ Give at least one <recipeId>=<imageUrl> pair.')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

  for (const { id, url } of pairs) {
    const { data: recipe, error } = await supabase.from('recipes').select('id, slug, user_id, image_url').eq('id', id).single()
    if (error || !recipe) {
      console.error(`✗ #${id}: recipe not found: ${error?.message ?? 'missing'}`)
      continue
    }

    const archived = await archiveImage(supabase, recipe.user_id, id, url)
    if (!archived) {
      console.error(`✗ #${id} (${recipe.slug}): could not archive ${url}`)
      continue
    }

    const busted = `${archived}?v=${Date.now().toString(36)}`
    const { error: updateError } = await supabase.from('recipes').update({ image_url: busted }).eq('id', id)
    if (updateError) {
      console.error(`✗ #${id} (${recipe.slug}): image_url update failed: ${updateError.message}`)
      continue
    }
    console.log(`✓ #${id} (${recipe.slug}): cover ← ${url.slice(0, 70)}…\n      ${busted}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
