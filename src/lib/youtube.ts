// YouTube video id helpers for S-04.
//
// Two entry points feed `recipes.youtube_id`:
//   - youtubeIdFromUrl: the shared URL itself is a YouTube link
//     (source_type = 'youtube').
//   - findEmbeddedYoutubeId: a scraped blog page (source_type = 'web_blog')
//     embeds a YouTube player; we pull the id out of the page HTML.

import { decodeEntities } from '@/lib/html-entities'

// A YouTube video id is exactly 11 chars from this alphabet.
const ID = '[A-Za-z0-9_-]{11}'
const ID_RE = new RegExp(`^${ID}$`)

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
])

/** Strip the www./m./music. subdomain so host comparisons are uniform.
 *  Shared with detect-source-type.ts so the host knowledge lives in one place. */
export function normalizeHost(host: string): string {
  return host.replace(/^www\./, '').replace(/^m\./, '').replace(/^music\./, '')
}

export function isYoutubeHost(host: string): boolean {
  // Accept any subdomain of a known YouTube host (gaming./studio./tv.youtube.com,
  // …), not just www./m./music. — otherwise those links misroute to web_blog.
  const h = normalizeHost(host)
  for (const base of YOUTUBE_HOSTS) {
    if (h === base || h.endsWith(`.${base}`)) return true
  }
  return false
}

/**
 * Extract the 11-char video id from a direct YouTube URL.
 * Handles watch?v=, youtu.be/, /shorts/, /embed/, /live/. Returns null for
 * non-YouTube URLs or anything that doesn't yield a valid id.
 */
export function youtubeIdFromUrl(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  const host = normalizeHost(parsed.hostname)
  if (!isYoutubeHost(host)) return null

  // youtu.be/<id>
  if (host === 'youtu.be') {
    const id = parsed.pathname.split('/').filter(Boolean)[0]
    return id && ID_RE.test(id) ? id : null
  }

  // youtube.com/watch?v=<id>
  const v = parsed.searchParams.get('v')
  if (v && ID_RE.test(v)) return v

  // youtube.com/{shorts,embed,live}/<id>
  const segments = parsed.pathname.split('/').filter(Boolean)
  if (segments.length >= 2 && ['shorts', 'embed', 'live'].includes(segments[0])) {
    const id = segments[1]
    return ID_RE.test(id) ? id : null
  }

  return null
}

// Match any YouTube link inside arbitrary HTML — iframe src, anchor href, or
// bare text. Covers embed/, youtu.be/, watch?v=, shorts/, live/.
const EMBED_RE = new RegExp(
  `(?:youtube(?:-nocookie)?\\.com/(?:embed|shorts|live|v)/(${ID}))` +
    `|(?:youtu\\.be/(${ID}))` +
    `|(?:youtube(?:-nocookie)?\\.com/watch\\?[^"'\\s]*v=(${ID}))`,
  'i',
)

/**
 * Find the first embedded YouTube video id in a page's HTML. Used when a blog
 * post (web_blog) embeds a player. Returns null when no embed is present.
 */
export function findEmbeddedYoutubeId(html: string): string | null {
  if (!html) return null
  const match = EMBED_RE.exec(html)
  if (!match) return null
  const id = match[1] || match[2] || match[3]
  return id && ID_RE.test(id) ? id : null
}

// ---------------------------------------------------------------------------
// Transcript (auto-captions) — the second-pass source for a YouTube recipe.
//
// Cooking channels usually paste the recipe into the description, so that is
// what the LLM sees first (via Firecrawl). When the description carries no
// recipe, the spoken video is the only text left, and YouTube's own captions
// are the cheapest way to get it: two plain fetches, no yt-dlp / Whisper, so
// it runs inside the Worker.
//
// Which route works changes every few months. Verified 2026-09-17:
//   - the timedtext URL from the watch page (WEB client) answers 200 with an
//     empty body — since 2025 it wants a proof-of-origin `pot` token;
//   - youtubei/v1/get_transcript answers 400 FAILED_PRECONDITION even with the
//     watch page's own params;
//   - youtubei/v1/player as the ANDROID client hands out caption URLs that
//     still work without a token or cookies. That is the one used here.
// Treat any failure as "no transcript" — the caller falls back to whatever
// the description gave it.

