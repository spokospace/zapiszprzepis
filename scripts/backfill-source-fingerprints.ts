import { createClient } from '@supabase/supabase-js'
import { fetchFacebookPost } from '../src/lib/facebook'
import { fingerprintText } from '../src/lib/source-fingerprint'

// Gives recipes saved from a Facebook caption the source fingerprint the
// pipeline now stores (see the recipe_source_fingerprint migration), by
// re-reading each post's caption. Dry run by default; pass --apply to write.
// Two recipes of one user with the same fingerprint are the same recipe from
// two posts: the newer one is reported and left without a fingerprint (the
// unique index would refuse it), for a human to delete.
// Recipes the pipeline read from a linked blog get none, as on a new share.

async function main(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('✗ Brak NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w .env.local')
    process.exit(1)
  }
  const apply = process.argv.includes('--apply')
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: recipes, error } = await supabase
    .from('recipes')
    .select('id, user_id, slug, source_url')
    .eq('source_type', 'facebook_text')
    .not('source_url', 'is', null)
    .order('created_at', { ascending: true })
  if (error) {
    console.error(`✗ Query failed: ${error.message}`)
    process.exit(1)
  }

  const owner = new Map<string, string>()
  const updates: { id: number; fingerprint: string }[] = []
  for (const recipe of recipes ?? []) {
    const post = await fetchFacebookPost(recipe.source_url!).catch(() => null)
    const fingerprint = post?.caption && !post.recipeLink ? await fingerprintText(post.caption) : null
    if (!fingerprint) {
      console.log(`  – /recipes/${recipe.slug}: no caption`)
      continue
    }
    const key = `${recipe.user_id} ${fingerprint}`
    const first = owner.get(key)
    if (first) {
      console.log(`⚠ duplicate: /recipes/${recipe.slug} (#${recipe.id}) = /recipes/${first}`)
      continue
    }
    owner.set(key, `${recipe.slug} (#${recipe.id})`)
    updates.push({ id: recipe.id, fingerprint })
  }

  console.log(`${updates.length} of ${recipes?.length ?? 0} recipe(s) to fingerprint.`)
  if (!apply) {
    console.log('Dry run — pass --apply to write.')
    return
  }
  for (const u of updates) {
    const { error: e } = await supabase.from('recipes').update({ source_fingerprint: u.fingerprint }).eq('id', u.id)
    if (e) console.error(`✗ recipe #${u.id}: ${e.message}`)
  }
  console.log('✓ Done.')
}

main()
