import { describe, it, expect, vi, beforeEach } from 'vitest'

const primary = vi.hoisted(() => ({ send: vi.fn() }))
const secondary = vi.hoisted(() => ({ send: vi.fn() }))
const getSecondary = vi.hoisted(() => vi.fn())

vi.mock('./client', () => ({
  inngest: primary,
  getInngestSecondary: getSecondary,
}))

import { sendRecipeExtract } from './send'

const data = { shareId: 1, sharedUrl: 'https://example.com/x', userId: 'user-1', sourceType: 'web_blog' }

describe('sendRecipeExtract — failover to the secondary Inngest account (#580)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    getSecondary.mockReturnValue(secondary)
  })

  it('sends to the primary and never touches the secondary when the primary accepts', async () => {
    primary.send.mockResolvedValue({ ids: ['e1'] })

    await sendRecipeExtract(data)

    expect(primary.send).toHaveBeenCalledWith({ name: 'recipe/extract', data })
    expect(secondary.send).not.toHaveBeenCalled()
  })

  it('sends the same event to the secondary when the primary refuses it', async () => {
    primary.send.mockRejectedValue(new Error('queue down'))
    secondary.send.mockResolvedValue({ ids: ['e2'] })

    await sendRecipeExtract(data)

    expect(primary.send).toHaveBeenCalledTimes(1)
    expect(secondary.send).toHaveBeenCalledWith({ name: 'recipe/extract', data })
  })

  it('rethrows the primary error when no secondary account is configured', async () => {
    const error = new Error('queue down')
    primary.send.mockRejectedValue(error)
    getSecondary.mockReturnValue(null)

    await expect(sendRecipeExtract(data)).rejects.toBe(error)
  })

  it('throws when both accounts refuse the event, so the caller marks the share failed', async () => {
    primary.send.mockRejectedValue(new Error('primary down'))
    secondary.send.mockRejectedValue(new Error('secondary down'))

    await expect(sendRecipeExtract(data)).rejects.toThrow('secondary down')
  })
})
