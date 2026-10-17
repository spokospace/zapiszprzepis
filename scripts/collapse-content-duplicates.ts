import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { buildContentDuplicateGroups, type ContentRow } from '../src/lib/recipe-content-dedup'
import { ingredientNames } from '../src/lib/recipe-dedup'

/**
 * Finds and collapses recipes that are ONE recipe extracted more than once —
 * same title, one ingredient list a subset of the other — which the URL and
 * fingerprint dedup miss because each copy came from a different link
 * (the "miodownik z kaszą manną" pair). This is the content-level companion to
 * scripts/collapse-duplicate-recipes.ts (same-link dedup); it reuses the same
 * reversible collapse_recipe_groups RPC.
 *
 * Dry run by default — prints every group, the copy it keeps (the fullest,
 * then the main account's, then the oldest) and what folds in. Review that,
 * then `--apply`. The kept copy inherits a cleaner base slug freed by the
 * collapse, so the nicer URL keeps working. Undo: restore_recipe_merge('<id>').
 */
const MAIN_ACCOUNT = process.argv.find((a) => a.startsWith('--main-account='))?.split('=')[1] ?? 'tola'
const PAGE = 1000

type Recipe = ContentRow & { slug: string; category: string }

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
    supabase.from('recipes').select('id, user_id, title, slug, category, ingredients, created_at').order('id').range(from, to),
  )

/** The nicest slug in a group: a base slug (no `-2`, `-3` … suffix) beats a
 *  suffixed one, then the shorter, so the kept copy can reclaim it. */
function bestSlug(slugs: string[]): string {
  return [...slugs].sort((a, b) => {
    const suffixed = (s: string) => (/-\d+$/.test(s) ? 1 : 0)
    return suffixed(a) - suffixed(b) || a.length - b.length || a.localeCompare(b)
  })[0]
}

async function main(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('✗ Brak NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w .env.local')
    process.exit(1)
  }
  const apply = process.argv.includes('--apply')
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

  const profiles = await fetchAll<{ id: string; username: string }>((from, to) =>
    supabase.from('profiles').select('id, username').order('id').range(from, to),
  )
  const username = new Map(profiles.map((p) => [p.id, p.username]))
  const mainAccount = profiles.find((p) => p.username === MAIN_ACCOUNT)?.id ?? null

  const recipes = await loadRecipes(supabase)
  const byId = new Map(recipes.map((r) => [r.id, r]))
  const groups = buildContentDuplicateGroups(recipes, mainAccount)
  if (groups.length === 0) {
    console.log(`✓ ${recipes.length} recipes, no content duplicates.`)
    return
  }

  const loserIds = groups.flatMap((g) => g.loserIds)
  const byLoser = async (table: string) => {
    const counts = new Map<number, number>()
    for (let i = 0; i < loserIds.length; i += 200) {
      const rows = await fetchAll<{ recipe_id: number }>((from, to) =>
        supabase.from(table).select('recipe_id').in('recipe_id', loserIds.slice(i, i + 200)).order('recipe_id').range(from, to),
      )
      for (const r of rows) counts.set(r.recipe_id, (counts.get(r.recipe_id) ?? 0) + 1)
    }
    return counts
  }
  const [favorites, shares] = await Promise.all([byLoser('favorites'), byLoser('recipe_shares')])

  const who = (userId: string) => `@${username.get(userId) ?? userId}`
  const label = (r: Recipe) => `#${r.id} "${r.title}" [${r.category}] ${ingredientNames(r.ingredients).size} ingredients ${r.slug} (${who(r.user_id)})`

  // The slug the kept copy should end up at, and whether it must be renamed.
  const finalSlug = (group: (typeof groups)[number]) => {
    const members = [group.canonicalId, ...group.loserIds].map((id) => byId.get(id)!)
    return bestSlug(members.map((r) => r.slug))
  }

  console.log(`${groups.length} content-duplicate groups among ${recipes.length} recipes:\n`)
  groups.forEach((group, i) => {
    const canonical = byId.get(group.canonicalId)!
    const slug = finalSlug(group)
    console.log(`${i + 1}. keep ${label(canonical)}${slug !== canonical.slug ? `  → rename slug to "${slug}"` : ''}`)
    for (const id of group.loserIds) {
      const loser = byId.get(id)!
      console.log(`   fold ${label(loser)} — favorites moved: ${favorites.get(id) ?? 0}, shares repointed: ${shares.get(id) ?? 0}`)
    }
  })
  console.log(`\nTotal: ${loserIds.length} rows archived and removed.`)

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

  // Reclaim the nicer slug freed by the collapse, so the old URL keeps working.
  // Best-effort and guarded: a slug the canonical's owner already uses elsewhere
  // is left alone (the kept copy stays on its own slug).
  let renamed = 0
  for (const group of groups) {
    const canonical = byId.get(group.canonicalId)!
    const slug = finalSlug(group)
    if (slug === canonical.slug) continue
    const { data: clash } = await supabase.from('recipes').select('id').eq('user_id', canonical.user_id).eq('slug', slug).maybeSingle()
    if (clash) {
      console.warn(`  ⚠ keep #${canonical.id}: slug "${slug}" is taken by #${clash.id}, leaving "${canonical.slug}"`)
      continue
    }
    const { error: renameError } = await supabase.from('recipes').update({ slug }).eq('id', canonical.id)
    if (renameError) console.warn(`  ⚠ keep #${canonical.id}: slug rename failed: ${renameError.message}`)
    else renamed++
  }

  console.log(`\n✓ Collapsed ${groups.length} groups, renamed ${renamed} slugs. merge_id = ${mergeId}`)
  console.log(`  Undo: select public.restore_recipe_merge('${mergeId}');`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
