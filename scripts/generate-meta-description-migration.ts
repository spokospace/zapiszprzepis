// Local generator that builds ONE comprehensive SQL migration filling
// recipes.meta_description for existing recipes. For each recipe it checks the
// SOURCE page's own description (og:description / <meta name="description">):
// when there is one the LLM refines it, otherwise the LLM writes a new sentence
// from the recipe's ingredients and steps. Rows the LLM can't describe fall back
// to a self-derived sentence, so every recipe ends up with one.
//
// The result is a committed migration the normal deploy applies — NOT a direct
// write to the database. This script only READS the database and spends OpenAI
// calls; review the generated .sql before applying it.
//
// It reads `recipes` without touching the meta_description column, so it runs
// before the schema migration is applied too; the generated UPDATEs carry a
// `meta_description is null` guard so applying them only fills empty rows.
//
//   pnpm generate:meta-migration            # fill-if-null (safe, guarded)
//   pnpm generate:meta-migration --all      # overwrite every recipe (no guard)
//   pnpm generate:meta-migration --limit 25 # cap how many rows to process
import { readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { generateMetaDescription } from '@/lib/recipe-labeling'
import { buildFallbackMetaDescription } from '@/lib/recipe-tags'
import { decodeEntities } from '@/lib/html-entities'
import { isPrivateUrl } from '@/lib/recipe-image-archive'

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const all = process.argv.includes('--all')
const limitIndex = process.argv.indexOf('--limit')
const limit = limitIndex >= 0 ? Number(process.argv[limitIndex + 1]) : undefined

/** The source page's own og:description or meta description, if any. */
function extractMetaDescription(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:description["']/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i,
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    const value = match?.[1] && decodeEntities(match[1]).replace(/\s+/g, ' ').trim()
    if (value) return value
  }
  return null
}

/** Best-effort read of the source page's description. Facebook gives none when
 *  logged out, so we don't even try; any failure just means "no hint". */
async function fetchSourceDescription(url: string | null, sourceType: string): Promise<string | null> {
  if (!url || isPrivateUrl(url) || sourceType === 'facebook_text' || sourceType === 'facebook_reel') return null
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'pl-PL,pl;q=0.9' },
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) return null
    return extractMetaDescription(await response.text())
  } catch {
    return null
  }
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

// A 14-digit stamp that always sorts AFTER every existing migration — so the
// generated backfill runs after the column migration even when the wall clock
// is earlier than a hand-authored timestamp.
function timestamp(migrationsDir: string): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  const now = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  const latest = readdirSync(migrationsDir)
    .map((f) => f.match(/^(\d{14})/)?.[1])
    .filter((v): v is string => Boolean(v))
    .sort()
    .pop()
  // A 14-digit stamp is well under Number.MAX_SAFE_INTEGER, so +1 is exact.
  return latest && latest >= now ? String(Number(latest) + 1) : now
}

async function main(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const apiKey = process.env.OPENAI_API_KEY
  if (!supabaseUrl || !serviceRoleKey || !apiKey) {
    console.error('✗ Brak NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / OPENAI_API_KEY w .env.local')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Deliberately NOT selecting meta_description: the script must run before the
  // schema migration lands too. The per-row null guard in the generated SQL is
  // what keeps the apply safe.
  let query = supabase
    .from('recipes')
    .select('id, title, description, category, ingredients, steps, source_url, source_type')
    .order('id')
  if (limit) query = query.limit(limit)

  const { data: recipes, error } = await query
  if (error || !recipes) {
    console.error(`✗ Query failed: ${error?.message}`)
    process.exit(1)
  }

  if (recipes.length === 0) {
    console.log('No recipes found.')
    return
  }

  console.log(`Generating meta descriptions for ${recipes.length} recipe(s)…\n`)

  // Idempotent by default: only fill rows still null, so re-applying the
  // migration or running it after a partial fill never clobbers a value.
  const guard = all ? '' : ' and meta_description is null'
  const lines: string[] = []
  for (const r of recipes) {
    const source = await fetchSourceDescription(r.source_url, r.source_type)
    const llm = await generateMetaDescription(
      { title: r.title, category: r.category, ingredients: r.ingredients, steps: r.steps },
      { sourceDescription: source, fetch, apiKey },
    )
    const meta = llm ?? buildFallbackMetaDescription(r)
    const origin = llm ? (source ? 'source→llm' : 'llm') : 'fallback'
    console.log(`#${r.id} [${origin}] ${meta}`)
    lines.push(`update public.recipes set meta_description = ${sqlString(meta)} where id = ${r.id}${guard};`)
  }

  const migrationsDir = join('supabase', 'migrations')
  const file = join(migrationsDir, `${timestamp(migrationsDir)}_backfill_meta_description_from_sources.sql`)
  const header = [
    '-- Backfill recipes.meta_description for existing recipes, generated by',
    '-- scripts/generate-meta-description-migration.ts against the source pages.',
    '-- Each row was described by the labelling model (refining the source page\'s',
    '-- own description when it had one), or by a self-derived fallback sentence.',
    `-- ${recipes.length} recipe(s)${all ? ' (overwrites every row)' : ' (fills only rows still null)'}.`,
    '--',
    '-- Rollback: data-only; set meta_description = null on these ids to revert.',
    '',
    '',
  ].join('\n')
  writeFileSync(file, header + lines.join('\n') + '\n', 'utf8')
  console.log(`\n✓ Wrote ${lines.length} update(s) to ${file}`)
  console.log('  Review it, then apply with your normal migration flow.')
}

main().catch((err: Error) => {
  console.error(`✗ Generation failed: ${err.message}`)
  process.exit(1)
})
