/**
 * Asks for a new build when the recipe files are behind the database. Runs on the Worker's
 * five-minute cron. The deployed files say which content they hold, so a failed build needs no
 * bookkeeping: the files stay behind and the next run asks again, within the limits below.
 */
import type { Fetch } from './search-console'
import { restBase, restHeaders, type CronEnv } from './worker-cron'

/** A build takes about 7 minutes; this keeps a second one from queueing behind it. */
const MIN_GAP_MS = 10 * 60_000
/** Keeps 3,000 build minutes a month within reach. Resets at midnight UTC. */
const DAILY_BUILDS = 12

export type RecipeFilesState = {
  content_version: number
  build_requested_at: string | null
  builds_day: string | null
  builds_today: number
}

const utcDay = (now: Date) => now.toISOString().slice(0, 10)

/** `deployed` is null when the live build has no version: it predates this, could not read one, or left many recipes out. */
export function shouldRequestBuild(state: RecipeFilesState, deployed: number | null, now: Date): boolean {
  if (deployed !== null && deployed >= state.content_version) return false
  if (state.builds_day === utcDay(now) && state.builds_today >= DAILY_BUILDS) return false
  const last = state.build_requested_at ? Date.parse(state.build_requested_at) : 0
  return now.getTime() - last >= MIN_GAP_MS
}

async function deployedVersion(assets: NonNullable<CronEnv['ASSETS']>): Promise<number | null> {
  const response = await assets.fetch('https://assets.local/recipe-files-version.json')
  if (!response.ok) return null
  const { version } = (await response.json()) as { version: number | null }
  return version
}

/** Never throws: a failed check must not take the scheduled run down; the log line is the alert. */
export async function requestRecipeFilesBuild(env: CronEnv, fetchFn: Fetch = fetch, now: Date = new Date()): Promise<void> {
  const hook = env.RECIPE_FILES_DEPLOY_HOOK
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!hook || !key || !env.ASSETS) return

  const table = `${restBase(env)}/rest/v1/recipe_files_state`
  const headers = restHeaders(key)
  try {
    const [res, deployed] = await Promise.all([
      fetchFn(`${table}?select=content_version,build_requested_at,builds_day,builds_today`, { headers }),
      deployedVersion(env.ASSETS),
    ])
    if (!res.ok) throw new Error(`state: Supabase responded ${res.status}`)
    const [state] = (await res.json()) as RecipeFilesState[]
    if (!shouldRequestBuild(state, deployed, now)) return

    // Counted before the call: if saving failed after it, the limits would not hold.
    const today = utcDay(now)
    const saved = await fetchFn(`${table}?id=eq.true`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        build_requested_at: now.toISOString(),
        builds_day: today,
        builds_today: state.builds_day === today ? state.builds_today + 1 : 1,
      }),
    })
    if (!saved.ok) throw new Error(`state update: Supabase responded ${saved.status}`)

    const build = await fetchFn(hook, { method: 'POST' })
    if (!build.ok) throw new Error(`deploy hook responded ${build.status}`)
    console.log(`recipe-files: build requested for content version ${state.content_version}`)
  } catch (error) {
    console.error('recipe-files: refresh failed', error)
  }
}
