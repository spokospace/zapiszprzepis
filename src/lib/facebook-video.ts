// The narration of a Facebook reel, as an audio file to transcribe (#767).
//
// Most recipe reels put only the ingredients in the caption and speak the
// method over the video. The caption is read elsewhere (`fetchFacebookPost`);
// this module finds the video's audio track so the extraction can transcribe it.
//
// A logged-out request for /watch/?v=<id> that looks like a browser navigation
// (`Accept: text/html`, `Sec-Fetch-Mode: navigate`) redirects to the video's
// page, /<page>/videos/<id>/, whose HTML carries the DASH manifest as a JSON
// string (`dash_manifest_xml_string`). Its `audio/mp4` representation is an
// audio-only HE-AAC file on fbcdn.net: about 1 MB for a three-minute reel.
// Without those two headers Facebook serves a shell page with no manifest.

import { BROWSER_UA } from '@/lib/public-fetch'
import { normalizeFacebookHost } from '@/lib/facebook'
import { decodeEntities } from '@/lib/html-entities'
import type { Transcribe } from '@/lib/transcribe-audio'

/** Longest video worth transcribing: recipe reels run 1–5 minutes, and every
 *  audio minute spends the free Workers AI allowance. */
export const MAX_AUDIO_SECONDS = 15 * 60
/** Cap on the audio download; 15 minutes at the 52 kbps Facebook serves is ~6 MB. */
export const MAX_AUDIO_BYTES = 12 * 1024 * 1024

const MANIFEST_KEY = '"dash_manifest_xml_string":"'

/** The numeric id of a Facebook video link (/reel/<id>, /watch?v=<id>,
 *  /<page>/videos/<id>), or null for any other link — a post, a photo, a share
 *  link that has not been resolved yet. */
export function facebookVideoId(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (normalizeFacebookHost(parsed.hostname) !== 'facebook.com') return null
    const path = parsed.pathname.match(/^\/(?:reel|[^/]+\/videos)\/(\d+)\/?$/)
    if (path) return path[1]
    if (/^\/watch\/?$/.test(parsed.pathname)) {
      const v = parsed.searchParams.get('v')
      return v && /^\d+$/.test(v) ? v : null
    }
    return null
  } catch {
    return null
  }
}

/** Seconds from an ISO 8601 duration such as "PT163.199997S" or "PT2M5S". */
function isoDurationSeconds(value: string): number | null {
  const m = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?$/)
  if (!m) return null
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)
}

/** The JSON string literal that starts at `start` (just past its opening quote),
 *  decoded, or null when it is cut off or malformed. */
function readJsonString(html: string, start: number): string | null {
  let i = start
  while (i < html.length) {
    const c = html.charCodeAt(i)
    if (c === 92 /* \ */) i += 2
    else if (c === 34 /* " */) break
    else i++
  }
  if (i >= html.length) return null
  try {
    return JSON.parse(html.slice(start - 1, i + 1)) as string
  } catch {
    return null
  }
}

export interface FacebookAudioTrack {
  url: string
  /** The video's length, from the manifest; null when it does not say. */
  durationSeconds: number | null
}

/**
 * The audio-only track of video `videoId` on its Facebook page, or null when
 * the page carries no manifest (a login wall, a removed video) or the manifest
 * has no audio. Finds the manifest with indexOf rather than parsing the ~1 MB
 * page: the Workers Free plan allows a few milliseconds of CPU per request.
 */
export function extractFacebookAudioTrack(html: string, videoId: string): FacebookAudioTrack | null {
  let fallback: string | null = null
  let manifest: string | null = null
  for (let at = html.indexOf(MANIFEST_KEY); at !== -1; at = html.indexOf(MANIFEST_KEY, at + 1)) {
    const xml = readJsonString(html, at + MANIFEST_KEY.length)
    if (!xml) continue
    // A page can embed other videos too (suggestions). The manifest that
    // belongs to this video is preceded by its id; the first one is the guess.
    const idAt = html.lastIndexOf(`"${videoId}"`, at)
    if (idAt !== -1 && at - idAt < 4000) {
      manifest = xml
      break
    }
    fallback ??= xml
  }
  manifest ??= fallback
  if (!manifest) return null

  // The audio representation's own <BaseURL> is the first one after its
  // mimeType: each Representation holds exactly one.
  const audioAt = manifest.indexOf('mimeType="audio/mp4"')
  if (audioAt === -1) return null
  const urlStart = manifest.indexOf('<BaseURL>', audioAt)
  const urlEnd = urlStart === -1 ? -1 : manifest.indexOf('</BaseURL>', urlStart)
  if (urlEnd === -1) return null
  const baseUrl = manifest.slice(urlStart + '<BaseURL>'.length, urlEnd)
  const url = decodeEntities(baseUrl)
  // Only ever download from Facebook's video CDN.
  if (!/^https:\/\/[a-z0-9.-]+\.fbcdn\.net\//i.test(url)) return null
  const duration = manifest.match(/mediaPresentationDuration="([^"]+)"/)?.[1]
  return { url, durationSeconds: duration ? isoDurationSeconds(duration) : null }
}

export interface FetchFacebookVideoAudioDeps {
  fetch: typeof globalThis.fetch
}

/**
 * Download the audio track of Facebook video `videoId`. Null when the page
 * has no manifest, the video is longer than MAX_AUDIO_SECONDS, the file is
 * larger than MAX_AUDIO_BYTES, or any request fails. Never throws.
 */
export async function fetchFacebookVideoAudio(
  videoId: string,
  { fetch }: FetchFacebookVideoAudioDeps = { fetch: globalThis.fetch },
): Promise<Uint8Array | null> {
  try {
    const page = await fetch(`https://www.facebook.com/watch/?v=${videoId}&_rdr`, {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pl,en;q=0.5',
        'Sec-Fetch-Mode': 'navigate',
      },
      signal: AbortSignal.timeout(15_000),
    })
    if (!page.ok) return null
    const track = extractFacebookAudioTrack(await page.text(), videoId)
    if (!track) return null
    if (track.durationSeconds != null && track.durationSeconds > MAX_AUDIO_SECONDS) return null

    const audio = await fetch(track.url, { signal: AbortSignal.timeout(30_000) })
    if (!audio.ok) return null
    if (Number(audio.headers.get('content-length') ?? 0) > MAX_AUDIO_BYTES) return null
    const bytes = new Uint8Array(await audio.arrayBuffer())
    return bytes.byteLength > 0 && bytes.byteLength <= MAX_AUDIO_BYTES ? bytes : null
  } catch {
    return null
  }
}

/** What Facebook video `videoId`'s narration says, or null when there is no
 *  audio to fetch or nothing was transcribed. Never throws. */
export async function transcribeFacebookVideo(
  videoId: string,
  transcribe: Transcribe,
  deps: FetchFacebookVideoAudioDeps = { fetch: globalThis.fetch },
): Promise<string | null> {
  const audio = await fetchFacebookVideoAudio(videoId, deps)
  return audio ? transcribe(audio) : null
}
