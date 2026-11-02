// Local dev and the e2e suite run against the production Supabase project
// (CLAUDE.md, "Lokalny dev = produkcyjna baza"). A test that writes rows — adding a
// recipe creates a `recipe_shares` row and starts a real Inngest job — may run only
// against another project, and only when asked to (#375, audit A8).
//
// Opt in with E2E_DB_WRITES=1 while the dev server points at a non-production
// project (a separate test database is planned in E03).

/** Host of the production Supabase project (NEXT_PUBLIC_SUPABASE_URL in wrangler.jsonc). */
export const PRODUCTION_SUPABASE_HOST = 'wvrlgddgdddwmgzbvtij.supabase.co'

export const DB_WRITES_SKIP_REASON =
  'Writes to the database: set E2E_DB_WRITES=1 and point NEXT_PUBLIC_SUPABASE_URL at a non-production project'

/**
 * True only when writes were explicitly allowed and the target database is known and
 * is not production. A missing or unparsable URL counts as production: local dev
 * defaults to the production project.
 */
export function dbWritesAllowed(env: Record<string, string | undefined>): boolean {
  if (env.E2E_DB_WRITES !== '1') return false
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  if (!url) return false
  try {
    return new URL(url).hostname.toLowerCase() !== PRODUCTION_SUPABASE_HOST
  } catch {
    return false
  }
}
