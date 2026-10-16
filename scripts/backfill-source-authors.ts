import { createClient } from '@supabase/supabase-js'
import { fetchFacebookPost } from '../src/lib/facebook'
import { publicFacebookAuthor } from '../src/lib/facebook-authors'

// Gives recipes saved from Facebook the author the pipeline now stores (see
// the recipe_source_author migration), by re-reading each post. A private
// person's full name is cut to "Elżbieta K." exactly as on a new share, and a
// full name stored before that rule existed is shortened too. Dry run by
// default; pass --apply to write. Safe to run again. A post Facebook no longer
// shows (removed, private) is left as it is.

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
    .select('id, slug, source_url, source_author')
    .in('source_type', ['facebook_text', 'facebook_reel'])
    .not('source_url', 'is', null)
    .order('created_at', { ascending: true })
  if (error) {
    console.error(`✗ Query failed: ${error.message}`)
    process.exit(1)
  }

  const updates: { id: number; author: string }[] = []
  for (const recipe of recipes ?? []) {
    const url = recipe.source_url!
    // Re-reading the post only for recipes that have no author yet; a stored
    // one only needs the privacy rule applied.
    const raw = recipe.source_author ?? (await fetchFacebookPost(url).catch(() => null))?.author ?? null
    if (!raw) {
      console.log(`  – /recipes/${recipe.slug}: no author`)
      continue
    }
    const author = publicFacebookAuthor(raw, url)
    if (author === recipe.source_author) continue
    console.log(`  ✓ /recipes/${recipe.slug}: ${author}`)
    updates.push({ id: recipe.id, author })
  }

  console.log(`${updates.length} of ${recipes?.length ?? 0} recipe(s) to update.`)
  if (!apply) {
    console.log('Dry run — pass --apply to write.')
    return
  }
  for (const u of updates) {
    const { error: e } = await supabase.from('recipes').update({ source_author: u.author }).eq('id', u.id)
    if (e) console.error(`✗ recipe #${u.id}: ${e.message}`)
  }
  console.log('✓ Done.')
}

main()
