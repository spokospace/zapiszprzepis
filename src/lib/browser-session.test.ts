import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/menu-summary', () => ({ getMenuSummary: vi.fn() }))
vi.mock('@/lib/failed-shares', () => ({ getFailedShares: vi.fn() }))

import type { SupabaseClient } from '@supabase/supabase-js'
import { createSessionStore } from './browser-session'
import { getFailedShares, type FailedSharesResult } from '@/lib/failed-shares'
import { getMenuSummary } from '@/lib/menu-summary'

const MENU = { hasFullAccess: true, myRecipesCount: 2, favoritesCount: 3 }
const SHARES: FailedSharesResult = { status: 'ok', shares: [], unreadReady: 1 }

function setup() {
  const auth = { userId: null as string | null, error: null as { message: string; status?: number } | null, cookie: true }
  const getClient = vi.fn(async () => client)
  const client = {
    auth: {
      getSession: async () => ({
        data: { session: auth.userId ? { user: { id: auth.userId } } : null },
        error: auth.error,
      }),
    },
  } as unknown as SupabaseClient
  let time = 1_000_000
  const store = createSessionStore(
    getClient,
    () => auth.cookie,
    () => time,
  )
  return { auth, getClient, store, advance: (ms: number) => (time += ms) }
}

beforeEach(() => {
  vi.mocked(getMenuSummary).mockReset().mockResolvedValue(MENU)
  vi.mocked(getFailedShares).mockReset().mockResolvedValue(SHARES)
})

