import { createClient } from '@supabase/supabase-js'
import { archiveImage, isArchivedImageUrl } from '../src/lib/recipe-image-archive'

/**
 * Backfills recipe covers onto Supabase Storage so image_url is only ever a
 * Storage URL or null (the archive-first invariant) and no external host is
 * referenced by a rendered page. It re-archives each cover directly from the
 * stored external URL via archiveImage (which falls back to the wsrv.nl proxy
 * for hosts that refuse the Worker) — no re-scrape, no LLM, no scraper credits.
 *
 * Dry-run by default; pass --apply to write. --limit <n> caps how many are done.
 *   node --env-file=.env.local --import tsx scripts/backfill-archive-covers.ts
 *   node --env-file=.env.local --import tsx scripts/backfill-archive-covers.ts --apply --limit 20
 *
 * NOTE: local dev points at the PRODUCTION Supabase DB — --apply writes real rows.
 */
const PAGE = 1000

async function main(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('✗ Brak NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w .env.local')
    process.exit(1)
  }

  const apply = process.argv.includes('--apply')
  const limitIdx = process.argv.indexOf('--limit')
  const limit = limitIdx >= 0 ? Number(process.argv[limitIdx + 1]) : undefined
  if (limit !== undefined && !(limit > 0)) {
    console.error(`✗ --limit wants a positive number, got "${process.argv[limitIdx + 1]}"`)
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Page through the table (a plain select caps at 1000 rows) and keep only
  // covers that point outside Storage — the same predicate the renderer uses,
  // so the backfill targets exactly the rows shown as NoPhoto. A null image_url
  // is already NoPhoto and is left alone.
  const targets: { id: number; slug: string; user_id: string; image_url: string }[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('recipes')
      .select('id, slug, user_id, image_url')
      .not('image_url', 'is', null)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) {
      console.error(`✗ Query failed: ${error.message}`)
      process.exit(1)
    }
    for (const r of data ?? []) {
      if (!isArchivedImageUrl(r.image_url as string)) {
        targets.push(r as (typeof targets)[number])
      }
    }
    if ((data?.length ?? 0) < PAGE) break
    if (limit !== undefined && targets.length >= limit) break
  }

  const work = limit !== undefined ? targets.slice(0, limit) : targets
  if (work.length === 0) {
    console.log('✓ Nothing to backfill — every cover already points at Supabase Storage (or is null).')
    return
  }

  if (!apply) {
    console.log(`${work.length} recipe(s) have an external cover:`)
    for (const r of work) console.log(`  #${r.id} ${r.slug} ← ${r.image_url}`)
    console.log('\nDry run — nothing written. Re-run with --apply to archive these onto Supabase Storage.')
    return
  }

  console.log(`Archiving ${work.length} cover(s)…`)
  let archived = 0
  let failed = 0
  for (const r of work) {
    const storageUrl = await archiveImage(supabase, r.user_id, r.id, r.image_url)
    if (!storageUrl) {
      failed++
      console.log(`  ✗ #${r.id} (${r.slug}): could not archive ${r.image_url.slice(0, 80)}`)
      continue
    }
    // A cache buster forces Cloudflare and browsers off a previously cached image
    // at the same Storage path (archiveImage upserts to <user>/<recipe>.<ext>).
    const busted = `${storageUrl}?v=${Date.now().toString(36)}`
    const { error: updateError } = await supabase.from('recipes').update({ image_url: busted }).eq('id', r.id)
    if (updateError) {
      failed++
      console.log(`  ✗ #${r.id} (${r.slug}): image_url update failed: ${updateError.message}`)
      continue
    }
    archived++
    console.log(`  ✓ #${r.id} (${r.slug})`)
  }

  console.log(`\n✓ Done. Archived ${archived}, failed ${failed}.`)
  if (failed > 0) {
    console.log('  Failed recipes keep their external image_url; they render as NoPhoto until re-extracted.')
  }
}

main().catch((err: Error) => {
  console.error(`✗ Backfill failed: ${err.message}`)
  process.exit(1)
})
