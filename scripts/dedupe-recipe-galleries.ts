import { createClient } from '@supabase/supabase-js'
import { dedupeStoredGallery, extractStoragePath, removeImages } from '../src/lib/recipe-image-archive'
import { sha256Hex } from '../src/lib/sha256'

/**
 * Drops gallery photos that are byte-for-byte copies of another photo of the
 * same recipe (usually the cover stored again as the second photo). New
 * extractions already skip them; this cleans galleries archived before that.
 * Only image_urls and the duplicate files change — the cover stays.
 *
 * Dry-run by default; pass --apply to write.
 *   node --env-file=.env.local --import tsx scripts/dedupe-recipe-galleries.ts
 *   node --env-file=.env.local --import tsx scripts/dedupe-recipe-galleries.ts --apply
 *
 * NOTE: local dev points at the PRODUCTION Supabase DB — --apply writes real rows.
 */
const PAGE = 1000

async function hashOfUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url)
    return response.ok ? await sha256Hex(new Uint8Array(await response.arrayBuffer())) : null
  } catch {
    return null
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

  let changed = 0
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('recipes')
      .select('id, slug, image_urls')
      .not('image_urls', 'eq', '{}')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) {
      console.error(`✗ Query failed: ${error.message}`)
      process.exit(1)
    }
    for (const r of data ?? []) {
      const gallery = r.image_urls as string[]
      if (gallery.length < 2) continue
      const unique = await dedupeStoredGallery(gallery, hashOfUrl)
      if (unique.length === gallery.length) continue

      // One photo left is the cover, already shown on its own.
      const deduped = unique.length > 1 ? unique : []
      const dropped = gallery.filter((url) => !unique.includes(url))
      changed++
      console.log(`  #${r.id} ${r.slug}: ${gallery.length} → ${deduped.length} (drop ${dropped.length})`)
      if (!apply) continue

      const { error: updateError } = await supabase.from('recipes').update({ image_urls: deduped }).eq('id', r.id)
      if (updateError) {
        console.log(`  ✗ #${r.id}: update failed: ${updateError.message}`)
        continue
      }
      // The cover is a file of its own; only files no longer referenced are removed.
      const paths = dropped.map(extractStoragePath).filter((p): p is string => p != null)
      await removeImages(supabase, paths, 'dedupe-recipe-galleries')
    }
    if ((data?.length ?? 0) < PAGE) break
  }

  console.log(changed === 0 ? '✓ No duplicate gallery photos.' : apply ? `\n✓ Done. Fixed ${changed}.` : `\nDry run — ${changed} recipe(s). Re-run with --apply.`)
}

main().catch((err: Error) => {
  console.error(`✗ Failed: ${err.message}`)
  process.exit(1)
})
