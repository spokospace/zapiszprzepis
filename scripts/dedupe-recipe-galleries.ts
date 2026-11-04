import { createClient } from '@supabase/supabase-js'
import { dedupeStoredGallery, extractStoragePath, isArchivedImageUrl, removeImages } from '../src/lib/recipe-image-archive'
import { sha256Hex } from '../src/lib/sha256'

/**
 * Drops gallery photos that are byte-for-byte copies of another photo of the
 * same recipe (usually the cover stored again as the second photo). The cover
 * counts even when the gallery does not list it (recipe 848), as long as it
 * is archived: a copy of a hotlinked cover may outlive the original. New
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
const FETCH_TIMEOUT_MS = 15_000
const MAX_BYTES = 10 * 1024 * 1024

async function hashOfUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!response.ok) return null
    const bytes = new Uint8Array(await response.arrayBuffer())
    // An unreadable photo is kept, so an oversize one is too.
    return bytes.byteLength > MAX_BYTES ? null : await sha256Hex(bytes)
  } catch {
    return null
  }
}

/** A Postgres array literal, to match `image_urls` exactly as it was read. */
function pgArrayLiteral(values: string[]): string {
  return `{${values.map((v) => `"${v.replace(/(["\\])/g, '\\$1')}"`).join(',')}}`
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
  const leftover: string[] = []
  // Keyset pages: a fixed offset would skip rows as fixed galleries leave the filter.
  for (let after = 0; ; ) {
    const { data, error } = await supabase
      .from('recipes')
      .select('id, slug, image_url, image_urls')
      .not('image_urls', 'eq', '{}')
      .gt('id', after)
      .order('id', { ascending: true })
      .limit(PAGE)
    if (error) {
      console.error(`✗ Query failed: ${error.message}`)
      process.exit(1)
    }
    if (!data || data.length === 0) break
    after = data[data.length - 1].id

    for (const r of data) {
      const gallery = r.image_urls as string[]
      const cover = r.image_url && isArchivedImageUrl(r.image_url) && !gallery.includes(r.image_url) ? r.image_url : null
      if (gallery.length < 2 && !cover) continue
      const compared = cover ? [cover, ...gallery] : gallery
      const unique = (await dedupeStoredGallery(compared, hashOfUrl)).filter((url) => url !== cover)
      if (unique.length === gallery.length) continue

      // A lone photo is dropped only when it is the cover, already shown on its own.
      let deduped = unique
      if (unique.length === 1 && !cover) {
        const [photoHash, coverHash] = await Promise.all([hashOfUrl(unique[0]), r.image_url ? hashOfUrl(r.image_url) : null])
        if (photoHash != null && photoHash === coverHash) deduped = []
      }
      changed++
      console.log(`  #${r.id} ${r.slug}: ${gallery.length} → ${deduped.length} (drop ${gallery.length - deduped.length})`)
      if (!apply) continue

      // Only if image_urls is still what was read: an extraction may have rewritten it since.
      const { data: updated, error: updateError } = await supabase
        .from('recipes')
        .update({ image_urls: deduped })
        .eq('id', r.id)
        .eq('image_urls', pgArrayLiteral(gallery))
        .select('id')
      if (updateError || !updated?.length) {
        console.log(`  ✗ #${r.id}: not updated (${updateError?.message ?? 'gallery changed since it was read'})`)
        continue
      }
      // Only the duplicates go; the cover's own file stays even when the gallery listed it.
      const coverPath = r.image_url ? extractStoragePath(r.image_url) : null
      const paths = gallery
        .filter((url) => !deduped.includes(url))
        .map(extractStoragePath)
        .filter((p): p is string => p != null && p !== coverPath)
      leftover.push(...(await removeImages(supabase, paths, 'dedupe-recipe-galleries')))
    }
  }

  if (changed === 0) console.log('✓ No duplicate gallery photos.')
  else if (apply) console.log(`✓ Done. Fixed ${changed}.`)
  else console.log(`Dry run — ${changed} recipe(s). Re-run with --apply.`)
  if (leftover.length > 0) {
    console.log(`${leftover.length} file(s) are no longer referenced but are still stored:`)
    for (const path of leftover) console.log(`  ${path}`)
  }
}

main().catch((err: Error) => {
  console.error(`✗ Failed: ${err.message}`)
  process.exit(1)
})
