import { describe, it, expect, vi } from 'vitest'
import {
  buildFacebookPluginUrl,
  extractOgTag,
  extractPluginCaption,
  fetchFacebookPost,
  isFacebookShareUrl,
  isFacebookUrl,
} from '@/lib/facebook'

// Mirrors the real plugins/video.php markup: the caption lives in a
// data-testid="post_message" div, emoji are <span>-wrapped images, lines are
// <br />-separated, and the tail past "See more" sits in a text_exposed_show
// sibling with a text_exposed_hide "..." placeholder in front of it.
const PLUGIN_HTML = `<html><head>
<meta property="og:image" content="https://scontent.xx.fbcdn.net/v/t15/793139775_455.jpg?oh=00_AQ&amp;oe=6AA2F75A" />
<meta property="og:url" content="https://www.facebook.com/100043061508341/videos/zrobisz-pyszny-obiad-czy-kolacj%C4%99-w-28-i-p%C3%B3%C5%82-minuty/943809852095733/" />
</head><body>
<div class="_4i-s"><div data-testid="post_message" class="_5pbx userContent" data-ft="&#123;&quot;tn&quot;:&quot;K&quot;&#125;">
<div id="id_6a9d" class="text_exposed_root"><p>Zrobisz pyszny obiad w 28 minut<span class="_5mfr"><span class="_6qdm">&#9786;&#65039;</span></span><br />
SKŁADNIKI:<br />
250g twarogu półtłustego,<span class="text_exposed_hide">...</span><span class="text_exposed_show"><br />
3 łyżki mąki pszennej,<br />
PRZYGOTOWANIE:<br />
pieczemy w 200 stopniach przez 20 minut,<br />
#obiad #przepis</span></p></div>
</div><div class="_39k5">Komentarze</div></div>
</body></html>`

describe('isFacebookUrl', () => {
  it('accepts facebook hosts and their subdomains', () => {
    expect(isFacebookUrl('https://www.facebook.com/reel/943809852095733/')).toBe(true)
    expect(isFacebookUrl('https://m.facebook.com/reel/1/')).toBe(true)
    expect(isFacebookUrl('https://fb.watch/abc123/')).toBe(true)
    expect(isFacebookUrl('https://fb.me/abc')).toBe(true)
  })

  it('rejects other hosts and malformed URLs', () => {
    expect(isFacebookUrl('https://www.mecooks.com/przepis')).toBe(false)
    expect(isFacebookUrl('https://facebook.com.evil.example/reel/1/')).toBe(false)
    expect(isFacebookUrl('not a url')).toBe(false)
  })
})

describe('isFacebookShareUrl', () => {
  it('recognises the app share-sheet shapes', () => {
    expect(isFacebookShareUrl('https://www.facebook.com/share/r/1B4yZLSPVp/')).toBe(true)
    expect(isFacebookShareUrl('https://www.facebook.com/share/v/abc/')).toBe(true)
    expect(isFacebookShareUrl('https://www.facebook.com/share/p/abc/')).toBe(true)
    expect(isFacebookShareUrl('https://fb.watch/abc123/')).toBe(true)
  })

  it('leaves canonical permalinks alone', () => {
    expect(isFacebookShareUrl('https://www.facebook.com/reel/943809852095733/')).toBe(false)
    expect(isFacebookShareUrl('https://www.mecooks.com/share/r/x/')).toBe(false)
  })
})

describe('buildFacebookPluginUrl', () => {
  it('encodes the permalink into the href param with show_text', () => {
    expect(buildFacebookPluginUrl('https://www.facebook.com/reel/943809852095733/')).toBe(
      'https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Freel%2F943809852095733%2F&show_text=true&width=500',
    )
  })
})

describe('extractPluginCaption', () => {
  it('returns the full caption including the collapsed tail', () => {
    const caption = extractPluginCaption(PLUGIN_HTML)
    expect(caption).not.toBeNull()
    // Head of the caption, before "See more".
    expect(caption).toContain('Zrobisz pyszny obiad w 28 minut')
    expect(caption).toContain('250g twarogu półtłustego')
    // Tail hidden behind "See more" — the whole point of reading the markup.
    expect(caption).toContain('3 łyżki mąki pszennej')
    expect(caption).toContain('pieczemy w 200 stopniach przez 20 minut')
  })

  it('drops the "..." placeholder and decodes entities', () => {
    const caption = extractPluginCaption(PLUGIN_HTML) ?? ''
    expect(caption).not.toContain('...')
    expect(caption).toContain('☺️')
  })

  it('stops at the end of the post_message div', () => {
    expect(extractPluginCaption(PLUGIN_HTML)).not.toContain('Komentarze')
  })

  it('returns null when the page has no caption block', () => {
    expect(extractPluginCaption('<html><body>Film niedostępny</body></html>')).toBeNull()
    expect(extractPluginCaption('<div data-testid="post_message"></div>')).toBeNull()
  })
})

