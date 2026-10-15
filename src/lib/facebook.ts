// Facebook Reels / video posts carry the recipe in the post caption, but a
// logged-out request to facebook.com/reel/<id> returns only og:image and
// og:url — the caption never reaches Firecrawl, so `facebook_text` extractions
// had nothing to work with (the open risk in
// context/changes/recipe-pipeline-analysis/research.md).
//
// The official Embedded Video Player plugin renders the *full* caption without
// a session when asked for it:
//
//   https://www.facebook.com/plugins/video.php?href=<post url>&show_text=true
//
// The caption sits in a `div[data-testid="post_message"]`, complete — Facebook
// only *visually* truncates it behind a "See more" toggle, and the hidden tail
// is present in the markup.
//
// Two plain fetches replace the Firecrawl call for this source: one to resolve
// the link and read og:image, one for the plugin page.
//
// The plugin covers Page videos and reels only. A post inside a group — even a
// public one — renders as "niedostępny" there, and so does a photo or text
// post on a Page. Those are read from the permalink page instead, which
// Facebook server-renders, comments included, for a search-engine user-agent
// (see `fetchPostPageCaption`):
// group authors often post a photo and a title, and put the recipe itself in
// the first comment. When the text is only a teaser, the blog link it carries
// (see `findRecipeLinkInText`) is followed by the caller instead.

import { isYoutubeHost } from '@/lib/youtube'
import { decodeEntities } from '@/lib/html-entities'
import { GALLERY_LIMIT } from '@/lib/recipe-image-archive'

const CRAWLER_UA = 'facebookexternalhit/1.1'
// The only logged-out user-agent Facebook serves a group post's text and
// comments to; facebookexternalhit gets og: tags only, a browser a login wall.
const SEARCH_BOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const FACEBOOK_HOSTS = new Set(['facebook.com', 'fb.watch', 'fb.me'])

/** Strip the www./m./web./mbasic. subdomain so host comparisons are uniform. */
function normalizeFacebookHost(host: string): string {
  return host.replace(/^(www|m|web|mbasic|touch)\./, '')
}

export function isFacebookUrl(url: string): boolean {
  try {
    return FACEBOOK_HOSTS.has(normalizeFacebookHost(new URL(url).hostname))
  } catch {
    return false
  }
}

/**
 * Short links the FB app produces from the "Share → Copy link" sheet:
 * /share/r/<code>/ (reel), /share/v/<code>/ (video), /share/p/<code>/ (post),
 * plus the fb.watch / fb.me shorteners. They 400 for a browser user-agent and
 * only redirect for a crawler one, so they must be resolved before use.
 */
export function isFacebookShareUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const host = normalizeFacebookHost(parsed.hostname)
    if (host === 'fb.watch' || host === 'fb.me') return true
    return host === 'facebook.com' && /^\/share\//.test(parsed.pathname)
  } catch {
    return false
  }
}

/**
 * The canonical /groups/<group>/posts/<post>/ permalink of a group post, or
 * null for anything else. Group feeds link a post as
 * /groups/<group>/?multi_permalinks=<post>, which loads the whole group — its
 * og: tags describe the group, not the post — so it has to be rewritten
 * before any fetch, and before the query string is dropped with the post id.
 */
export function toGroupPostUrl(url: string): string | null {
  const groupPost = parseGroupPost(url)
  return groupPost ? `https://www.facebook.com/groups/${groupPost.group}/posts/${groupPost.post}/` : null
}

/** The group and post ids of a group post link, in any of the shapes toGroupPostUrl reads. */
function parseGroupPost(url: string): { group: string; post: string } | null {
  try {
    const parsed = new URL(url)
    if (normalizeFacebookHost(parsed.hostname) !== 'facebook.com') return null
    const permalink = /^\/groups\/([^/]+)\/(?:posts|permalink)\/(\d+)/.exec(parsed.pathname)
    const group = permalink?.[1] ?? /^\/groups\/([^/]+)\/?$/.exec(parsed.pathname)?.[1]
    // multi_permalinks may list several ids; the first is the one clicked.
    const post = permalink?.[2] ?? parsed.searchParams.get('multi_permalinks')?.split(',')[0]
    if (!group || !post || !/^\d+$/.test(post)) return null
    return { group, post }
  } catch {
    return null
  }
}

