import { createClient } from '@supabase/supabase-js'
import { normalizeUrl } from '../src/lib/url-normalize'

// Re-keys recipes.source_url and recipe_shares.shared_url with the current
// normalizeUrl(), so links saved before a rule change still dedup. Dry run by
// default; pass --apply to write. A recipe whose new key is already taken by
// another recipe of the same user is a duplicate: it is reported and left
// alone (the unique index would refuse it), for a human to delete.

function safeNormalize(url: string): string {
  try {
    return normalizeUrl(url)
  } catch {
    return url
  }
}

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
    .select('id, user_id, slug, source_url, created_at')
    .not('source_url', 'is', null)
    .order('created_at', { ascending: true })
  if (error) {
    console.error(`✗ Query failed: ${error.message}`)
    process.exit(1)
  }

  // Oldest recipe keeps the key; later ones with the same key are duplicates.
  const owner = new Map<string, { id: number; slug: string }>()
  const updates: { id: number; to: string }[] = []
  for (const recipe of recipes ?? []) {
    const key = safeNormalize(recipe.source_url!)
    const ownerKey = `${recipe.user_id} ${key}`
    const first = owner.get(ownerKey)
    if (first) {
      console.log(`⚠ duplicate: /recipes/${recipe.slug} (#${recipe.id}) = /recipes/${first.slug} (#${first.id})`)
      continue
    }
    owner.set(ownerKey, { id: recipe.id, slug: recipe.slug })
    if (key !== recipe.source_url) updates.push({ id: recipe.id, to: key })
  }

  const { data: shares, error: sharesError } = await supabase.from('recipe_shares').select('id, shared_url')
  if (sharesError) {
    console.error(`✗ Query failed: ${sharesError.message}`)
    process.exit(1)
  }
  const shareUpdates = (shares ?? []).flatMap((s) => {
    const to = safeNormalize(s.shared_url)
    return to === s.shared_url ? [] : [{ id: s.id, to }]
  })

  console.log(`${updates.length} recipe(s) and ${shareUpdates.length} share(s) to re-key.`)
  for (const u of updates) console.log(`  #${u.id}: ${u.to}`)
  if (!apply) {
    console.log('Dry run — pass --apply to write.')
    return
  }

  for (const u of updates) {
    const { error: e } = await supabase.from('recipes').update({ source_url: u.to }).eq('id', u.id)
    if (e) console.error(`✗ recipe #${u.id}: ${e.message}`)
  }
  for (const s of shareUpdates) {
    const { error: e } = await supabase.from('recipe_shares').update({ shared_url: s.to }).eq('id', s.id)
    if (e) console.error(`✗ share #${s.id}: ${e.message}`)
  }
  console.log('✓ Done.')
}

main()
