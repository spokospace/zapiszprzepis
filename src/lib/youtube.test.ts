import { describe, it, expect, vi } from 'vitest'
import {
  normalizeHost,
  isYoutubeHost,
  youtubeIdFromUrl,
  findEmbeddedYoutubeId,
  pickCaptionTrack,
  timedTextToPlain,
  fetchYoutubeTranscript,
} from '@/lib/youtube'

// Risk 5 — YouTube host detection and id extraction (S-04 stores youtube_id).
const ID = 'dQw4w9WgXcQ' // canonical 11-char id

describe('normalizeHost', () => {
  it('strips www. / m. / music. prefixes (one each, in order)', () => {
    expect(normalizeHost('www.youtube.com')).toBe('youtube.com')
    expect(normalizeHost('m.youtube.com')).toBe('youtube.com')
    expect(normalizeHost('music.youtube.com')).toBe('youtube.com')
    expect(normalizeHost('www.m.youtube.com')).toBe('youtube.com')
  })

  it('leaves other subdomains untouched', () => {
    expect(normalizeHost('gaming.youtube.com')).toBe('gaming.youtube.com')
  })
})

describe('isYoutubeHost', () => {
  it('accepts the canonical hosts and their www./m./music. forms', () => {
    expect(isYoutubeHost('youtube.com')).toBe(true)
    expect(isYoutubeHost('youtu.be')).toBe(true)
    expect(isYoutubeHost('youtube-nocookie.com')).toBe(true)
    expect(isYoutubeHost('m.youtube.com')).toBe(true)
  })

  it('FIX: accepts arbitrary subdomains of a YouTube host', () => {
    expect(isYoutubeHost('gaming.youtube.com')).toBe(true)
    expect(isYoutubeHost('studio.youtube.com')).toBe(true)
  })

  it('rejects non-YouTube and look-alike hosts', () => {
    expect(isYoutubeHost('vimeo.com')).toBe(false)
    expect(isYoutubeHost('notyoutube.com')).toBe(false)
    expect(isYoutubeHost('youtube.com.evil.com')).toBe(false)
  })
})

