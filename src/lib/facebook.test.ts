import { describe, it, expect, vi } from 'vitest'
import {
  buildFacebookPluginUrl,
  extractOgTag,
  extractPluginCaption,
  fetchFacebookPost,
  findRecipeLinkInText,
  isFacebookShareUrl,
  isFacebookUrl,
} from '@/lib/facebook'

// Mirrors the real plugins/video.php markup: the caption lives in a
// data-testid="post_message" div, emoji are <span>-wrapped images, lines are
// <br />-separated, and the tail past "See more" sits in a text_exposed_show
// sibling with a text_exposed_hide "..." placeholder in front of it. It
// deliberately carries no player markup, so it also stands for "caption wins
// over the refusal check" — do not add a <video> tag to it.
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

// What the plugin returns instead of a player when it will not show a post:
// its error card. Only the missing player matters to pluginHasNoPlayer — the
// obfuscated class names and the localised copy are not part of the signal.
const REFUSED_HTML = '<html><body><div class="_3i0p">Nie można osadzić tego filmu</div></body></html>'

// A post the plugin did embed, over which the author simply wrote nothing.
const PLAYER_HTML = '<html><body><video src="reel.mp4"></video></body></html>'

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

describe('findRecipeLinkInText', () => {
  const TEASER = `Kruche ciasto ze śliwkami jest obłędne!
Przepis:

https://kulinarnecuda.pl/ciasto-kruche-ze-sliwkami-i-beza/`

  it('returns the blog link a teaser post points at', () => {
    expect(findRecipeLinkInText(TEASER)).toBe(
      'https://kulinarnecuda.pl/ciasto-kruche-ze-sliwkami-i-beza/',
    )
  })

  it('drops the sentence punctuation that closes the link', () => {
    expect(findRecipeLinkInText('Przepis tutaj: https://blog.example/ciasto.')).toBe(
      'https://blog.example/ciasto',
    )
  })

  it('ignores Facebook and other platform links', () => {
    expect(
      findRecipeLinkInText('Więcej: https://www.facebook.com/groups/obiadek/ oraz https://youtu.be/abc'),
    ).toBeNull()
  })

  it('ignores subdomains of those platforms too', () => {
    // l.facebook.com wraps outbound links; youtube-nocookie is the embed host.
    expect(findRecipeLinkInText('Klik: https://l.facebook.com/l.php?u=x')).toBeNull()
    expect(findRecipeLinkInText('Film: https://www.youtube-nocookie.com/embed/abc')).toBeNull()
  })

  it('keeps a caption that carries the recipe itself, link or not', () => {
    const recipe = `SKŁADNIKI:
${'250g twarogu, 3 łyżki mąki, 2 jajka, szczypta soli. '.repeat(8)}
Więcej na https://blog.example/`
    expect(recipe.length).toBeGreaterThan(300)
    expect(findRecipeLinkInText(recipe)).toBeNull()
  })

  it('returns null for text with no link at all', () => {
    expect(findRecipeLinkInText('Pyszne ciasto, polecam!')).toBeNull()
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
    const fetch = fetchStub(PLAYER_HTML)
    const post = await fetchFacebookPost('https://www.facebook.com/reel/1/', { fetch })

    expect(post?.caption).toBeNull()
    expect(post?.embedStatus).toBe('rendered')
    expect(post?.image).toContain('fbcdn.net')
  })

  it('reads a player the plugin identified only by videoID', async () => {
    const fetch = fetchStub('<html><script>{"videoID":"123"}</script></html>')
    const post = await fetchFacebookPost('https://www.facebook.com/reel/1/', { fetch })

    expect(post?.embedStatus).toBe('rendered')
  })

  it('reports a refusal when the plugin showed its error card instead', async () => {
    const fetch = fetchStub(REFUSED_HTML)
    const post = await fetchFacebookPost('https://www.facebook.com/reel/1/', { fetch })

    expect(post?.caption).toBeNull()
    expect(post?.embedStatus).toBe('refused')
  })

  it('reports a plugin page that never came back as unreachable, not a refusal', async () => {
    const fetch = vi.fn(async (input: string) => {
      if (input.includes('/plugins/video.php')) {
        return { ok: false, status: 503, url: input, text: async () => '' } as Response
      }
      return { ok: true, status: 200, url: input, text: async () => PLUGIN_HTML } as Response
    }) as unknown as typeof globalThis.fetch
    const post = await fetchFacebookPost('https://www.facebook.com/reel/1/', { fetch })

    expect(post?.caption).toBeNull()
    expect(post?.embedStatus).toBe('unreachable')
  })

  it('never calls a post with a caption a refusal', async () => {
    // The fixture carries no player markup, but a caption settles it.
    const post = await fetchFacebookPost('https://www.facebook.com/reel/1/', { fetch: fetchStub(PLUGIN_HTML) })

    expect(post?.caption).toContain('250g twarogu')
    expect(post?.embedStatus).toBe('rendered')
  })

  it('survives a network failure instead of throwing, and says it never looked', async () => {
    const fetch = vi.fn(async () => {
      throw new Error('network down')
    }) as unknown as typeof globalThis.fetch

    const post = await fetchFacebookPost('https://www.facebook.com/reel/1/', { fetch })

    // Not null: "we could not reach Facebook" is the one thing the caller has
    // to know here, so it must not read as "the post has no caption".
    expect(post).toMatchObject({ caption: null, image: null, embedStatus: 'unreachable' })
  })

  it('ignores non-Facebook URLs', async () => {
    const fetch = vi.fn() as unknown as typeof globalThis.fetch
    await expect(fetchFacebookPost('https://www.mecooks.com/x', { fetch })).resolves.toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })
})