// Hosts that are never the recipe itself: Facebook's own links (the post, a
// profile, an l.php wrapper) and platforms that need their own pipeline.
// Facebook's own list is reused from above and YouTube's is matched through
// youtube.ts, so neither table can drift out of sync with a second copy.
const NON_RECIPE_LINK_HOSTS = [...FACEBOOK_HOSTS, 'fbcdn.net', 'instagram.com', 'tiktok.com']

/** True when a link's host could plausibly host the recipe itself. */
function isRecipeLinkHost(host: string): boolean {
  if (isYoutubeHost(host)) return false
  // Subdomains count: l.facebook.com wraps outbound links, scontent.*.fbcdn.net
  // serves the media.
  return !NON_RECIPE_LINK_HOSTS.some((bad) => host === bad || host.endsWith(`.${bad}`))
}

/**
 * A caption long enough to be the recipe rather than a pointer to one. Group
 * posts are typically a one-line teaser plus a blog link; a caption that
 * actually carries ingredients and steps runs well past this. The bound also
 * sits above Facebook's og:description truncation (~300 chars), so a
 * truncated recipe caption is never mistaken for a teaser.
 */
const POINTER_PROSE_CHARS = 300

const LINK_RE = /https?:\/\/[^\s<>"')\]]+/gi

/**
 * The recipe is often not in the post at all — an author posts a photo and a
 * one-liner, and links their blog. Returns that link when the text reads as a
 * pointer (an outbound link plus little prose), null when the text is long
 * enough to hold the recipe itself or carries no usable link.
 */
export function findRecipeLinkInText(text: string): string | null {
  const links = text.match(LINK_RE) ?? []
  const prose = text.replace(LINK_RE, ' ').replace(/\s+/g, ' ').trim()
  if (prose.length > POINTER_PROSE_CHARS) return null

  for (const raw of links) {
    // Captions close a link with sentence punctuation the URL doesn't own.
    const url = raw.replace(/[.,;:!?)\]]+$/, '')
    try {
      if (isRecipeLinkHost(new URL(url).hostname.toLowerCase())) {
        return url
      }
    } catch {
      // Not a URL once the trailing punctuation is gone — skip it.
    }
  }
  return null
}

export function buildFacebookPluginUrl(href: string): string {
  return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(href)}&show_text=true&width=500`
}

/**
 * Return the substring of `html` that sits inside the div opened at
 * `openTagEnd`, by counting nested <div> tags. Regex alone can't do this —
 * the caption contains its own nested spans/divs and Facebook's class names
 * are obfuscated and unstable, so a "stop at class X" heuristic rots.
 */
function sliceBalancedDiv(html: string, openTagEnd: number): string {
  const TAG = /<(\/?)div\b/gi
  TAG.lastIndex = openTagEnd
  let depth = 1
  let match: RegExpExecArray | null
  while ((match = TAG.exec(html)) !== null) {
    depth += match[1] === '/' ? -1 : 1
    if (depth === 0) return html.slice(openTagEnd, match.index)
  }
  // Unbalanced markup — take what's left rather than dropping the caption.
  return html.slice(openTagEnd)
}

/**
 * Pull the post caption out of a rendered video-plugin page. Returns null when
 * the page carries no caption (private/removed post, or a post whose author
 * wrote no text).
 */
export function extractPluginCaption(html: string): string | null {
  const open = /<div[^>]*data-testid="post_message"[^>]*>/i.exec(html)
  if (!open) return null

  const inner = sliceBalancedDiv(html, open.index + open[0].length)

  const text = decodeEntities(
    inner
      // "…" placeholder for the collapsed tail; the tail itself follows in a
      // sibling span and must be kept.
      .replace(/<span class="text_exposed_hide">[\s\S]*?<\/span>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p\s*>/gi, '\n\n')
      .replace(/<\/div\s*>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    // \r is non-newline whitespace, so the collapse below folds CRLF into the
    // newline the per-line trim then cleans up.
    .replace(/[^\S\n]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return text.length > 0 ? text : null
}

/**
 * True when the plugin page carries no player — it rendered its error card
 * instead. The card's copy is localised and its class names are obfuscated,
 * so the player markup is the signal; two markers, since either could be
 * renamed. See `FacebookPost.embedStatus` for what that means.
 */
function pluginHasNoPlayer(html: string): boolean {
  return !/<video\b/i.test(html) && !html.includes('videoID')
}

/** First og:<property> value in a page's head, or null. */
export function extractOgTag(html: string, property: string): string | null {
  const re = new RegExp(
    `<meta[^>]+property=["']og:${property}["'][^>]+content=["']([^"']*)["']`,
    'i',
  )
  const match = re.exec(html)
  return match ? decodeEntities(match[1]) : null
}