describe('youtubeIdFromUrl', () => {
  it('extracts the id from every supported direct-URL shape', () => {
    expect(youtubeIdFromUrl(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID)
    expect(youtubeIdFromUrl(`https://youtu.be/${ID}?si=abc`)).toBe(ID)
    expect(youtubeIdFromUrl(`https://www.youtube.com/shorts/${ID}`)).toBe(ID)
    expect(youtubeIdFromUrl(`https://www.youtube.com/embed/${ID}`)).toBe(ID)
    expect(youtubeIdFromUrl(`https://www.youtube.com/live/${ID}`)).toBe(ID)
    expect(youtubeIdFromUrl(`https://m.youtube.com/watch?v=${ID}&t=30s`)).toBe(ID)
  })

  it('FIX: extracts the id from a non-www subdomain', () => {
    expect(youtubeIdFromUrl(`https://gaming.youtube.com/watch?v=${ID}`)).toBe(ID)
  })

  it('returns null for unsupported shapes and non-YouTube hosts', () => {
    expect(youtubeIdFromUrl(`https://www.youtube.com/v/${ID}`)).toBeNull() // /v/ not handled here
    expect(youtubeIdFromUrl('https://www.youtube.com/playlist?list=PLabc')).toBeNull()
    expect(youtubeIdFromUrl('https://www.youtube.com/watch?v=tooShort')).toBeNull()
    expect(youtubeIdFromUrl('https://vimeo.com/123456')).toBeNull()
    expect(youtubeIdFromUrl('not a url')).toBeNull()
  })
})

describe('findEmbeddedYoutubeId', () => {
  it('finds the first embed id in arbitrary HTML', () => {
    expect(findEmbeddedYoutubeId(`<iframe src="https://www.youtube.com/embed/${ID}"></iframe>`)).toBe(ID)
    expect(findEmbeddedYoutubeId(`<iframe src="https://www.youtube-nocookie.com/embed/${ID}"></iframe>`)).toBe(ID)
    expect(findEmbeddedYoutubeId(`<a href="https://youtu.be/${ID}">link</a>`)).toBe(ID)
    expect(findEmbeddedYoutubeId(`watch here: https://www.youtube.com/watch?v=${ID} thanks`)).toBe(ID)
  })

  it('returns null for empty HTML and pages with no embed', () => {
    expect(findEmbeddedYoutubeId('')).toBeNull()
    expect(findEmbeddedYoutubeId('<p>no video here</p>')).toBeNull()
  })

  it('ASYMMETRY: /v/<id> is found here but not by youtubeIdFromUrl', () => {
    const vForm = `<iframe src="https://www.youtube.com/v/${ID}"></iframe>`
    expect(findEmbeddedYoutubeId(vForm)).toBe(ID)
    expect(youtubeIdFromUrl(`https://www.youtube.com/v/${ID}`)).toBeNull()
  })
})

// Transcript fallback: captions read through the Innertube ANDROID player.
describe('pickCaptionTrack', () => {
  const pl = { baseUrl: 'pl', languageCode: 'pl' }
  const plAuto = { baseUrl: 'pl-asr', languageCode: 'pl', kind: 'asr' }
  const en = { baseUrl: 'en', languageCode: 'en' }
  const enAuto = { baseUrl: 'en-asr', languageCode: 'en', kind: 'asr' }

  it('prefers author-made Polish, then auto Polish, then any author-made, then anything', () => {
    expect(pickCaptionTrack([enAuto, plAuto, pl, en])).toBe(pl)
    expect(pickCaptionTrack([enAuto, en, plAuto])).toBe(plAuto)
    expect(pickCaptionTrack([enAuto, en])).toBe(en)
    expect(pickCaptionTrack([enAuto])).toBe(enAuto)
  })

  it('matches regional Polish codes', () => {
    const plPL = { baseUrl: 'x', languageCode: 'pl-PL', kind: 'asr' }
    expect(pickCaptionTrack([en, plPL])).toBe(plPL)
  })

  it('returns null with no tracks', () => {
    expect(pickCaptionTrack([])).toBeNull()
  })
})

describe('timedTextToPlain', () => {
  it('joins paragraphs, strips word spans and decodes entities', () => {
    const xml =
      '<?xml version="1.0" encoding="utf-8" ?><timedtext format="3"><body>' +
      '<p t="0" d="1000"><s>Witajcie</s><s> na</s> kanale</p>\n' +
      '<p t="1000" d="1000">3 jajka &amp; &quot;pecorino&quot; &#39;romano&#39;</p>' +
      '</body></timedtext>'
    expect(timedTextToPlain(xml)).toBe('Witajcie na kanale 3 jajka & "pecorino" \'romano\'')
  })

  it('returns an empty string for XML without cues', () => {
    expect(timedTextToPlain('<timedtext format="3"><body></body></timedtext>')).toBe('')
  })
})

describe('fetchYoutubeTranscript', () => {
  const CAPTION_XML =
    '<timedtext format="3"><body><p t="0" d="1">Wrzucam guanciale</p><p t="1" d="1">na patelnię</p></body></timedtext>'

  function makeFetch({
    tracks = [{ baseUrl: 'https://www.youtube.com/api/timedtext?v=x&lang=pl', languageCode: 'pl', kind: 'asr' }],
    playability = 'OK',
    reason = '',
    playerOk = true,
    captionOk = true,
    captionBody = CAPTION_XML,
  }: {
    tracks?: Array<{ baseUrl: string; languageCode: string; kind?: string }>
    playability?: string
    reason?: string
    playerOk?: boolean
    captionOk?: boolean
    captionBody?: string
  } = {}) {
    return vi.fn().mockImplementation((url: string) => {
      if (url.includes('/youtubei/v1/player')) {
        return Promise.resolve({
          ok: playerOk,
          status: playerOk ? 200 : 500,
          json: async () => ({
            playabilityStatus: { status: playability, reason },
            captions: { playerCaptionsTracklistRenderer: { captionTracks: tracks } },
          }),
        })
      }
      if (url.includes('/api/timedtext')) {
        return Promise.resolve({ ok: captionOk, status: captionOk ? 200 : 403, text: async () => captionBody })
      }
      return Promise.reject(new Error(`Unexpected fetch URL: ${url}`))
    })
  }

  it('asks the ANDROID player for the video and returns the caption text', async () => {
    const fetch = makeFetch()
    await expect(fetchYoutubeTranscript(ID, { fetch })).resolves.toBe('Wrzucam guanciale na patelnię')

    const [playerUrl, playerInit] = fetch.mock.calls[0]
    expect(playerUrl).toContain('/youtubei/v1/player')
    const body = JSON.parse(playerInit.body)
    expect(body.videoId).toBe(ID)
    expect(body.context.client.clientName).toBe('ANDROID')
  })

  it('returns null when the video has no caption tracks', async () => {
    await expect(fetchYoutubeTranscript(ID, { fetch: makeFetch({ tracks: [] }) })).resolves.toBeNull()
  })

  it('returns null without fetching captions when the video is not playable (bot wall)', async () => {
    const fetch = makeFetch({ playability: 'LOGIN_REQUIRED', reason: 'Sign in to confirm you’re not a bot' })
    await expect(fetchYoutubeTranscript(ID, { fetch })).resolves.toBeNull()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('returns null on a failed request or an empty caption body — never throws', async () => {
    await expect(fetchYoutubeTranscript(ID, { fetch: makeFetch({ playerOk: false }) })).resolves.toBeNull()
    await expect(fetchYoutubeTranscript(ID, { fetch: makeFetch({ captionOk: false }) })).resolves.toBeNull()
    await expect(fetchYoutubeTranscript(ID, { fetch: makeFetch({ captionBody: '' }) })).resolves.toBeNull()
    const throwing = vi.fn().mockRejectedValue(new Error('network down'))
    await expect(fetchYoutubeTranscript(ID, { fetch: throwing })).resolves.toBeNull()
  })
})
