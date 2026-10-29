import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
const getCloudflareContext = vi.fn()
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: () => getCloudflareContext() }))

import { extractionAllowed } from './extraction-rate-limit'

describe('extractionAllowed', () => {
  beforeEach(() => vi.clearAllMocks())

  it('asks the extraction binding, keyed by the user, and refuses over the cap', async () => {
    const limit = vi.fn().mockResolvedValue({ success: false })
    const exa = vi.fn().mockResolvedValue({ success: true })
    getCloudflareContext.mockReturnValue({ env: { EXTRACTION_LIMIT: { limit }, EXA_SEARCH_LIMIT: { limit: exa } } })
    expect(await extractionAllowed('user-1')).toBe(false)
    expect(limit).toHaveBeenCalledWith({ key: 'user-1' })
    expect(exa).not.toHaveBeenCalled()
  })

  it('allows the extraction under the cap', async () => {
    getCloudflareContext.mockReturnValue({ env: { EXTRACTION_LIMIT: { limit: vi.fn().mockResolvedValue({ success: true }) } } })
    expect(await extractionAllowed('user-1')).toBe(true)
  })

  it('fails open without the Workers runtime (next dev) or the binding', async () => {
    getCloudflareContext.mockImplementation(() => {
      throw new Error('no context')
    })
    expect(await extractionAllowed('user-1')).toBe(true)
    getCloudflareContext.mockReturnValue({ env: {} })
    expect(await extractionAllowed('user-1')).toBe(true)
  })

  it('fails open when the limiter itself errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    getCloudflareContext.mockReturnValue({ env: { EXTRACTION_LIMIT: { limit: vi.fn().mockRejectedValue(new Error('down')) } } })
    expect(await extractionAllowed('user-1')).toBe(true)
  })
})