export type FacebookEmbedStatus = 'rendered' | 'refused' | 'unreachable'

export interface FacebookPost {
  /** Canonical facebook.com URL the share link resolved to. */
  canonicalUrl: string
  /** Full post caption, or null when the plugin page exposed none. */
  caption: string | null
  /**
   * How the embed plugin answered, which is what a null `caption` means:
   *   - `rendered`  — we saw the post; no caption means it carries no text.
   *   - `refused`   — the plugin showed its error card (embedding disabled by
   *                   the author, or a private / removed post), or a group
   *                   post page came back without the post (a private group).
   *                   We never saw the post, so a null caption says nothing.
   *   - `unreachable` — the plugin page did not come back (timeout, 5xx). Also
   *                   no verdict, but transient rather than a policy.
   */
  embedStatus: FacebookEmbedStatus
  /**
   * Blog link the post points at instead of carrying the recipe, or null.
   * Read from the caption when there is one and from og:description otherwise
   * — the plugin refuses group posts, and og:description is the only caption
   * text left for those.
   */
  recipeLink: string | null
  /**
   * og:image — the reel/video cover frame. A signed fbcdn.net URL whose `oe=`
   * param is a unix expiry a few days out: archive it right away and never
   * persist the link itself.
   */
  image: string | null
  /**
   * Every photo of a multi-photo group post, in post order — signed fbcdn.net
   * URLs that expire like `image`. Empty for other posts.
   */
  images: string[]
}

export interface FetchFacebookPostDeps {
  fetch: typeof globalThis.fetch
}

/**
 * Follow the post URL to its canonical permalink and read og:image off the
 * same response. A crawler user-agent is required — a browser one gets a 400
 * on /share/ links. Never throws; falls back to the URL it was given.
 */
async function fetchPermalink(
  url: string,
  fetch: typeof globalThis.fetch,
): Promise<{ canonicalUrl: string; image: string | null; description: string | null }> {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': CRAWLER_UA, 'Accept-Language': 'pl-PL,pl;q=0.9' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) return { canonicalUrl: url, image: null, description: null }
    const html = await response.text()
    return {
      // Drop the ?rdid=/&share_url= tracking params the redirect appends —
      // the plugin wants a bare permalink.
      canonicalUrl: stripFacebookTracking(response.url || url),
      image: extractOgTag(html, 'image'),
      // Facebook truncates this, so it is no substitute for the plugin
      // caption as recipe text — but it is enough to spot a blog link.
      description: extractOgTag(html, 'description'),
    }
  } catch (error) {
    console.warn('[facebook] canonical resolve failed:', error)
    return { canonicalUrl: url, image: null, description: null }
  }
}

interface PostText {
  caption: string | null
  embedStatus: FacebookEmbedStatus
  images: string[]
}

const UNREACHABLE: PostText = { caption: null, embedStatus: 'unreachable', images: [] }

/** The embedded-video plugin page — the only logged-out surface that renders
 *  the caption. Never throws; a page we could not load is `unreachable`, which
 *  the caller must not read as "the post has no caption". */
async function fetchCaption(url: string, fetch: typeof globalThis.fetch): Promise<PostText> {
  try {
    const response = await fetch(buildFacebookPluginUrl(url), {
      headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'pl-PL,pl;q=0.9' },
      signal: AbortSignal.timeout(20_000),
    })
    if (!response.ok) {
      console.warn('[facebook] plugin page returned', response.status)
      return UNREACHABLE
    }
    const html = await response.text()
    const caption = extractPluginCaption(html)
    // A caption settles it: the post rendered, whatever else the markup looks
    // like. Only a page that gave us nothing can be the error card.
    return {
      caption,
      embedStatus: caption == null && pluginHasNoPlayer(html) ? 'refused' : 'rendered',
      images: [],
    }
  } catch (error) {
    console.warn('[facebook] plugin fetch failed:', error)
    return UNREACHABLE
  }
}

