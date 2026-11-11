import { getCloudflareContext } from '@opennextjs/cloudflare'

// Speech-to-text for recipe videos (#767), on Workers AI. The Free plan gives
// 10,000 neurons a day and this model spends 46.63 per audio minute, so about
// 70 three-minute reels a day cost nothing. Checked 2026-11-11 against
// https://developers.cloudflare.com/workers-ai/platform/pricing/.

export const WHISPER_MODEL = '@cf/openai/whisper-large-v3-turbo'

/** The part of the Workers AI binding (`ai` in wrangler.jsonc) used here. */
export interface WorkersAiLike {
  run(model: string, input: Record<string, unknown>): Promise<unknown>
}

/** Transcribes an audio file; null when there is nothing usable. */
export type Transcribe = (audio: Uint8Array) => Promise<string | null>

/**
 * Transcribe `audio` (any container ffmpeg reads; Facebook's HE-AAC .mp4 works)
 * with Whisper. The language is detected by the model, since some sources are
 * foreign. Null on an empty result or any error; never throws, so a failed
 * transcription leaves the extraction as it was.
 */
export async function transcribeAudio(audio: Uint8Array, ai: WorkersAiLike): Promise<string | null> {
  try {
    const result = (await ai.run(WHISPER_MODEL, {
      // A view over the bytes, not a copy: the file is ~1 MB.
      audio: Buffer.from(audio.buffer, audio.byteOffset, audio.byteLength).toString('base64'),
      // Skips the music between spoken lines; without it Whisper tends to
      // fill the silence with invented text.
      vad_filter: true,
    })) as { text?: unknown }
    const text = typeof result?.text === 'string' ? result.text.trim() : ''
    return text || null
  } catch (err) {
    console.warn('[transcribe] Workers AI failed:', err)
    return null
  }
}

/** A Transcribe bound to the Worker's AI binding, or null where there is none
 *  (local dev without the binding, tests). */
export function workersAiTranscriber(): Transcribe | null {
  let ai: WorkersAiLike | undefined
  try {
    ai = (getCloudflareContext().env as unknown as { AI?: WorkersAiLike }).AI
  } catch {
    return null
  }
  if (!ai) {
    console.warn('[transcribe] no AI binding; Facebook videos keep their caption only')
    return null
  }
  return (audio) => transcribeAudio(audio, ai)
}
