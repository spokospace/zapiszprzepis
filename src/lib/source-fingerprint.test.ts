import { describe, expect, it } from 'vitest'
import { fingerprintText } from './source-fingerprint'

const CAPTION =
  'Wspaniałe, kruchutkie ciasteczka z maszynki!\n3 pełne szklanki mąki, 1 kostka masła, 2 żółtka, 3 łyżki kwaśnej śmietany, pół szklanki cukru pudru.'

describe('fingerprintText', () => {
  it('hashes a repost with other spacing, emoji, hashtags and links the same', async () => {
    const repost = `${CAPTION.toUpperCase().replace(/\n/g, '\n\n')} 🍪😋 #ciasteczka #wypieki https://example.com/x`
    expect(await fingerprintText(repost)).toBe(await fingerprintText(CAPTION))
  })

  it('tells apart texts that differ in a word', async () => {
    expect(await fingerprintText(CAPTION.replace('2 żółtka', '3 żółtka'))).not.toBe(await fingerprintText(CAPTION))
  })

  it('is a hex SHA-256', async () => {
    expect(await fingerprintText(CAPTION)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is null for a text too short to identify a recipe', async () => {
    expect(await fingerprintText('Pyszne ciasto! 😍 #wypieki')).toBeNull()
  })
})
