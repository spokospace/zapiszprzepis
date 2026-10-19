import { describe, it, expect, vi } from 'vitest'
import { COPIED_MESSAGE_MS, SHARE_MESSAGES, shareLink } from './share-button'

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

describe('ShareButton messages', () => {
  it('says what happened only for a copy or a failure, never for the share sheet', () => {
    expect(SHARE_MESSAGES.copied).toBe('Skopiowano link do przepisu.')
    expect(SHARE_MESSAGES.failed).toContain('Skopiuj adres z paska przeglądarki')
    expect(SHARE_MESSAGES.shared).toBeUndefined()
    expect(SHARE_MESSAGES.cancelled).toBeUndefined()
    // The copy confirmation fades like the favourite toast (~5 s).
    expect(COPIED_MESSAGE_MS).toBe(5000)
  })
})
