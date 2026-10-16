import { describe, it, expect, vi } from 'vitest'
import { favoriteExistingRecipe } from './intake-favorite'

type Call = { table: string; method: string; args: unknown[] }

/** A client whose favorites insert answers `insertError`; records every call. */
function makeClient(insertError: { code: string; message: string } | null = null) {
  const calls: Call[] = []
  const from = (table: string) => {
    const chain: Record<string, unknown> = {}
    const record = (method: string, result?: unknown) => (...args: unknown[]) => {
      calls.push({ table, method, args })
      return result ?? chain
    }
    chain.insert = record('insert', Promise.resolve({ error: insertError }))
    chain.update = record('update')
    chain.eq = record('eq')
    chain.like = record('like')
    chain.then = (resolve: (v: unknown) => void) => resolve({ error: null })
    return chain
  }
  return { client: { from } as never, calls }
}

const URL_IN = 'https://example.com/tiramisu'

describe('favoriteExistingRecipe', () => {
  it('adds the favorite and settles the user’s failed shares of the link on it', async () => {
    const { client, calls } = makeClient()

    await favoriteExistingRecipe(client, 'user-1', 7, URL_IN)

    expect(calls).toContainEqual({ table: 'favorites', method: 'insert', args: [{ user_id: 'user-1', recipe_id: 7 }] })
    expect(calls).toContainEqual({ table: 'recipe_shares', method: 'update', args: [{ recipe_id: 7, status: 'completed' }] })
    expect(calls).toContainEqual({ table: 'recipe_shares', method: 'eq', args: ['user_id', 'user-1'] })
    expect(calls).toContainEqual({ table: 'recipe_shares', method: 'eq', args: ['status', 'failed'] })
    expect(calls).toContainEqual({ table: 'recipe_shares', method: 'eq', args: ['shared_url', URL_IN] })
  })

  it('treats an existing favorite as success', async () => {
    const { client } = makeClient({ code: '23505', message: 'duplicate key' })

    await expect(favoriteExistingRecipe(client, 'user-1', 7, URL_IN)).resolves.toBeUndefined()
  })

  it('fails loudly when the favorite cannot be saved', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { client } = makeClient({ code: '42501', message: 'permission denied' })

    await expect(favoriteExistingRecipe(client, 'user-1', 7, URL_IN)).rejects.toThrow('permission denied')
  })
})
