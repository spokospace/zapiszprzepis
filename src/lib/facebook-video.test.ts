import { describe, it, expect, vi } from 'vitest'
import {
  facebookVideoId,
  extractFacebookAudioTrack,
  fetchFacebookVideoAudio,
  MAX_AUDIO_BYTES,
} from '@/lib/facebook-video'

const AUDIO_URL = 'https://video-waw2-2.xx.fbcdn.net/o1/v/t2/f2/m412/AQN.mp4?_nc_cat=102&_nc_sid=9ca052'

function manifest(audioUrl = AUDIO_URL, duration = 'PT163.199997S') {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" mediaPresentationDuration="${duration}"><Period>` +
    `<AdaptationSet segmentAlignment="true"><Representation id="1v" codecs="av01.0.05M.08" mimeType="video/mp4">` +
    `<BaseURL>https://video-waw2-1.xx.fbcdn.net/video.mp4?a=1&amp;b=2</BaseURL></Representation></AdaptationSet>` +
    `<AdaptationSet contentType="audio"><Representation id="1a" codecs="mp4a.40.5" mimeType="audio/mp4">` +
    `<BaseURL>${audioUrl.replace(/&/g, '&amp;')}</BaseURL></Representation></AdaptationSet></Period></MPD>\n`
  )
}

