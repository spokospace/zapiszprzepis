// Deterministic step-image backfill: for recipes whose source page exposes
// schema.org HowToStep images that line up 1:1 with the stored steps, archive
// those photos into Storage and set recipes.step_images. No OpenAI, no re-scrape
// service — a direct fetch of the source page, so it is cheap and safe. Sources
// without structured per-step images are left untouched (their step photos, if
// any, need the LLM/in-content path, i.e. a full re-extraction).
//
//   node --env-file=.env.local --import tsx scripts/backfill-step-images.ts [limit] [--write]
import { createClient } from '@supabase/supabase-js'
import { archiveStepImages, jsonLdHowToStepImages } from '../src/lib/recipe-image-archive'
import { parseSteps } from '../src/lib/steps'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const limit = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 50)
  const write = process.argv.includes('--write')
  const supabase = createClient(url, key, { auth: { persistSession: false } })

  const { data, error } = await supabase
    .from('recipes')
    .select('id, slug, user_id, source_url, steps, step_images, image_urls')
    .eq('source_type', 'web_blog')
    .not('source_url', 'is', null)
    .order('id', { ascending: false })
    .limit(1000)
  if (error) throw error

  // Only recipes that still have no step photos and have a gallery (photo-rich).
  const candidates = (data ?? []).filter(
    (r) => (r.image_urls?.length ?? 0) > 1 && !(r.step_images ?? []).some(Boolean),
  )

  let updated = 0
  let examined = 0
  for (const r of candidates) {
    if (updated >= limit) break
    examined++
    const steps = parseSteps(r.steps)
    if (steps.length === 0) continue
    let html = ''
    try {
      const res = await fetch(r.source_url!, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) })
      html = res.ok ? await res.text() : ''
    } catch {
      /* skip on fetch error */
    }
    const howTo = html ? jsonLdHowToStepImages(html, r.source_url ?? undefined) : []
    // Only when the source's step list lines up 1:1 with ours, so index i matches.
    if (howTo.length !== steps.length || !howTo.some(Boolean)) continue

    const sources = howTo.map((u) => u || null)
    if (!write) {
      console.log(`[dry] ${r.slug} — would set ${sources.filter(Boolean).length}/${steps.length} step photos`)
      updated++
      continue
    }
    const archived = await archiveStepImages(supabase, r.user_id, r.id, sources)
    if (!archived.some(Boolean)) {
      console.log(`[skip] ${r.slug} — no photo archived (download failed)`)
      continue
    }
    const { error: upErr } = await supabase.from('recipes').update({ step_images: archived }).eq('id', r.id)
    if (upErr) {
      console.error(`[err ] ${r.slug}:`, upErr.message)
      continue
    }
    updated++
    console.log(`[ok  ] ${r.slug} — ${archived.filter(Boolean).length}/${steps.length} step photos archived`)
  }
  console.log(`\n${write ? 'Updated' : '[dry] would update'} ${updated} recipe(s) (examined ${examined}).`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
