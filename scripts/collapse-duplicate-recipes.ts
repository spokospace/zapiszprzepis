import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { buildCollapseGroups, type CollapseGroup, type CollapseRow } from '../src/lib/recipe-collapse'

/**
 * A rolled-back production rehearsal (spec step 9): the migrations, the real
 * collapse, the checks, restore_recipe_merge, a check that everything is back,
 * then a forced rollback. Run with `supabase db query --linked -f <file>`; the
 * outcome comes back as the REHEARSAL_RESULT error. `withGuards` includes
 * migration C, for while it is not applied yet.
 */
function rehearsalSql(groups: CollapseGroup[], withGuards: boolean): string {
  const migration = (name: string) => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')
  const json = JSON.stringify(groups.map((g) => ({ canonical_id: g.canonicalId, loser_ids: g.loserIds })))
  // Fingerprints of the state the restore must bring back, taken before and after.
  const snapRecipes = `(select md5(string_agg(concat_ws('|', id, user_id, slug, source_url, source_fingerprint), ',' order by id)) from public.recipes)`
  const snapFavorites = `(select md5(string_agg(concat_ws('|', user_id, recipe_id, created_at), ',' order by user_id, recipe_id)) from public.favorites)`
  const snapShares = `(select md5(string_agg(concat_ws('|', id, recipe_id, status), ',' order by id)) from public.recipe_shares)`
  return `begin;
${withGuards ? migration('20261017090000_recipe_ownership_guards.sql') : ''}
${migration('20261017100000_recipe_merge_infra.sql')}
do $rehearsal$
declare
  groups jsonb := '${json}';
  merge uuid := gen_random_uuid();
  snap_recipes text; snap_favorites text; snap_shares text;
  losers bigint[];
  checks text := '';
  n int;
begin
  select array_agg(x::bigint) into losers
  from jsonb_array_elements(groups) g, jsonb_array_elements_text(g -> 'loser_ids') x;

  snap_recipes := ${snapRecipes};
  snap_favorites := ${snapFavorites};
  snap_shares := ${snapShares};

  perform public.collapse_recipe_groups(groups, merge);

  select count(*) into n from public.recipes where id = any(losers);
  checks := checks || format(' losers_left=%s', n);
  select count(*) into n from (select source_url from public.recipes where source_url is not null group by source_url having count(*) > 1) d;
  checks := checks || format(' url_dups=%s', n);
  select count(*) into n from (select source_fingerprint from public.recipes where source_fingerprint is not null group by source_fingerprint having count(*) > 1) d;
  checks := checks || format(' fingerprint_dups=%s', n);
  select count(*) into n
  from jsonb_array_elements(groups) g, jsonb_array_elements_text(g -> 'loser_ids') x
  join public.recipes_merged_duplicates a on a.id = x::bigint and a.merge_id = merge
  where a.user_id <> (select user_id from public.recipes where id = (g ->> 'canonical_id')::bigint)
    and not exists (select 1 from public.favorites f where f.user_id = a.user_id and f.recipe_id = (g ->> 'canonical_id')::bigint);
  checks := checks || format(' owners_without_favorite=%s', n);
  select count(*) into n from public.favorites f where not exists (select 1 from public.recipes r where r.id = f.recipe_id);
  checks := checks || format(' dangling_favorites=%s', n);
  select count(*) into n from public.recipe_shares where recipe_id = any(losers);
  checks := checks || format(' shares_on_losers=%s', n);

  perform public.restore_recipe_merge(merge);

  checks := checks || format(' restored_recipes=%s', snap_recipes = ${snapRecipes});
  checks := checks || format(' restored_favorites=%s', snap_favorites = ${snapFavorites});
  checks := checks || format(' restored_shares=%s', snap_shares = ${snapShares});

  raise exception 'REHEARSAL_RESULT groups=% losers=%:%', jsonb_array_length(groups), cardinality(losers), checks;
end;
$rehearsal$;
rollback;
`
}

// E01-S03a Phase 2 — the one-off collapse of duplicate recipes (one recipe per
// link). Dry run by default: prints every group, its canonical row (the main
// account's copy, else the oldest — decision Q2) and what moves. The owner
// reviews that report right before `--apply`, which runs every group in ONE
// transaction (collapse_recipe_groups) and re-checks that no duplicate is
// left. Undo: restore_recipe_merge('<merge id>') after migration B's down.

const MAIN_ACCOUNT = 'uzytkownik-5'
const PAGE = 1000

type Recipe = CollapseRow & { title: string }

async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    all.push(...(data ?? []))
    if (!data || data.length < PAGE) return all
  }
}