// A JSON string literal's body, escapes included, for JSON.parse to decode.
const JSON_STRING = String.raw`"((?:[^"\\]|\\.)*)"`
const POST_MESSAGE = new RegExp(`"message":\\{"text":${JSON_STRING}`)
// The story's first actor is the post author.
const POST_AUTHOR = /"actors":\[\{[^\]]*?"id":"([^"]+)"/
const TOP_LEVEL_COMMENT = new RegExp(
  `"depth":0,"body":\\{"text":${JSON_STRING}[\\s\\S]{0,3000}?"author":\\{"__typename":"\\w+","id":"([^"]+)"`,
  'g',
)

function decodeJsonString(body: string): string | null {
  try {
    return JSON.parse(`"${body}"`) as string
  } catch {
    return null
  }
}

/**
 * The text of a group post as its permalink page embeds it in the Relay data:
 * the post message, followed by every top-level comment its author wrote —
 * which is where group authors tend to put the recipe. Other members'
 * comments are left out; they are reactions, not the recipe. Returns null
 * when the page carries neither (a private group, or the login wall).
 */
export function extractGroupPostText(html: string): string | null {
  const message = POST_MESSAGE.exec(html)
  const authorId = POST_AUTHOR.exec(html)?.[1]

  const parts = new Set<string>()
  const messageText = message ? decodeJsonString(message[1]) : null
  if (messageText) parts.add(messageText.trim())

  if (authorId) {
    // Each comment sits in the data more than once; the Set keeps one copy.
    for (const [, body, commentAuthor] of html.matchAll(TOP_LEVEL_COMMENT)) {
      const text = commentAuthor === authorId ? decodeJsonString(body)?.trim() : null
      if (text) parts.add(text)
    }
  }

  return parts.size > 0 ? [...parts].join('\n\n') : null
}

// A photo of the post links to its viewer as photo.php?fbid=<photo>&set=gm.<post>.
// Photos in members' comments sit in other sets, so the set pins the post's own.
const POST_PHOTO_LINK = /fbid=(\d+)(?:&|&amp;|\\u0026)set=gm\.(\d+)/g

/** Ids of a group post's own photos, in post order, each once. */
export function extractGroupPostPhotoIds(html: string, postId: string): string[] {
  const ids = new Set<string>()
  for (const [, photoId, setId] of html.matchAll(POST_PHOTO_LINK)) {
    if (setId === postId) ids.add(photoId)
  }
  return [...ids]
}

/** The embedded-post plugin page for one photo of a group post. */
export function buildFacebookPhotoPluginUrl(photoId: string, postId: string): string {
  const photo = `https://www.facebook.com/photo.php?fbid=${photoId}&set=gm.${postId}&type=3`
  return `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(photo)}&show_text=false&width=500`
}

const IMG_TAG = /<img\b[^>]*>/gi
const IMG_SRC = /\bsrc="([^"]+)"/
const IMG_WIDTH = /\bwidth="(\d+)"/

/**
 * The photo in an embedded-post plugin page. The page also carries the
 * author's avatar (no declared size) and the app badge (24px, on
 * static.xx.fbcdn.net); the photo is the fbcdn image declaring a real width.
 */
