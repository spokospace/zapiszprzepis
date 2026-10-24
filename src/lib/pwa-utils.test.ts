import { describe, expect, it } from 'vitest'
import { clearPrivateCaches, serviceWorkerUrl } from './pwa-utils'

function cacheStorage(names: string[]) {
  const live = new Set(names)
  return {
    live,
    storage: {
      keys: async () => [...live],
      delete: async (name: string) => live.delete(name),
    } as unknown as CacheStorage,
  }
}

describe('clearPrivateCaches (sign-out, #373)', () => {
  it('drops page caches, including the legacy ones, and keeps the build files', async () => {
    const { live, storage } = cacheStorage([
      'zapiszprzepis-pages-abc', 'zapiszprzepis-runtime', 'zapiszprzepis-api',
      'zapiszprzepis-precache-v2', 'zapiszprzepis-static-abc', 'someone-else',
    ])
    await clearPrivateCaches(storage)
    expect([...live].sort()).toEqual(['someone-else', 'zapiszprzepis-static-abc'])
  })

  it('does nothing where Cache Storage is unavailable', async () => {
    await expect(clearPrivateCaches(undefined)).resolves.toBeUndefined()
  })

  it('never throws, so sign-out still goes ahead', async () => {
    const broken = { keys: async () => { throw new Error('SecurityError') } } as unknown as CacheStorage
    await expect(clearPrivateCaches(broken)).resolves.toBeUndefined()
  })
})

describe('serviceWorkerUrl', () => {
  it('carries the build version so each deploy gets fresh caches', () => {
    expect(serviceWorkerUrl('abc123')).toBe('/sw.js?v=abc123')
  })

  it('falls back to the bare URL without a version', () => {
    expect(serviceWorkerUrl('')).toBe('/sw.js')
  })
})