const loadRecipes = (supabase: SupabaseClient) =>
  fetchAll<Recipe>((from, to) =>
    supabase.from('recipes').select('id, user_id, title, source_url, source_fingerprint, created_at').order('id').range(from, to),
  )

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

  const profiles = await fetchAll<{ id: string; username: string }>((from, to) =>
    supabase.from('profiles').select('id, username').order('id').range(from, to),
  )
  const username = new Map(profiles.map((p) => [p.id, p.username]))
  const mainAccount = profiles.find((p) => p.username === MAIN_ACCOUNT)?.id ?? null
  if (!mainAccount) console.warn(`⚠ No @${MAIN_ACCOUNT} profile: every group keeps its oldest copy.`)

  const recipes = await loadRecipes(supabase)
  const byId = new Map(recipes.map((r) => [r.id, r]))
  const groups = buildCollapseGroups(recipes, mainAccount)
  if (groups.length === 0) {
    console.log(`✓ ${recipes.length} recipes, no duplicates.`)
    return
  }

  const loserIds = groups.flatMap((g) => g.loserIds)
  // In chunks: a long id list overflows the request URL, and a page caps at 1000 rows.
  const byLoser = async (table: string) => {
    const counts = new Map<number, number>()
    for (let i = 0; i < loserIds.length; i += 200) {
      const chunk = loserIds.slice(i, i + 200)
      const rows = await fetchAll<{ recipe_id: number }>((from, to) =>
        supabase.from(table).select('recipe_id').in('recipe_id', chunk).order('recipe_id').range(from, to),
      )
      for (const r of rows) counts.set(r.recipe_id, (counts.get(r.recipe_id) ?? 0) + 1)
    }
    return counts
  }
  const [favorites, shares] = await Promise.all([byLoser('favorites'), byLoser('recipe_shares')])
  const total = (m: Map<number, number>) => [...m.values()].reduce((a, b) => a + b, 0)

  const who = (userId: string) => `@${username.get(userId) ?? userId}`
  const label = (r: Recipe) => `#${r.id} "${r.title}" (${who(r.user_id)})`
  let favoritesCreated = 0
  let fingerprintsMoved = 0

  console.log(`${groups.length} duplicate groups among ${recipes.length} recipes:\n`)
  groups.forEach((group, i) => {
    const canonical = byId.get(group.canonicalId)!
    console.log(`${i + 1}. keep ${label(canonical)}\n   ${canonical.source_url ?? '(no link)'}`)
    let canonicalFingerprint = canonical.source_fingerprint
    for (const id of group.loserIds) {
      const loser = byId.get(id)!
      const favs = favorites.get(id) ?? 0
      const shareCount = shares.get(id) ?? 0
      const getsFavorite = loser.user_id !== canonical.user_id
      const movesFingerprint = loser.source_fingerprint != null && canonicalFingerprint == null
      if (movesFingerprint) canonicalFingerprint = loser.source_fingerprint
      favoritesCreated += getsFavorite ? 1 : 0
      fingerprintsMoved += movesFingerprint ? 1 : 0
      console.log(
        `   fold ${label(loser)} — favorites moved: ${favs}, shares repointed: ${shareCount}` +
          `${getsFavorite ? `, ${who(loser.user_id)} gets it as a favorite` : ''}` +
          `${movesFingerprint ? ', fingerprint moves to the canonical' : ''}` +
          `\n        ${loser.source_url ?? '(no link)'}`,
      )
    }
  })
  console.log(
    `\nTotal: ${loserIds.length} rows archived and removed, ${favoritesCreated} favorites created, ` +
      `${total(favorites)} favorites moved, ${total(shares)} shares repointed, ${fingerprintsMoved} fingerprints moved.`,
  )

  const rehearsalPath = process.argv.find((a) => a.startsWith('--rehearsal-sql='))?.split('=')[1]
  if (rehearsalPath) {
    const sql = rehearsalSql(groups, !process.argv.includes('--guards-live'))
    writeFileSync(rehearsalPath, sql)
    console.log(`\nRehearsal SQL written to ${rehearsalPath} (it always rolls back).`)
  }

  if (!apply) {
    console.log('\nDry run — review the report above, then pass --apply.')
    return
  }

  const mergeId = randomUUID()
  const { error } = await supabase.rpc('collapse_recipe_groups', {
    p_groups: groups.map((g) => ({ canonical_id: g.canonicalId, loser_ids: g.loserIds })),
    p_merge_id: mergeId,
  })
  if (error) {
    console.error(`✗ Collapse failed, nothing was changed: ${error.message}`)
    process.exit(1)
  }

  const left = buildCollapseGroups(await loadRecipes(supabase), mainAccount)
  if (left.length > 0) {
    console.error(`✗ ${left.length} duplicate groups remain after the collapse (merge ${mergeId}).`)
    process.exit(1)
  }
  console.log(`\n✓ Collapsed. merge_id = ${mergeId}`)
  console.log('  Next: migration B (global unique indexes), right away.')
  console.log(`  Undo: drop the global indexes, then select public.restore_recipe_merge('${mergeId}');`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
