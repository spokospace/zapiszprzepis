// Applies a reviewed batch of recipe fixes (titles, categories, steps) from a
// JSON file — the REST twin of the guarded SQL files run in the SQL Editor.
//
// The file is a list of {"id": 25, "where": {"title": "Jak zrobić domowe
// lody?"}, "set": {"title": "Domowe lody"}}. A row is written only while every
// "where" field still holds that value, so a recipe edited since the review is
// left as it is; one already holding "set" counts as done.
//
// Without --apply it only reports, reading public_recipes with the publishable
// key from wrangler.jsonc. --apply needs SUPABASE_SERVICE_ROLE_KEY.
//
// The batches hold recipe text from third-party sites, so they stay out of git
// (scripts/data-fixes/ is ignored except steps-reviewed.json).
//
//   pnpm apply:recipe-fixes scripts/data-fixes/2026-10-18-cleanup-01.json
//   pnpm apply:recipe-fixes scripts/data-fixes/2026-10-18-cleanup-01.json --apply
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

type Fields = Record<string, unknown>
type Fix = { id: number; where: Fields; set: Fields }

/** A public var from wrangler.jsonc (the Supabase URL, the publishable key). */
function wranglerVar(name: string): string | undefined {
  try {
    return readFileSync('wrangler.jsonc', 'utf8').match(new RegExp(`"${name}":\\s*"([^"]+)"`))?.[1]
  } catch {
    return undefined
  }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const holds = (row: Fields, fields: Fields) => Object.entries(fields).every(([k, v]) => same(row[k], v))

async function main(): Promise<void> {
  const file = process.argv.slice(2).find((a) => !a.startsWith('--'))
  const apply = process.argv.includes('--apply')
  if (!file) {
    console.error('✗ Give the fixes file: pnpm apply:recipe-fixes <file.json> [--apply]')
    process.exit(1)
  }
  const fixes = JSON.parse(readFileSync(file, 'utf8')) as Fix[]

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? wranglerVar('NEXT_PUBLIC_SUPABASE_URL')
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseKey = serviceRoleKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? wranglerVar('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  if (apply && !serviceRoleKey) {
    console.error('✗ --apply wymaga SUPABASE_SERVICE_ROLE_KEY.')
    process.exit(1)
  }
  if (!supabaseUrl || !supabaseKey) {
    console.error('✗ Brak NEXT_PUBLIC_SUPABASE_URL / klucza Supabase (ani w env, ani w wrangler.jsonc)')
    process.exit(1)
  }
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { autoRefreshToken: false, persistSession: false } })

  const columns = [...new Set(fixes.flatMap((f) => [...Object.keys(f.where), ...Object.keys(f.set)]))]
  const { data, error } = await supabase
    .from(serviceRoleKey ? 'recipes' : 'public_recipes')
    .select(['id', 'title', ...columns.filter((c) => c !== 'title')].join(', '))
    .in('id', fixes.map((f) => f.id))
  if (error || !data) {
    console.error(`✗ Query failed: ${error?.message}`)
    process.exit(1)
  }
  const rows = new Map((data as unknown as Fields[]).map((r) => [r.id as number, r]))

  let written = 0, done = 0
  const skipped: string[] = []
  for (const fix of fixes) {
    const row = rows.get(fix.id)
    if (!row) {
      skipped.push(`#${fix.id}: no such recipe`)
    } else if (holds(row, fix.set)) {
      done++
    } else if (!holds(row, fix.where)) {
      const changed = Object.keys(fix.where).filter((k) => !same(row[k], fix.where[k]))
      skipped.push(`#${fix.id} ${row.title}: ${changed.join(', ')} changed since the review`)
    } else {
      const summary = Object.keys(fix.set).map((k) => (k === 'steps' ? 'steps' : `${k}: ${row[k]} → ${fix.set[k]}`))
      console.log(`#${fix.id} ${row.title} — ${summary.join('; ')}`)
      if (apply) {
        const { error: updateError } = await supabase.from('recipes').update(fix.set).eq('id', fix.id)
        if (updateError) {
          skipped.push(`#${fix.id}: ${updateError.message}`)
          continue
        }
      }
      written++
    }
  }

  skipped.forEach((s) => console.log(`⚠ ${s}`))
  console.log(`\n${written} ${apply ? 'written' : 'to write'}, ${done} already done, ${skipped.length} skipped.`)
  if (!apply && written) console.log('Preview only — rerun with --apply to write.')
}

main().catch((err: Error) => {
  console.error(`✗ ${err.message}`)
  process.exit(1)
})
