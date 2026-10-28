import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { extractStoragePath, orphanedImagePaths, removeImages } from '../src/lib/recipe-image-archive'

/**
 * Removes recipe-images objects whose recipe no longer exists (#132). Until the
 * bucket got an owner delete policy, deleting a recipe left its cover and
 * gallery publicly readable in Storage; this sweeps what those deletes left.
 * Keys that do not name a recipe (`<user>/<recipe>.<ext>`,
 * `<user>/<recipe>/<file>`) are never touched.
 *
 * Dry-run by default; pass --apply to delete.
 *   node --env-file=.env.local --import tsx scripts/sweep-orphaned-images.ts
 *   node --env-file=.env.local --import tsx scripts/sweep-orphaned-images.ts --apply
 *
 * NOTE: local dev points at the PRODUCTION Supabase project — --apply deletes real files.
 */
const BUCKET = 'recipe-images'
const PAGE = 1000
const REMOVE_BATCH = 100

/** Every object key under `prefix` into `keys`, walking folders (Storage lists one level at a time). */
async function listAll(supabase: SupabaseClient, prefix = '', keys: string[] = []): Promise<string[]> {
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: PAGE, offset })
    if (error) throw new Error(`list "${prefix}" failed: ${error.message}`)
    for (const entry of data ?? []) {
      const key = prefix ? `${prefix}/${entry.name}` : entry.name
      // A folder is listed without an id.
      if (entry.id == null) await listAll(supabase, key, keys)
      else keys.push(key)
    }
    if ((data?.length ?? 0) < PAGE) return keys
  }
}

/** Ids of every recipe, and every Storage key one of them points at. */
async function liveRecipes(supabase: SupabaseClient): Promise<{ ids: Set<number>; referenced: Set<string> }> {
  const ids = new Set<number>()
  const referenced = new Set<string>()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('recipes')
      .select('id, image_url, image_urls, step_images')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`recipes query failed: ${error.message}`)
    for (const r of data ?? []) {
      ids.add(r.id as number)
      const urls: (string | null)[] = [r.image_url, ...(r.image_urls ?? []), ...(r.step_images ?? [])]
      for (const url of urls) {
        const key = url ? extractStoragePath(url) : null
        if (key) referenced.add(key)
      }
    }
    if ((data?.length ?? 0) < PAGE) return { ids, referenced }
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

  // Storage first, recipes second: a recipe created in between then counts as
  // live, so its freshly archived photos are never mistaken for orphans.
  const keys = await listAll(supabase)
  const { ids, referenced } = await liveRecipes(supabase)
  const orphans = orphanedImagePaths(keys, ids, referenced)

  if (orphans.length === 0) {
    console.log(`✓ Nothing to sweep — all ${keys.length} object(s) belong to an existing recipe.`)
    return
  }

  console.log(`${orphans.length} of ${keys.length} object(s) belong to no recipe:`)
  for (const key of orphans) console.log(`  ${key}`)
  if (!apply) {
    console.log('\nDry run — nothing deleted. Re-run with --apply to remove these.')
    return
  }

  // removeImages logs every key a batch leaves behind, error or not.
  let left = 0
  for (let i = 0; i < orphans.length; i += REMOVE_BATCH) {
    left += (await removeImages(supabase, orphans.slice(i, i + REMOVE_BATCH), 'sweep')).length
  }

  console.log(`\n✓ Done. Removed ${orphans.length - left} of ${orphans.length}.`)
  if (left > 0) process.exitCode = 1
}

main().catch((err: Error) => {
  console.error(`✗ Sweep failed: ${err.message}`)
  process.exit(1)
})