export function extractPluginPhoto(html: string): string | null {
  for (const tag of html.match(IMG_TAG) ?? []) {
    const src = IMG_SRC.exec(tag)?.[1]
    if (!src || !/^https:\/\/scontent[^/]*\.fbcdn\.net\//.test(src)) continue
    if (Number(IMG_WIDTH.exec(tag)?.[1] ?? 0) >= 200) return decodeEntities(src)
  }
  return null
}

/**
 * A group post photo's image URL. Its viewer page is behind the login wall
 * from Cloudflare's addresses for every user-agent (it only answers
 * link-preview bots from residential ones), but the embedded-post plugin
 * renders the photo for a crawler from anywhere — at 394px, the plugin's only
 * size. Never throws.
 */
async function fetchGroupPhoto(
  photoId: string,
  postId: string,
  fetch: typeof globalThis.fetch,
): Promise<string | null> {
  try {
    const response = await fetch(buildFacebookPhotoPluginUrl(photoId, postId), {
      headers: { 'User-Agent': CRAWLER_UA, 'Accept-Language': 'pl-PL,pl;q=0.9' },
      signal: AbortSignal.timeout(15_000),
    })
    return response.ok ? extractPluginPhoto(await response.text()) : null
  } catch (error) {
    console.warn('[facebook] group photo fetch failed:', error)
    return null
  }
}

/** A public post's message and its author's comments, read off its permalink
 *  page — the video plugin refuses group posts and every post that is not a
 *  video. A group post's photos come along when `groupPostId` is given. Never
 *  throws — same contract as `fetchCaption`. */
async function fetchPostPageCaption(
  url: string,
  groupPostId: string | null,
  fetch: typeof globalThis.fetch,
): Promise<PostText> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': SEARCH_BOT_UA, 'Accept-Language': 'pl-PL,pl;q=0.9' },
      signal: AbortSignal.timeout(20_000),
    })
    if (!response.ok) {
      console.warn('[facebook] post page returned', response.status)
      return UNREACHABLE
    }
    const html = await response.text()
    const caption = extractGroupPostText(html)
    // A login wall carries no photos worth fetching.
    const images =
      caption == null || groupPostId == null
        ? []
        : await Promise.all(
            extractGroupPostPhotoIds(html, groupPostId)
              .slice(0, GALLERY_LIMIT)
              .map((photoId) => fetchGroupPhoto(photoId, groupPostId, fetch)),
          )
    // No text at all means Facebook served the login wall: a private post.
    return {
      caption,
      embedStatus: caption == null ? 'refused' : 'rendered',
      images: images.filter((image): image is string => image != null),
    }
  } catch (error) {
    console.warn('[facebook] post page fetch failed:', error)
    return UNREACHABLE
  }
}

/** The caption for a post, from whichever logged-out surface renders its kind. */
async function fetchPostText(url: string, fetch: typeof globalThis.fetch): Promise<PostText> {
  const groupPost = toGroupPostUrl(url)
  const postId = parseGroupPost(url)?.post
  if (groupPost && postId) return fetchPostPageCaption(groupPost, postId, fetch)

  // Reels and videos render in the plugin; any other post — a photo or text
  // post on a Page or profile — gets its error card, and is read off the
  // permalink page instead. So does a video whose author disabled embedding.
  const plugin = await fetchCaption(url, fetch)
  return plugin.embedStatus === 'refused' ? fetchPostPageCaption(url, null, fetch) : plugin
}

// The query params that identify the post itself; everything else on a
// Facebook link (__cft__, __tn__, rdid, share_url, …) is tracking.
const POST_ID_PARAMS = ['story_fbid', 'id', 'fbid', 'v']

/** `url` without its tracking params, keeping the ones that name the post
 *  (permalink.php and story.php carry the post id in the query). */
export function stripFacebookTracking(url: string): string {
  try {
    const parsed = new URL(url)
    const kept = new URLSearchParams()
    for (const name of POST_ID_PARAMS) {
      const value = parsed.searchParams.get(name)
      if (value != null) kept.set(name, value)
    }
    parsed.search = kept.toString()
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return url
  }
}

/**
 * Fetch a Facebook reel/video post's caption and thumbnail without a session.
 *
 * Never throws: any network or parsing failure yields null (or a partial
 * result) so the caller can fall back to the generic Firecrawl path.
 */
export async function fetchFacebookPost(
  url: string,
  { fetch }: FetchFacebookPostDeps = { fetch: globalThis.fetch },
): Promise<FacebookPost | null> {
  if (!isFacebookUrl(url)) return null

  const target = toGroupPostUrl(url) ?? stripFacebookTracking(url)
  const permalink = fetchPermalink(target, fetch)

  const pluginPage = isFacebookShareUrl(url)
    ? // A share link only reveals its target through the redirect, so the
      // plugin fetch has to wait for the permalink.
      permalink.then(({ canonicalUrl }) => fetchPostText(canonicalUrl, fetch))
    : // Already a permalink — both requests go out together.
      fetchPostText(target, fetch)

  const [{ canonicalUrl, image, description }, { caption, embedStatus, images }] = await Promise.all([
    permalink,
    pluginPage,
  ])

  // Anything but `rendered` is a result too — it is what lets the caller word
  // the failure without blaming the author for a post nobody could read.
  if (caption == null && image == null && embedStatus === 'rendered') return null

  return {
    canonicalUrl,
    caption,
    embedStatus,
    recipeLink: findRecipeLinkInText(caption ?? description ?? ''),
    image,
    images,
  }
}