describe('extractOgTag', () => {
  it('reads og:image and decodes the &amp; in query strings', () => {
    expect(extractOgTag(PLUGIN_HTML, 'image')).toBe(
      'https://scontent.xx.fbcdn.net/v/t15/793139775_455.jpg?oh=00_AQ&oe=6AA2F75A',
    )
  })

  it('returns null for a missing property', () => {
    expect(extractOgTag(PLUGIN_HTML, 'description')).toBeNull()
  })
})

describe('fetchFacebookPost', () => {
  function fetchStub(pluginHtml: string, canonical = 'https://www.facebook.com/reel/943809852095733/') {
    return vi.fn(async (input: string) => {
      if (input.includes('/plugins/video.php')) {
        return { ok: true, status: 200, url: input, text: async () => pluginHtml } as Response
      }
      return {
        ok: true,
        status: 200,
        url: `${canonical}?rdid=kI9HYUttRu1Lja92`,
        text: async () => PLUGIN_HTML,
      } as Response
    }) as unknown as typeof globalThis.fetch
  }

  it('resolves a share link and returns caption and image', async () => {
    const fetch = fetchStub(PLUGIN_HTML)
    const post = await fetchFacebookPost('https://www.facebook.com/share/r/1B4yZLSPVp/', { fetch })

    expect(post?.canonicalUrl).toBe('https://www.facebook.com/reel/943809852095733/')
    expect(post?.caption).toContain('250g twarogu półtłustego')
    expect(post?.image).toContain('fbcdn.net')
  })

  it('asks for the plugin page without waiting on the redirect for a permalink', async () => {
    // A canonical /reel/ URL needs no resolving, so the two requests overlap:
    // the plugin call must be in flight before the permalink fetch settles.
    let resolvePermalink: (() => void) | undefined
    const fetch = vi.fn(async (input: string) => {
      if (input.includes('/plugins/video.php')) {
        return { ok: true, status: 200, url: input, text: async () => PLUGIN_HTML } as Response
      }
      await new Promise<void>((resolve) => {
        resolvePermalink = resolve
      })
      return { ok: true, status: 200, url: input, text: async () => PLUGIN_HTML } as Response
    }) as unknown as typeof globalThis.fetch

    const pending = fetchFacebookPost('https://www.facebook.com/reel/943809852095733/', { fetch })
    await vi.waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2))
    resolvePermalink?.()

    expect((await pending)?.caption).toContain('250g twarogu półtłustego')
  })

  it('asks the plugin for the canonical URL, not the share link', async () => {
    const fetch = fetchStub(PLUGIN_HTML)
    await fetchFacebookPost('https://www.facebook.com/share/r/1B4yZLSPVp/', { fetch })

    const pluginCall = vi
      .mocked(fetch)
      .mock.calls.map((c) => String(c[0]))
      .find((u) => u.includes('/plugins/video.php'))
    expect(pluginCall).toContain(encodeURIComponent('https://www.facebook.com/reel/943809852095733/'))
    expect(pluginCall).not.toContain('rdid')
  })

  it('returns a caption-less result when the plugin page has no post text', async () => {
    const fetch = fetchStub('<html><body>Film niedostępny</body></html>')
    const post = await fetchFacebookPost('https://www.facebook.com/reel/1/', { fetch })

    expect(post?.caption).toBeNull()
    expect(post?.image).toContain('fbcdn.net')
  })

  it('survives a network failure instead of throwing', async () => {
    const fetch = vi.fn(async () => {
      throw new Error('network down')
    }) as unknown as typeof globalThis.fetch

    await expect(fetchFacebookPost('https://www.facebook.com/reel/1/', { fetch })).resolves.toBeNull()
  })

  it('ignores non-Facebook URLs', async () => {
    const fetch = vi.fn() as unknown as typeof globalThis.fetch
    await expect(fetchFacebookPost('https://www.mecooks.com/x', { fetch })).resolves.toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })
})
