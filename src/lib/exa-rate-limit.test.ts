import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
const getCloudflareContext = vi.fn()
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: () => getCloudflareContext() }))

import { exaSearchAllowed } from './exa-rate-limit'

describe('exaSearchAllowed', () => {
  beforeEach(() => vi.clearAllMocks())

  it('asks the binding, keyed by the user', async () => {
    const limit = vi.fn().mockResolvedValue({ success: false })
    getCloudflareContext.mockReturnValue({ env: { EXA_SEARCH_LIMIT: { limit } } })
    expect(await exaSearchAllowed('user-1')).toBe(false)
    expect(limit).toHaveBeenCalledWith({ key: 'user-1' })
  })

  it('allows the search under the cap', async () => {
    getCloudflareContext.mockReturnValue({ env: { EXA_SEARCH_LIMIT: { limit: vi.fn().mockResolvedValue({ success: true }) } } })
    expect(await exaSearchAllowed('user-1')).toBe(true)
  })

  it('fails open without the Workers runtime (next dev) or the binding', async () => {
    getCloudflareContext.mockImplementation(() => {
      throw new Error('no context')
    })
    expect(await exaSearchAllowed('user-1')).toBe(true)
    getCloudflareContext.mockReturnValue({ env: {} })
    expect(await exaSearchAllowed('user-1')).toBe(true)
  })

  it('fails open when the limiter itself errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    getCloudflareContext.mockReturnValue({ env: { EXA_SEARCH_LIMIT: { limit: vi.fn().mockRejectedValue(new Error('down')) } } })
    expect(await exaSearchAllowed('user-1')).toBe(true)
  })
})
