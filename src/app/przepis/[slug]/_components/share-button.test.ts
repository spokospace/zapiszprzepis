import { describe, it, expect, vi } from 'vitest'
import { shareLink } from './share-button'

const DATA = { title: 'Zupa krem z dyni', url: 'https://zapiszprzepis.pl/przepis/zupa-krem-z-dyni' }

function abortError(): Error {
  const err = new Error('Share canceled')
  err.name = 'AbortError'
  return err
}

describe('shareLink (A9 "Udostępnij")', () => {
  it('uses the share sheet when the browser has one', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const writeText = vi.fn()
    await expect(shareLink({ share, clipboard: { writeText } }, DATA)).resolves.toBe('shared')
    expect(share).toHaveBeenCalledWith(DATA)
    expect(writeText).not.toHaveBeenCalled()
  })

  it('treats a closed share sheet as a choice, not an error', async () => {
    const writeText = vi.fn()
    const share = vi.fn().mockRejectedValue(abortError())
    await expect(shareLink({ share, clipboard: { writeText } }, DATA)).resolves.toBe('cancelled')
    expect(writeText).not.toHaveBeenCalled()
  })

  it('copies the link when the share sheet is refused', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const share = vi.fn().mockRejectedValue(new DOMException('Not allowed', 'NotAllowedError'))
    await expect(shareLink({ share, clipboard: { writeText } }, DATA)).resolves.toBe('copied')
    expect(writeText).toHaveBeenCalledWith(DATA.url)
  })

  it('copies the link where there is no share sheet (most desktops)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    await expect(shareLink({ clipboard: { writeText } }, DATA)).resolves.toBe('copied')
  })

  it('reports a failure instead of doing nothing', async () => {
    await expect(shareLink({}, DATA)).resolves.toBe('failed')
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    await expect(shareLink({ clipboard: { writeText } }, DATA)).resolves.toBe('failed')
  })
})
