// One-off rewrite of saved recipes' steps into impersonal instructions
// ("Pokroić mięso w kostkę.") — the form the extraction prompt asks for since
// STEP_FORM_RULE. Recipes saved before it kept the author's narration
// ("Umyte mięso pokroiłam…"). Works from the stored steps: no re-scraping.
//
// Only recipes whose steps don't read as instructions go to the model
// (needsStepRewrite); --all sends every recipe that has steps, --slug one
// recipe whatever its steps. An answer that changes the number of steps or any
// number in a step (amount, time, temperature) is rejected and listed, and the
// recipe is left as it is.
//
// --sql writes the changes as UPDATEs for the Supabase SQL Editor instead of
// writing them: one transaction, each row guarded by its current steps, so a
// recipe edited after the preview is left alone.
//
//   pnpm rewrite:recipe-steps                      # preview, writes nothing
//   pnpm rewrite:recipe-steps --slug <slug>        # preview one recipe
//   pnpm rewrite:recipe-steps --limit 20           # preview the first 20 candidates
//   pnpm rewrite:recipe-steps --sql steps.sql      # preview + write the UPDATEs to steps.sql
//   pnpm rewrite:recipe-steps --apply              # write the changes
import { writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { needsStepRewrite, rewriteSteps } from '@/lib/step-form'
import { parseSteps } from '@/lib/steps'

const apply = process.argv.includes('--apply')
const all = process.argv.includes('--all')
const slug = argValue('--slug')
const sqlFile = argValue('--sql')
const limit = argValue('--limit') ? Number(argValue('--limit')) : undefined
// Parallel model calls: a few hundred recipes in minutes, well under the rate limit.
const CONCURRENCY = 5
const PAGE = 1000

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function sqlJson(value: unknown): string {
  return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`
}

type Row = { id: number; slug: string; title: string; steps: unknown }
type Outcome = { row: Row; steps: string[]; rewritten: string[] | null } | { row: Row; error: string }

async function main(): Promise<void> {
  if (apply && sqlFile) {
    console.error('✗ --apply and --sql exclude each other: --sql only writes a file.')
    process.exit(1)
  }
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

  // PostgREST caps a read at 1000 rows, so page through.
  const rows: Row[] = []
  for (let from = 0; ; from += PAGE) {
    let query = supabase.from('recipes').select('id, slug, title, steps').order('id').range(from, from + PAGE - 1)
    if (slug) query = query.eq('slug', slug)
    const { data, error } = await query
    if (error || !data) {
      console.error(`✗ Query failed: ${error?.message}`)
      process.exit(1)
    }
    rows.push(...data)
    if (data.length < PAGE) break
  }

  const candidates = rows
    .filter((r) => {
      const steps = parseSteps(r.steps)
      return steps.length > 0 && (all || slug != null || needsStepRewrite(steps))
    })
    .slice(0, limit)
  console.log(`${rows.length} recipe(s), ${candidates.length} to rewrite${apply ? '' : ' (preview)'}.\n`)

  const outcomes: Outcome[] = []
  for (let i = 0; i < candidates.length; i += CONCURRENCY) {
    const batch = await Promise.all(
      candidates.slice(i, i + CONCURRENCY).map(async (row): Promise<Outcome> => {
        const steps = parseSteps(row.steps)
        try {
          return { row, steps, rewritten: await rewriteSteps(steps, { fetch, apiKey }) }
        } catch (err) {
          return { row, error: (err as Error).message }
        }
      }),
    )
    outcomes.push(...batch)
  }

  const changed: { row: Row; steps: string[] }[] = []
  const rejected: Row[] = []
  const failed: Row[] = []
  let unchanged = 0
  for (const o of outcomes) {
    const label = `#${o.row.id} ${o.row.title} (${o.row.slug})`
    if ('error' in o) {
      console.log(`✗ ${label}: ${o.error}\n`)
      failed.push(o.row)
    } else if (o.rewritten == null) {
      console.log(`⚠ ${label}: answer changed the step count or a number — skipped\n`)
      rejected.push(o.row)
    } else if (o.rewritten.every((s, i) => s === o.steps[i])) {
      unchanged++
    } else {
      console.log(label)
      o.steps.forEach((before, i) => {
        if (o.rewritten![i] === before) return
        console.log(`  ${i + 1}. ${before}`)
        console.log(`   → ${o.rewritten![i]}`)
      })
      console.log('')
      changed.push({ row: o.row, steps: o.rewritten })
    }
  }

  if (apply) {
    for (const { row, steps } of changed) {
      const { error } = await supabase.from('recipes').update({ steps }).eq('id', row.id)
      if (error) console.error(`  ✗ ${row.id}: ${error.message}`)
    }
  }

  if (sqlFile) {
    const lines = changed.map(
      ({ row, steps }) =>
        `update public.recipes set steps = ${sqlJson(steps)} where id = ${row.id} and steps = ${sqlJson(row.steps)};`,
    )
    const header = [
      '-- Rewrite of recipe steps into impersonal instructions, generated by',
      '-- scripts/rewrite-recipe-steps.ts. Each row is guarded by the steps it had',
      '-- at preview time, so a recipe edited since is left as it is.',
      `-- ${changed.length} recipe(s).`,
      '',
      'begin;',
      '',
    ].join('\n')
    writeFileSync(sqlFile, `${header}${lines.join('\n')}\n\ncommit;\n`, 'utf8')
  }

  console.log(
    `${changed.length} rewritten, ${unchanged} already fine, ${rejected.length} rejected, ${failed.length} failed.`,
  )
  if (rejected.length) console.log(`Rejected: ${rejected.map((r) => r.id).join(', ')}`)
  if (failed.length) console.log(`Failed: ${failed.map((r) => r.id).join(', ')}`)
  if (apply) console.log('✓ Done.')
  else if (sqlFile) console.log(`✓ Wrote ${changed.length} update(s) to ${sqlFile} — review it, then run it in the Supabase SQL Editor.`)
  else console.log('Preview only — rerun with --apply to write, or --sql <file> for the SQL Editor.')
}

main().catch((err: Error) => {
  console.error(`✗ Rewrite failed: ${err.message}`)
  process.exit(1)
})