const INNERTUBE_PLAYER_URL = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false'
const ANDROID_CLIENT_VERSION = '20.10.38'
const ANDROID_UA = `com.google.android.youtube/${ANDROID_CLIENT_VERSION} (Linux; U; Android 11) gzip`

interface CaptionTrack {
  baseUrl: string
  languageCode: string
  /** 'asr' for auto-generated captions; absent for author-uploaded ones. */
  kind?: string
}

export interface FetchYoutubeTranscriptDeps {
  fetch: typeof globalThis.fetch
}

/**
 * Pick the track to read: Polish first (author-made over auto-generated), then
 * whatever the video has. Recipes are read from a Polish-speaking audience's
 * videos most of the time, and the LLM translates the rest anyway.
 */
export function pickCaptionTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  if (tracks.length === 0) return null
  const isPolish = (t: CaptionTrack) => t.languageCode.toLowerCase().startsWith('pl')
  return (
    tracks.find((t) => isPolish(t) && t.kind !== 'asr') ??
    tracks.find(isPolish) ??
    tracks.find((t) => t.kind !== 'asr') ??
    tracks[0]
  )
}

/**
 * Flatten YouTube's `format="3"` timedtext XML (`<p t=... d=...>text</p>`,
 * with optional `<s>` word spans) to one line of plain text. Timing is
 * dropped — the extractor wants prose, not cues.
 */
export function timedTextToPlain(xml: string): string {
  const paragraphs = [...xml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map((m) =>
    decodeEntities(m[1].replace(/<[^>]+>/g, '')),
  )
  return paragraphs.join(' ').replace(/\s+/g, ' ').trim()
}

/**
 * Fetch the video's captions as plain text. Returns null when the video has
 * no caption track (author disabled them, or YouTube hasn't generated any
 * yet) or when either request fails — the caller has to do without.
 */
export async function fetchYoutubeTranscript(
  videoId: string,
  { fetch }: FetchYoutubeTranscriptDeps = { fetch: globalThis.fetch },
): Promise<string | null> {
  try {
    const playerResponse = await fetch(INNERTUBE_PLAYER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': ANDROID_UA,
        'X-YouTube-Client-Name': '3',
        'X-YouTube-Client-Version': ANDROID_CLIENT_VERSION,
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'ANDROID',
            clientVersion: ANDROID_CLIENT_VERSION,
            androidSdkVersion: 30,
            osName: 'Android',
            osVersion: '11',
            hl: 'pl',
            gl: 'PL',
          },
        },
        videoId,
        contentCheckOk: true,
        racyCheckOk: true,
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!playerResponse.ok) {
      console.warn('[youtube] player request failed:', playerResponse.status)
      return null
    }
    const player = await playerResponse.json()
    const status = player?.playabilityStatus?.status
    if (status && status !== 'OK') {
      // LOGIN_REQUIRED is the "confirm you're not a bot" wall on datacenter
      // IPs; log the reason so it shows up if the Worker starts hitting it.
      console.warn('[youtube] video not playable:', status, player.playabilityStatus?.reason ?? '')
      return null
    }
    const tracks: CaptionTrack[] =
      player?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []
    const track = pickCaptionTrack(tracks)
    if (!track?.baseUrl) return null

    const captionResponse = await fetch(track.baseUrl, {
      headers: { 'User-Agent': ANDROID_UA },
      signal: AbortSignal.timeout(15_000),
    })
    if (!captionResponse.ok) {
      console.warn('[youtube] caption request failed:', captionResponse.status)
      return null
    }
    const text = timedTextToPlain(await captionResponse.text())
    return text.length > 0 ? text : null
  } catch (error) {
    console.warn('[youtube] transcript fetch failed:', error)
    return null
  }
}