/** The manifest as Facebook embeds it: a JSON string with `<` and `/` escaped. */
function pageWith(...videos: { id: string; xml: string }[]) {
  const json = (xml: string) => JSON.stringify(xml).replace(/</g, '\\u003C').replace(/\//g, '\\/')
  return (
    '<html><body>' +
    videos
      .map(
        ({ id, xml }) =>
          `<script type="application/json" data-sjs>{"video":{"id":"${id}","videoDeliveryLegacyFields":{"dash_manifest_xml_string":${json(xml)},"dash_manifest_url":"x"}}}</script>`,
      )
      .join('') +
    '</body></html>'
  )
}

describe('facebookVideoId', () => {
  it.each([
    ['https://www.facebook.com/reel/1804457920964851', '1804457920964851'],
    ['https://www.facebook.com/reel/1804457920964851/', '1804457920964851'],
    ['https://www.facebook.com/watch?v=1381816580229910', '1381816580229910'],
    ['https://m.facebook.com/watch/?v=1381816580229910&_rdr', '1381816580229910'],
    ['https://www.facebook.com/appetizingtv/videos/2021676914859528', '2021676914859528'],
    ['https://www.facebook.com/Smaczny1/videos/1804457920964851/', '1804457920964851'],
  ])('reads the id of %s', (url, id) => {
    expect(facebookVideoId(url)).toBe(id)
  })

  it.each([
    'https://www.facebook.com/SavoryDailyRecipes/posts/pfbid031sm6myU7xRVoY5bCYd5Bj3NF5HARUmzRiMworYv8mbVzrsgxdBx8sZYw5AeNEQrel',
    'https://www.facebook.com/share/r/1B4yZLSPVp/',
    'https://www.facebook.com/watch/',
    'https://www.facebook.com/watch?v=abc',
    'https://www.youtube.com/watch?v=1381816580229910',
    'not a url',
  ])('is null for %s', (url) => {
    expect(facebookVideoId(url)).toBeNull()
  })
})

describe('extractFacebookAudioTrack', () => {
  it('returns the audio-only track and the length from the manifest', () => {
    expect(extractFacebookAudioTrack(pageWith({ id: '42', xml: manifest() }), '42')).toEqual({
      url: AUDIO_URL,
      durationSeconds: 163.199997,
    })
  })

  it('takes the manifest of the requested video, not a suggested one before it', () => {
    const other = manifest('https://video.xx.fbcdn.net/other.mp4')
    const page = pageWith({ id: '7', xml: other }, { id: '42', xml: manifest() })
    expect(extractFacebookAudioTrack(page, '42')?.url).toBe(AUDIO_URL)
  })

  it('falls back to the first manifest when none names the video', () => {
    expect(extractFacebookAudioTrack(pageWith({ id: '7', xml: manifest() }), '42')?.url).toBe(AUDIO_URL)
  })

  it('reads minutes and hours in the duration', () => {
    expect(extractFacebookAudioTrack(pageWith({ id: '42', xml: manifest(AUDIO_URL, 'PT1H2M5S') }), '42')?.durationSeconds).toBe(3725)
  })

  it('is null for a page without a manifest (the shell a non-navigation request gets)', () => {
    expect(extractFacebookAudioTrack('<html><body>Zaloguj się</body></html>', '42')).toBeNull()
  })

  it('is null when the manifest has no audio track', () => {
    const videoOnly = manifest().replace(/<AdaptationSet contentType="audio">[\s\S]*?<\/AdaptationSet>/, '')
    expect(extractFacebookAudioTrack(pageWith({ id: '42', xml: videoOnly }), '42')).toBeNull()
  })

  it('never hands back a URL off Facebook’s video CDN', () => {
    expect(extractFacebookAudioTrack(pageWith({ id: '42', xml: manifest('https://evil.example/a.mp4') }), '42')).toBeNull()
    expect(extractFacebookAudioTrack(pageWith({ id: '42', xml: manifest('http://video.xx.fbcdn.net/a.mp4') }), '42')).toBeNull()
  })

  it('is null for a manifest string cut off before its closing quote', () => {
    expect(extractFacebookAudioTrack('{"dash_manifest_xml_string":"\\u003CMPD', '42')).toBeNull()
  })
})

describe('fetchFacebookVideoAudio', () => {
  const AUDIO = new Uint8Array([1, 2, 3, 4])

  function mockFetch({
    page = pageWith({ id: '42', xml: manifest() }),
    pageOk = true,
    audio = AUDIO,
    audioOk = true,
    contentLength,
    finalUrl,
  }: {
    page?: string
    pageOk?: boolean
    audio?: Uint8Array
    audioOk?: boolean
    contentLength?: number
    /** Where the audio request ended up after redirects. */
    finalUrl?: string
  } = {}) {
    return vi.fn(async (url: string) => {
      if (url.startsWith('https://www.facebook.com/watch/')) {
        return { ok: pageOk, text: async () => page } as Response
      }
      const response = new Response(audio as Uint8Array<ArrayBuffer>, {
        status: audioOk ? 200 : 500,
        headers: contentLength != null ? { 'content-length': String(contentLength) } : {},
      })
      if (finalUrl) Object.defineProperty(response, 'url', { value: finalUrl })
      return response
    }) as unknown as typeof globalThis.fetch & ReturnType<typeof vi.fn>
  }

  it('asks for the watch page as a browser navigation, then downloads the audio track', async () => {
    const fetch = mockFetch()
    await expect(fetchFacebookVideoAudio('42', { fetch })).resolves.toEqual(AUDIO)

    const [pageUrl, init] = fetch.mock.calls[0] as [string, RequestInit]
    expect(pageUrl).toBe('https://www.facebook.com/watch/?v=42&_rdr')
    const headers = init.headers as Record<string, string>
    expect(headers.Accept).toMatch(/^text\/html/)
    expect(headers['Sec-Fetch-Mode']).toBe('navigate')
    expect(fetch.mock.calls[1][0]).toBe(AUDIO_URL)
  })

  it('skips a video longer than the transcription budget without downloading it', async () => {
    const fetch = mockFetch({ page: pageWith({ id: '42', xml: manifest(AUDIO_URL, 'PT20M') }) })
    await expect(fetchFacebookVideoAudio('42', { fetch })).resolves.toBeNull()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('refuses an audio file announced as too large', async () => {
    await expect(fetchFacebookVideoAudio('42', { fetch: mockFetch({ contentLength: MAX_AUDIO_BYTES + 1 }) })).resolves.toBeNull()
  })

  it('stops reading a body without content-length once it passes the cap', async () => {
    const big = new Uint8Array(MAX_AUDIO_BYTES + 1)
    await expect(fetchFacebookVideoAudio('42', { fetch: mockFetch({ audio: big }) })).resolves.toBeNull()
  })

  it('refuses audio a redirect took off Facebook’s CDN', async () => {
    const fetch = mockFetch({ finalUrl: 'https://evil.example/a.mp4' })
    await expect(fetchFacebookVideoAudio('42', { fetch })).resolves.toBeNull()
    await expect(
      fetchFacebookVideoAudio('42', { fetch: mockFetch({ finalUrl: 'https://video-waw2-1.xx.fbcdn.net/b.mp4' }) }),
    ).resolves.toEqual(AUDIO)
  })

  it('is null when the page or the audio request fails', async () => {
    await expect(fetchFacebookVideoAudio('42', { fetch: mockFetch({ pageOk: false }) })).resolves.toBeNull()
    await expect(fetchFacebookVideoAudio('42', { fetch: mockFetch({ audioOk: false }) })).resolves.toBeNull()
    await expect(fetchFacebookVideoAudio('42', { fetch: mockFetch({ audio: new Uint8Array() }) })).resolves.toBeNull()
  })

  it('never throws on a network error', async () => {
    const fetch = vi.fn(async () => {
      throw new Error('network down')
    }) as unknown as typeof globalThis.fetch
    await expect(fetchFacebookVideoAudio('42', { fetch })).resolves.toBeNull()
  })
})
