import { describe, expect, it, vi } from 'vitest'
import { requestRecipeFilesBuild, shouldRequestBuild, type RecipeFilesState } from './recipe-files-refresh'

const NOW = new Date('2026-11-06T12:00:00Z')
const files = (version: number | null, day: string | null = null) => ({ version, day })
const STATE: RecipeFilesState = { content_version: 5, build_requested_at: null, builds_day: null, builds_today: 0 }

describe('shouldRequestBuild', () => {
  it('stays quiet while the files hold the current content', () => {
    expect(shouldRequestBuild(STATE, files(5), NOW)).toBe(false)
  })

  it('asks when the files are behind, or say nothing about their content', () => {
    expect(shouldRequestBuild(STATE, files(4), NOW)).toBe(true)
    expect(shouldRequestBuild(STATE, files(null), NOW)).toBe(true)
  })

  it('asks after Polish midnight when the home file holds the previous day pick, even with current content', () => {
    expect(shouldRequestBuild(STATE, files(5, '2026-11-05'), NOW)).toBe(true)
    expect(shouldRequestBuild(STATE, files(5, '2026-11-06'), NOW)).toBe(false)
  })

  it('has no daily rebuild when the home page is not a file', () => {
    expect(shouldRequestBuild(STATE, files(5, null), NOW)).toBe(false)
  })

  it('waits 10 minutes after the last request', () => {
    expect(shouldRequestBuild({ ...STATE, build_requested_at: '2026-11-06T11:51:00Z' }, files(4), NOW)).toBe(false)
    expect(shouldRequestBuild({ ...STATE, build_requested_at: '2026-11-06T11:50:00Z' }, files(4), NOW)).toBe(true)
  })

  it('stops at 12 builds a day and starts again the next UTC day', () => {
    const spent = { ...STATE, builds_day: '2026-11-06', builds_today: 12 }
    expect(shouldRequestBuild(spent, files(4), NOW)).toBe(false)
    expect(shouldRequestBuild({ ...spent, builds_day: '2026-11-05' }, files(4), NOW)).toBe(true)
  })
})

describe('requestRecipeFilesBuild', () => {
  const HOOK = 'https://hook.test/build'
  const env = (deployed: number) => ({
    NEXT_PUBLIC_SUPABASE_URL: 'https://db.test',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
    SUPABASE_SERVICE_ROLE_KEY: 'key',
    RECIPE_FILES_DEPLOY_HOOK: HOOK,
    ASSETS: { fetch: async () => Response.json({ version: deployed, day: null }) },
  })

  function fakeFetch(hookStatus = 200) {
    const calls: { url: string; body?: string }[] = []
    const fetchFn = async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body as string | undefined })
      if (url === HOOK) return new Response(null, { status: hookStatus })
      if (init?.method === 'PATCH') return new Response(null, { status: 204 })
      return Response.json([{ ...STATE, builds_day: '2026-11-06', builds_today: 2 }])
    }
    return { calls, fetchFn }
  }

  it('calls the hook once and counts the build', async () => {
    const { calls, fetchFn } = fakeFetch()
    await requestRecipeFilesBuild(env(4), fetchFn, NOW)
    expect(calls.filter((call) => call.url === HOOK)).toHaveLength(1)
    expect(JSON.parse(calls.find((call) => call.body)?.body ?? '{}')).toEqual({ build_requested_at: NOW.toISOString(), builds_day: '2026-11-06', builds_today: 3 })
  })

  it('counts the request before calling the hook, and does not throw when the hook refuses', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { calls, fetchFn } = fakeFetch(500)
    await requestRecipeFilesBuild(env(4), fetchFn, NOW)
    expect(calls.findIndex((call) => call.body)).toBeLessThan(calls.findIndex((call) => call.url === HOOK))
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })

  it('does not call the hook when the request cannot be counted', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { calls, fetchFn } = fakeFetch()
    const failingSave = async (url: string, init?: RequestInit) =>
      init?.method === 'PATCH' ? new Response(null, { status: 500 }) : fetchFn(url, init)
    await requestRecipeFilesBuild(env(4), failingSave, NOW)
    expect(calls.some((call) => call.url === HOOK)).toBe(false)
    error.mockRestore()
  })

  it('does nothing without the hook', async () => {
    const { calls, fetchFn } = fakeFetch()
    await requestRecipeFilesBuild({ ...env(4), RECIPE_FILES_DEPLOY_HOOK: undefined }, fetchFn, NOW)
    expect(calls).toEqual([])
  })
})
