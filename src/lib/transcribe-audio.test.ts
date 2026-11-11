import { describe, it, expect, vi } from 'vitest'
import { transcribeAudio, WHISPER_MODEL } from '@/lib/transcribe-audio'

describe('transcribeAudio', () => {
  const AUDIO = new Uint8Array([104, 105])

  it('sends the audio base64-encoded to Whisper with voice detection on', async () => {
    const run = vi.fn(async () => ({ text: '  Pokrój ciasto na kwadraty.  ' }))
    await expect(transcribeAudio(AUDIO, { run })).resolves.toBe('Pokrój ciasto na kwadraty.')
    expect(run).toHaveBeenCalledWith(WHISPER_MODEL, { audio: 'aGk=', vad_filter: true })
  })

  it('is null for an empty transcription', async () => {
    await expect(transcribeAudio(AUDIO, { run: async () => ({ text: '   ' }) })).resolves.toBeNull()
    await expect(transcribeAudio(AUDIO, { run: async () => ({}) })).resolves.toBeNull()
  })

  it('is null, not a throw, when Workers AI fails', async () => {
    const run = vi.fn(async () => {
      throw new Error('4006: daily free allocation exceeded')
    })
    await expect(transcribeAudio(AUDIO, { run })).resolves.toBeNull()
  })
})