describe('createSessionStore', () => {
  it('starts unknown, on the server and in the browser, so the first paint matches', () => {
    const { store } = setup()
    expect(store.getServerSnapshot()).toEqual({ status: 'unknown' })
    expect(store.getSnapshot()).toEqual({ status: 'unknown' })
  })

  it('does not even download the Supabase client without a session cookie', async () => {
    const { auth, getClient, store } = setup()
    auth.cookie = false
    await store.sync()
    expect(store.getSnapshot()).toEqual({ status: 'guest' })
    expect(getClient).not.toHaveBeenCalled()
  })

  it('falls back to the guest header when the Supabase client cannot be downloaded', async () => {
    const { getClient, store } = setup()
    getClient.mockRejectedValueOnce(new Error('ChunkLoadError'))
    await expect(store.sync()).resolves.toBeUndefined()
    expect(store.getSnapshot()).toEqual({ status: 'guest' })
  })

  it('reads the session again on the next page after that fallback', async () => {
    const { auth, getClient, store } = setup()
    auth.userId = 'u1'
    getClient.mockRejectedValueOnce(new Error('ChunkLoadError'))
    await store.sync()
    await store.sync()
    expect(store.getSnapshot()).toMatchObject({ status: 'user', userId: 'u1' })
  })

  it('drops a session read that a sign-out overtook', async () => {
    const { auth, getClient, store } = setup()
    auth.userId = 'u1'
    let finish: (client: never) => void = () => {}
    const client = await getClient()
    getClient.mockReturnValueOnce(new Promise((resolve) => (finish = resolve as never)))
    const read = store.sync()
    store.clear()
    finish(client as never)
    await read
    expect(store.getSnapshot()).toEqual({ status: 'guest' })
    expect(getMenuSummary).not.toHaveBeenCalled()
  })

  it('signs the user out of the header when Supabase rejects the token', async () => {
    const { auth, store } = setup()
    auth.userId = 'u1'
    await store.sync()
    auth.userId = null
    auth.error = { message: 'refresh_token_not_found', status: 400 }
    await store.sync()
    expect(store.getSnapshot()).toEqual({ status: 'guest' })
  })

  it('becomes a guest without querying anything when there is no session', async () => {
    const { store } = setup()
    await store.sync()
    expect(store.getSnapshot()).toEqual({ status: 'guest' })
    expect(getMenuSummary).not.toHaveBeenCalled()
  })

  it('shows the user at once and the private data when it arrives', async () => {
    const { auth, store } = setup()
    auth.userId = 'u1'
    const seen: unknown[] = []
    store.subscribe(() => seen.push(store.getSnapshot()))
    await store.sync()
    expect(seen).toEqual([
      { status: 'user', userId: 'u1' },
      { status: 'user', userId: 'u1', menu: MENU, failedShares: SHARES },
    ])
  })

  it('skips the reload inside the refresh window, but not when forced or after it', async () => {
    const { auth, store, advance } = setup()
    auth.userId = 'u1'
    await store.sync()
    await store.sync()
    expect(getMenuSummary).toHaveBeenCalledTimes(1)
    await store.sync({ force: true })
    expect(getMenuSummary).toHaveBeenCalledTimes(2)
    advance(15_000)
    await store.sync()
    expect(getMenuSummary).toHaveBeenCalledTimes(3)
  })

  it('drops the previous user at once when the account changes', async () => {
    const { auth, store } = setup()
    auth.userId = 'u1'
    await store.sync()
    auth.userId = 'u2'
    const seen: unknown[] = []
    store.subscribe(() => seen.push(store.getSnapshot()))
    await store.sync()
    expect(seen[0]).toEqual({ status: 'user', userId: 'u2' })
  })

  it('never lets a slow load of the previous user overwrite the next one', async () => {
    const { auth, store } = setup()
    let finishFirst: (menu: typeof MENU) => void = () => {}
    vi.mocked(getMenuSummary).mockReturnValueOnce(new Promise((resolve) => (finishFirst = resolve)))
    auth.userId = 'u1'
    const first = store.sync()
    await vi.waitFor(() => expect(getMenuSummary).toHaveBeenCalledTimes(1))
    auth.userId = 'u2'
    await store.sync()
    finishFirst({ ...MENU, favoritesCount: 99 })
    await first
    expect(store.getSnapshot()).toEqual({ status: 'user', userId: 'u2', menu: MENU, failedShares: SHARES })
  })

  it('never lets a load finish after sign-out', async () => {
    const { auth, store } = setup()
    let finish: (menu: typeof MENU) => void = () => {}
    vi.mocked(getMenuSummary).mockReturnValueOnce(new Promise((resolve) => (finish = resolve)))
    auth.userId = 'u1'
    const load = store.sync()
    await vi.waitFor(() => expect(getMenuSummary).toHaveBeenCalledTimes(1))
    store.clear()
    finish(MENU)
    await load
    expect(store.getSnapshot()).toEqual({ status: 'guest' })
  })

  it('notices a sign-out done on the server', async () => {
    const { auth, store } = setup()
    auth.userId = 'u1'
    await store.sync()
    auth.userId = null
    await store.sync()
    expect(store.getSnapshot()).toEqual({ status: 'guest' })
  })

  it('keeps the user when a session refresh could not reach Supabase', async () => {
    const { auth, store } = setup()
    auth.userId = 'u1'
    await store.sync()
    auth.userId = null
    auth.error = { message: 'network' }
    await store.sync()
    expect(store.getSnapshot()).toMatchObject({ status: 'user', userId: 'u1' })
  })

  it('reports a failed check instead of a confident zero', async () => {
    const { auth, store } = setup()
    vi.mocked(getFailedShares).mockRejectedValue(new Error('boom'))
    vi.mocked(getMenuSummary).mockRejectedValue(new Error('boom'))
    auth.userId = 'u1'
    await store.sync()
    expect(store.getSnapshot()).toEqual({ status: 'user', userId: 'u1', menu: undefined, failedShares: { status: 'error' } })
  })

  it('stops telling a listener that unsubscribed', async () => {
    const { store } = setup()
    const listener = vi.fn()
    store.subscribe(listener)()
    await store.sync()
    expect(listener).not.toHaveBeenCalled()
  })
})
