import { createSupabaseServerClient } from '@/lib/supabase/server'

/** One canonical recipe for discoverability surfaces: its slug and a sitemap <lastmod>. */
export interface CanonicalRecipe {
  slug: string
  /** ISO timestamp: last_modified when the view exposes it, else created_at. */
  lastModified: string
}

/** The columns listCanonicalRecipes reads. last_modified is absent until the Phase-1 view migration. */
interface PublicRecipeRow {
  slug: string
  created_at: string
  last_modified?: string | null
}

const PAGE_SIZE = 1000

/**
 * Distinct recipes by slug, oldest-wins — the single owner of that rule so the
 * sitemap, llms.txt and the `.md` handler can never disagree on which row is
 * canonical. `public_recipes` may still hold two rows sharing a slug until the
 * global-unique-slug migration lands; the oldest (created_at, then id) is the
 * deterministic winner, mirroring loadRecipe. Rows must already be ordered
 * ascending by (created_at, id); the first row seen for a slug wins.
 */
export function dedupeCanonical(rows: readonly PublicRecipeRow[]): CanonicalRecipe[] {
  const seen = new Set<string>()
  const out: CanonicalRecipe[] = []
  for (const r of rows) {
    if (seen.has(r.slug)) continue
    seen.add(r.slug)
    out.push({ slug: r.slug, lastModified: r.last_modified ?? r.created_at })
  }
  return out
}

/** A PostgREST undefined-column error — the view migration is not applied yet. */
function isUndefinedColumn(error: { code?: string; message?: string }): boolean {
  return error.code === '42703' || /last_modified/.test(error.message ?? '')
}

/**
 * Every public recipe as a canonical {slug, lastModified}, deduped oldest-wins.
 * Reads the guest-safe public_recipes view, paging past PostgREST's row cap so a
 * large catalog is listed in full. last_modified is selected when present and the
 * query retries without it (falling back to created_at) when the Phase-1 view
 * migration has not been applied, so the sitemap works in either DB state.
 */
export async function listCanonicalRecipes(): Promise<CanonicalRecipe[]> {
  const supabase = await createSupabaseServerClient()
  const fetchPage = (columns: string, from: number) =>
    supabase
      .from('public_recipes')
      .select(columns)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
      .returns<PublicRecipeRow[]>()

  const rows: PublicRecipeRow[] = []
  // `columns` is the only migration-state we carry: once a page reports
  // last_modified missing, drop it for good (the retry can't fail the same way).
  let columns = 'slug, created_at, last_modified'
  for (let from = 0; ; from += PAGE_SIZE) {
    let { data, error } = await fetchPage(columns, from)
    if (error && isUndefinedColumn(error)) {
      columns = 'slug, created_at'
      ;({ data, error } = await fetchPage(columns, from))
    }
    if (error || !data) throw error ?? new Error('public_recipes read failed')

    rows.push(...data)
    if (data.length < PAGE_SIZE) break
  }

  return dedupeCanonical(rows)
}
