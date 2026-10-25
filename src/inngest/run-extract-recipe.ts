import type { SupabaseClient } from '@supabase/supabase-js'
import { buildFirecrawlOptions, buildEmbedScanOptions } from '@/lib/firecrawl'
import { NUMBERED_SLUG_ATTEMPTS, recipeSlug, recipeSlugCandidate } from '@/lib/slugify'
import {
  archiveRecipeImages,
  archiveStepImages,
  buildGallery,
  coverImage,
  jsonLdHowToStepImages,
  pickGalleryImages,
} from '@/lib/recipe-image-archive'
import { splitLlmSteps, buildStepImageSources } from '@/lib/step-image-extract'
import { youtubeIdFromUrl, findEmbeddedYoutubeId, fetchYoutubeOembed, fetchYoutubeTranscript } from '@/lib/youtube'
import { mayBeBloggerPost, fetchBloggerPost } from '@/lib/blogger-feed'
import { fetchFacebookPost, isFacebookUrl } from '@/lib/facebook'
import { publicFacebookAuthor } from '@/lib/facebook-authors'
import {
  classifyExisting,
  findRecipeBySourceFingerprint,
  findRecipeBySourceUrl,
  findRecipeByYoutubeId,
  findSameRecipe,
  ingredientFingerprint,
} from '@/lib/recipe-dedup'
import { insertFavorite } from '@/lib/favorites'
import { fingerprintText } from '@/lib/source-fingerprint'
import { resolvedSourceUrl } from '@/lib/url-normalize'
import { looksUnextractable, isExtractedRecipeUsable } from '@/lib/content-quality'
import { RECIPE_CATEGORIES, toRecipeCategory } from '@/lib/recipe-categories'
import { labelRecipe } from '@/lib/recipe-labeling'
import { STEP_CONTENT_RULE, STEP_FORM_RULE } from '@/lib/step-form'
import { classifyDish, writeVariantNote, type DishVocabularyEntry, type VariantNoteSibling } from '@/lib/recipe-dish'
import { findNextPageUrl, MAX_EXTRA_PAGES } from '@/lib/paginated-article'
import { jsonLdServings, toServings } from '@/lib/servings'
import { toIngredients, toMinutes } from '@/lib/extracted-recipe'
import { detectSourceLanguage, EXTRACTION_MODEL, FOREIGN_EXTRACTION_MODEL, FOREIGN_SOURCE_RULES } from '@/lib/source-language'
import { readerScrape, type ReaderPage } from '@/lib/jina-reader'
import { fetchPublicHtml } from '@/lib/public-fetch'
import type { Database } from '@/lib/supabase.types'

/**
 * The share repeats a saved recipe, so no copy is made. The user's own: link
 * the share to it. Someone else's (one recipe per link, E01-S03a): add it to
 * the user's favorites and complete the share. Another owner's row is never
 * written — no gap-fill, no image archive.
 */
async function settleOnSaved(
  supabase: SupabaseClient,
  { shareId, userId }: { shareId: number; userId: string },
  saved: { id: number; title: string; category: string; user_id: string },
) {
  const owner = classifyExisting({ ownMatch: saved.user_id === userId, globalMatch: true })
  if (owner === 'other') {
    const error = await insertFavorite(supabase, userId, saved.id)
    if (error) throw new Error(`Favorite insert failed: ${error.message}`)
  }
  const { error: shareError } = await supabase
    .from('recipe_shares')
    .update({ recipe_id: saved.id, status: 'completed' })
    .eq('id', shareId)
  // Thrown, so the caller's catch fails the share rather than reporting success
  // over a share left pending.
  if (shareError) throw new Error(`Share update failed: ${shareError.message}`)
  return {
    recipeId: saved.id,
    title: saved.title,
    category: saved.category,
    status: owner === 'own' ? 'duplicate' : 'favorited',
  }
}

// Failure copy. These strings are stored verbatim in
// recipe_shares.error_message and rendered raw in the notification bell, so
// the Facebook ones are Polish and say what the reader can do next. Which one
// applies turns on what we actually observed — never blame the author for a
// post nobody could read.
const FB_EMBED_REFUSED =
  'Facebook nie udostępnia treści tego posta (autor wyłączył osadzanie, post jest widoczny tylko po zalogowaniu, prywatny albo w zamkniętej grupie) — skopiuj przepis ręcznie albo podaj link do bloga'
const FB_UNREACHABLE =
  'Nie udało się pobrać tego posta z Facebooka — spróbuj ponownie za chwilę'
const FB_NO_CAPTION =
  'Ten post na Facebooku nie ma opisu z przepisem ani linku do niego (może być prywatny, usunięty albo przepis jest tylko w filmie)'
// The caption was read fine — it just holds no recipe (a teaser for a video).
const FB_CAPTION_NO_RECIPE =
  'Opis tego posta na Facebooku nie zawiera przepisu (przepis jest pewnie tylko w filmie) — skopiuj składniki ręcznie albo podaj link do bloga'
const LLM_UNREADABLE =
  'Nie udało się odczytać przepisu z odpowiedzi modelu — spróbuj ponownie'
const UNREADABLE_PAGE =
  'Scraped page had no readable recipe content (possible Google Translate interstitial or render failure)'
// Shown when a shared YouTube link yielded no recipe AND the video won't embed
// — almost always because it is private (oEmbed 403); reader-facing, so Polish.
const YOUTUBE_UNAVAILABLE =
  'Tego filmu z YouTube nie można dodać — jest prywatny, został usunięty albo ma wyłączone osadzanie'

export interface ExtractRecipeEvent {
  shareId: number
  sharedUrl: string
  sharedTitle?: string
  sharedText?: string
  userId: string
  sourceType?: 'facebook_text' | 'web_blog' | 'youtube'
  // Force refresh: overwrite the existing recipe for this source_url in place
  // (the "Odśwież przepis" action) instead of insert / gap-fill.
  force?: boolean
}

export interface RunExtractRecipeDeps {
  fetch: typeof globalThis.fetch
  supabase: SupabaseClient
  /**
   * Hand the photo archiving back as `images` instead of doing it inline. The
   * Inngest function runs it in steps of its own: archiving a photo-heavy page
   * in the same Worker invocation as the extraction ran out of budget after the
   * uploads, so the files landed in Storage but the row never got their URLs —
   * and every retry redid the whole extraction.
   */
  deferImages?: boolean
}

/** The photos a saved recipe still needs archived into Storage and linked. */
export interface RecipeImageJob {
  recipeId: number
  userId: string
  cover?: string
  gallery: string[]
  stepSources: (string | null)[]
  /** A refresh replaces the gallery outright, emptying it when the source has none left. */
  replace: boolean
}

export interface ExtractRecipeResult {
  recipeId: number
  title: string
  category: string
  status: string
  /** Set only with `deferImages`, when the run saved a recipe that has photos to archive. */
  images?: RecipeImageJob
}

async function updateRecipe(
  supabase: SupabaseClient,
  recipeId: number,
  update: Database['public']['Tables']['recipes']['Update'],
): Promise<void> {
  if (Object.keys(update).length === 0) return
  const { error } = await supabase.from('recipes').update(update).eq('id', recipeId)
  // Thrown, not swallowed: an unlinked upload is a cover the recipe silently lacks.
  if (error) throw new Error(`Image update failed: ${error.message}`)
}

/**
 * Archives the cover and the gallery and links them. Never downgrades the
 * cover: a failed re-archive leaves image_url as it was. The gallery replaces
 * the stored one when it archived — on a refresh even when empty (the source
 * lost its photos); a null gallery (nothing archived) keeps the old one.
 */
export async function storeCoverAndGallery(supabase: SupabaseClient, job: RecipeImageJob): Promise<void> {
  const archived = await archiveRecipeImages(supabase, job.userId, job.recipeId, job.cover, job.gallery, {
    clearStale: job.replace,
  })
  const update: Database['public']['Tables']['recipes']['Update'] = {}
  if (archived.cover != null) update.image_url = archived.cover
  if (archived.gallery != null && (job.replace || archived.gallery.length > 0)) update.image_urls = archived.gallery
  await updateRecipe(supabase, job.recipeId, update)
}

/** Archives the per-step photos and links them — only when this run found some. */
export async function storeStepImages(supabase: SupabaseClient, job: RecipeImageJob): Promise<void> {
  const stepImages = await archiveStepImages(supabase, job.userId, job.recipeId, job.stepSources)
  if (stepImages.some(Boolean)) await updateRecipe(supabase, job.recipeId, { step_images: stepImages })
}

/** Both of the above, for callers that archive inline (scripts, tests). */
export async function storeRecipeImages(supabase: SupabaseClient, job: RecipeImageJob): Promise<void> {
  await Promise.all([storeCoverAndGallery(supabase, job), storeStepImages(supabase, job)])
}

/** "HTTP 429 Too Many Requests". Workers' fetch leaves statusText empty on
 *  HTTP/2, so the code has to carry the message on its own. */
function httpStatus(response: Response): string {
  return `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`
}

interface RecipeData {
  title: string
  ingredients: Array<{ name: string; amount?: string; unit?: string; alt?: string; section?: string }>
  steps: string[]
  /** One entry per step (index-aligned): the in-content image URL the LLM picked, or null. */
  stepImages?: (string | null)[]
  category: string
  imageUrl?: string
  prepTimeMinutes?: number | null
  cookTimeMinutes?: number | null
  totalTimeMinutes?: number | null
  timesEstimated?: boolean
  servings?: number | null
}

// The model's own flag counts only when there is a time to flag: all three
// null means nothing is shown, so nothing is an estimate.
function timesAreEstimated(r: RecipeData): boolean {
  const hasTime = r.prepTimeMinutes != null || r.cookTimeMinutes != null || r.totalTimeMinutes != null
  return hasTime && r.timesEstimated === true
}

export async function runExtractRecipe(
  event: ExtractRecipeEvent,
  deps: RunExtractRecipeDeps,
): Promise<ExtractRecipeResult> {
  const {
    shareId,
    sharedUrl,
    sharedTitle,
    sharedText,
    userId,
    sourceType = 'facebook_text',
    force: forceRefresh = false,
  } = event
  const { fetch, supabase, deferImages = false } = deps

  // The saved recipe's photos: archived here, or handed back with `deferImages`.
  async function withImages<R extends ExtractRecipeResult>(result: R, job: RecipeImageJob): Promise<R> {
    if (deferImages) return { ...result, images: job }
    await storeRecipeImages(supabase, job)
    return result
  }

  async function firecrawlScrape(options: ReturnType<typeof buildFirecrawlOptions>) {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
      signal: AbortSignal.timeout(45_000),
    })
    if (!response.ok) {
      throw new Error(`Firecrawl failed: ${httpStatus(response)}`)
    }
    const data = await response.json()
    return data.data ?? {}
  }

  // When Firecrawl fails — down, or out of credits (HTTP 402) — Jina Reader
  // stands in, and Firecrawl is not asked again in this run. One read per URL:
  // the main scrape and the embed scan share it. With no content there
  // either, the error leads with Firecrawl's (the reader-facing copy keys on
  // it) and appends Jina's reason, so recipe_shares.error_message says both.
  let firecrawlError: string | null = null
  const readerPages = new Map<string, Promise<ReaderPage>>()
  async function scrape(options: ReturnType<typeof buildFirecrawlOptions>) {
    if (firecrawlError == null) {
      try {
        return await firecrawlScrape(options)
      } catch (err) {
        firecrawlError = err instanceof Error ? err.message : String(err)
        console.warn('[extract-recipe] Firecrawl failed, falling back to Jina Reader:', err)
      }
    }
    let read = readerPages.get(options.url)
    if (!read) {
      read = readerScrape(options.url, { fetch })
      readerPages.set(options.url, read)
    }
    try {
      return await read
    } catch (err) {
      throw new Error(`${firecrawlError}; ${err instanceof Error ? err.message : String(err)}`, { cause: err })
    }
  }

  // Recipe text comes from the main-content scrape, retrying with
  // fullContent when a blog template trips Firecrawl's main-content
  // heuristic and leaves just a "Skip to main content" link. Jina's read has
  // no such mode, so a reader page is never retried.
  async function scrapeWithRetry(url = sharedUrl, type = sourceType) {
    let s = await scrape(buildFirecrawlOptions(url, type, { fullContent: false }))
    if (firecrawlError == null && (!s.markdown || s.markdown.length < 200)) {
      console.warn('[extract-recipe] markdown < 200 chars; retrying with fullContent')
      s = await scrape(buildFirecrawlOptions(url, type, { fullContent: true }))
    }
    return type === 'web_blog' ? withFollowingPages(s, url) : s
  }

  // No redirects: the article URL is Firecrawl's final URL already, and a
  // page that redirects (one past the last) simply ends the walk.
  const fetchRawHtml = (url: string) => fetchPublicHtml(url, { fetch, maxRedirects: 0 })

  // An article split over pages ("Dalej »", <article>/2/, /3/ …) holds the
  // recipe across all of them. Firecrawl's main-content output drops that
  // navigation, so each page's raw HTML is checked for a link to the next one,
  // and the pages found are appended. A failure keeps what was gathered.
  async function withFollowingPages<T extends { markdown?: string; html?: string; metadata?: { url?: string; ogUrl?: string } }>(
    first: T,
    url: string,
  ): Promise<T> {
    const articleUrl = first.metadata?.url ?? first.metadata?.ogUrl ?? url
    let { markdown = '', html = '' } = first
    let pageUrl = articleUrl
    for (let page = 1; page <= MAX_EXTRA_PAGES; page++) {
      const raw = await fetchRawHtml(pageUrl)
      const next = raw ? findNextPageUrl(raw, articleUrl, page) : null
      if (!next) break
      const scraped = await scrape(buildFirecrawlOptions(next, 'web_blog', { fullContent: false })).catch(
        (err) => {
          console.warn('[extract-recipe] next page scrape failed:', err)
          return null
        },
      )
      if (!scraped?.markdown) break
      console.log('[extract-recipe] appending article page', page + 1, next)
      markdown += `\n\n${scraped.markdown}`
      html += scraped.html ?? ''
      pageUrl = next
    }
    return { ...first, markdown, html }
  }

  // The share repeats a recipe someone — the user or anyone else — already
  // saved: point it there instead of saving a copy (see settleOnSaved). It
  // can throw, so callers inside the try below `return await` it: a bare
  // `return` would let the rejection skip the catch that fails the share.
  const linkToSaved = (saved: { id: number; title: string; category: string; user_id: string }) =>
    settleOnSaved(supabase, { shareId, userId }, saved)

  try {
    let markdown = ''
    let html = ''
    let ogImage: string | undefined
    // The recipe's other photos, for the gallery under it; see buildGallery.
    let photos: string[] = []
    let embedHtml = ''
    // True while the content came verbatim from the author (a post caption, a
    // feed body) rather than from a rendered page; drives the junk gate below.
    let trustedContent = false
    // True when the content is a Facebook post's own caption: the recipe may
    // be its ingredient list alone, with the method shown in the video.
    let fromPostCaption = false

    // Blogger (blogspot or a custom domain): pull the post straight from the
    // Blogger JSON feed instead of rendering with Firecrawl — deterministic,
    // no Google Translate / empty main-content junk. Fall back to Firecrawl
    // when the feed has nothing (non-Blogger site behind a Blogger-shaped
    // path, disabled feed).
    const bloggerPost = mayBeBloggerPost(sharedUrl)
      ? await fetchBloggerPost(sharedUrl).catch((err) => {
          console.warn('[extract-recipe] Blogger feed failed, falling back to Firecrawl:', err)
          return null
        })
      : null

    // Facebook reels/videos: a logged-out scrape of facebook.com/reel/<id>
    // returns og tags only — the caption that holds the recipe never reaches
    // Firecrawl. The embedded-video plugin renders it without a session, so we
    // go there directly. Falls through to the Firecrawl path when the plugin
    // gives us nothing (private post, text-only post, FB blocking the IP).
    const facebookPost =
      sourceType === 'facebook_text'
        ? await fetchFacebookPost(sharedUrl, { fetch }).catch((err) => {
            console.warn('[extract-recipe] Facebook fetch failed, falling back to Firecrawl:', err)
            return null
          })
        : null

    // A share shortlink names its post only now, after the redirect. Store the
    // recipe under that post, and when anyone already saved it — shared earlier
    // by its permalink or by another shortlink — link this share to it instead
    // of extracting it a second time.
    const sourceUrl = resolvedSourceUrl(sharedUrl, facebookPost?.canonicalUrl)
    if (!forceRefresh && sourceUrl !== sharedUrl) {
      const saved = await findRecipeBySourceUrl(supabase, null, sourceUrl)
      if (saved) {
        console.log('[extract-recipe] share link resolves to saved recipe', saved.slug)
        return await linkToSaved(saved)
      }
    }

    // Many Facebook posts — group posts especially — are a teaser plus a link
    // to the author's blog, and the recipe only lives on the other side of
    // that link. Follow it: the blog is a page Firecrawl can actually read,
    // unlike facebook.com itself, which its API refuses with a 403.
    const linkedUrl = facebookPost?.recipeLink ?? null
    const linkedPage = linkedUrl
      ? await scrapeWithRetry(linkedUrl, 'web_blog').catch((err) => {
          console.warn('[extract-recipe] linked page scrape failed:', err)
          return null
        })
      : null

    // A dead blog (a 404, a host's "website unavailable" page) still renders
    // something; only a page that answered and reads as content beats the
    // caption, which often carries the recipe itself.
    const readableLinkedPage =
      linkedPage &&
      (linkedPage.metadata?.statusCode ?? 200) < 400 &&
      !(looksUnextractable(linkedPage.markdown ?? '') && looksUnextractable(linkedPage.html ?? ''))
        ? linkedPage
        : null
    if (linkedPage && !readableLinkedPage) {
      console.warn('[extract-recipe] linked page unreadable, status', linkedPage.metadata?.statusCode, linkedUrl)
    }

    if (readableLinkedPage) {
      const linkedPage = readableLinkedPage
      console.log('[extract-recipe] following Facebook caption link to', linkedUrl)
      markdown = linkedPage.markdown ?? ''
      html = linkedPage.html ?? ''
      // The blog's own og:image is a stable URL; the post thumbnail is only a
      // last resort, and it expires.
      ogImage = coverImage(linkedPage.metadata?.ogImage, html, linkedUrl ?? undefined) ?? facebookPost?.image ?? undefined
      photos = pickGalleryImages(html, linkedUrl ?? undefined)
    } else if (facebookPost?.caption) {
      console.log('[extract-recipe] using Facebook caption for', facebookPost.canonicalUrl)
      // The caption is already plain text and opens with the post's headline,
      // so it needs no title prefix the way the Blogger feed does.
      markdown = facebookPost.caption
      ogImage = facebookPost.image ?? undefined
      photos = facebookPost.images
      trustedContent = true
      fromPostCaption = true
    } else if (bloggerPost) {
      console.log('[extract-recipe] using Blogger feed for', sharedUrl)
      html = bloggerPost.html
      ogImage = bloggerPost.image ?? undefined
      photos = pickGalleryImages(bloggerPost.html, sharedUrl)
      // Give the LLM clean text, prefixed with the post title as a strong
      // title signal.
      const text = bloggerPost.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      markdown = bloggerPost.title ? `${bloggerPost.title}\n\n${text}` : text
      trustedContent = true
    } else if (isFacebookUrl(sharedUrl)) {
      // Nothing readable left, and Firecrawl is not a fallback here: its API
      // refuses facebook.com outright with a 403, so calling it would only
      // replace the real reason with a bare "Forbidden" in
      // recipe_shares.error_message — which is what the user sees. Leave the
      // content empty and let the gate below word the failure.
    } else {
      // For blog sources also run a dedicated full-page scrape in parallel to
      // find an embedded YouTube player — the recipe-text scrape strips
      // iframes (onlyMainContent + BLOG_EXCLUDE_TAGS's 'iframe'). No extra
      // latency (Promise.all); a failure there must not sink the extraction.
      const [scraped, scrapedEmbedHtml] = await Promise.all([
        scrapeWithRetry(),
        sourceType === 'web_blog'
          ? scrape(buildEmbedScanOptions(sharedUrl))
              .then((d) => (d.html ?? '') as string)
              .catch((err) => {
                console.warn('[extract-recipe] embed scan failed:', err)
                return ''
              })
          : Promise.resolve(''),
      ])
      markdown = scraped.markdown ?? ''
      html = scraped.html ?? ''
      ogImage = coverImage(scraped.metadata?.ogImage, html, sharedUrl)
      // A YouTube page's images are other videos' thumbnails, not the dish.
      if (sourceType === 'web_blog') photos = pickGalleryImages(html, sharedUrl)
      embedHtml = scrapedEmbedHtml
    }

    // image_url is only ever a Supabase Storage URL or null (the archive-first
    // invariant): an external link is never persisted — not even a blog's stable
    // og:image — so no third-party URL can reach a rendered page. A cover that
    // fails to archive leaves image_url null and the page shows the NoPhoto
    // placeholder; the og:image is still handed to the archiver below.
    const gallery = buildGallery(ogImage, photos)

    // S-04: capture a YouTube video id for the detail-page embed. Either the
    // shared URL is itself a YouTube link (source_type 'youtube'), or a blog
    // page embeds a player (found in the Blogger feed html / the embed scan).
    const youtubeId = youtubeIdFromUrl(sharedUrl) ?? findEmbeddedYoutubeId(embedHtml || html)

    // Only a video YouTube confirms as embeddable may be stored and rendered.
    // A blog can embed a video that has since gone private / been removed / had
    // embedding disabled, and a shared link can itself be a private video;
    // either way the detail page's <iframe> would show a "Video unavailable"
    // box. oEmbed answers 200 only for a playable, embeddable video and carries
    // the channel name, so one probe (run alongside the LLM) serves both the
    // gate and the author. `embeddableYoutubeId` is resolved from it below.
    const youtubeOembedPromise = youtubeId != null ? fetchYoutubeOembed(youtubeId, { fetch }) : Promise.resolve(null)

    // The same film saved under another link — the video itself, or a blog
    // post that embeds it (see findRecipeByYoutubeId). Before the junk
    // gate too: a page whose only content is the embedded player is still that film.
    if (!forceRefresh && youtubeId != null) {
      const sameVideo = await findRecipeByYoutubeId(supabase, youtubeId, { fromVideo: sourceType === 'youtube' })
      if (sameVideo) {
        console.log('[extract-recipe] same YouTube video already saved:', sameVideo.slug)
        return await linkToSaved(sameVideo)
      }
    }

    // Fail fast on junk (Google Translate interstitial, empty main content)
    // before spending an OpenAI call — throwing lets Inngest retry, since the
    // junk is usually transient, and yields a clear error if it persists.
    // A caption read straight off the post is author text, not a render
    // artefact, so it is judged on emptiness alone (see ContentQualityOptions).
    // The output-side isExtractedRecipeUsable gate below still rejects
    // anything that isn't actually a recipe.
    const quality = { trusted: trustedContent }
    const inputIsJunk =
      looksUnextractable(markdown, quality) && looksUnextractable(html, quality)
    // A YouTube link has one more source to try — the spoken video, via its
    // captions — so an empty description is not the end there (see below).
    const canTryTranscript = sourceType === 'youtube' && youtubeId != null
    if (inputIsJunk && !canTryTranscript) {
      // Most specific first: what the embed plugin answered outranks the bare
      // fact that this is a Facebook URL.
      throw new Error(
        facebookPost?.embedStatus === 'refused'
          ? FB_EMBED_REFUSED
          : facebookPost?.embedStatus === 'unreachable'
            ? FB_UNREACHABLE
            : isFacebookUrl(sharedUrl)
              ? FB_NO_CAPTION
              : UNREADABLE_PAGE,
      )
    }

    // The author's own text identifies the recipe across posts: a Page that
    // publishes it twice gives two URLs but one text. Checked before any LLM
    // call. A rendered page differs between scrapes, so it gets no fingerprint.
    const sourceFingerprint = trustedContent ? await fingerprintText(markdown) : null
    if (!forceRefresh && sourceFingerprint) {
      const sameText = await findRecipeBySourceFingerprint(supabase, null, sourceFingerprint)
      if (sameText) {
        console.log('[extract-recipe] same post text already saved:', sameText.slug)
        return await linkToSaved(sameText)
      }
    }

    // Who published the recipe, for the source label ("Kulinarna Wiola ·
    // Facebook"): the Facebook poster — a private person only as "Elżbieta
    // K." — or the YouTube channel, fetched while the LLM extracts. A blog is
    // named by its domain, so it needs none.
    const sourceAuthorPromise: Promise<string | null> =
      sourceType === 'youtube'
        ? youtubeOembedPromise.then((oembed) => oembed?.authorName ?? null)
        : Promise.resolve(facebookPost?.author ? publicFacebookAuthor(facebookPost.author, sourceUrl) : null)

    // One LLM pass over the content. `transcript`, when given, is the video's
    // captions — the second-pass source for a YouTube link (below).
    async function extractWithLlm(transcript?: string): Promise<RecipeData> {
      // A foreign source gets the localization rules and a stronger model (#524);
      // a Polish one keeps the prompt and model it always had.
      const foreignSource = detectSourceLanguage(`${transcript ?? ''}\n${markdown || html}`) === 'foreign'
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: foreignSource ? FOREIGN_EXTRACTION_MODEL : EXTRACTION_MODEL,
          messages: [
            {
              role: 'system',
              content: `You are a recipe extraction expert. Extract recipe information from user-provided content.
Return ONLY valid JSON (no markdown, no explanations) with this exact structure:
{
  "title": "Recipe title in Polish",
  "ingredients": [
      {"name": "ingredient name", "amount": "quantity or empty string", "unit": "unit or empty string", "alt": "household measure or empty string", "section": "section heading or empty string"}
  ],
  "steps": [{"text": "Step 1 description", "image": "image URL from the content that shows THIS step, or null"}],
  "category": "one of: ${RECIPE_CATEGORIES.map(c => c.value).join(', ')}",
  "prepTimeMinutes": integer or null,
  "cookTimeMinutes": integer or null,
  "totalTimeMinutes": integer or null,
  "timesEstimated": boolean,
  "servings": integer or null
}
Rules:
- The page often includes navigation, related/popular posts widgets, comments and ads. Focus ONLY on the PRIMARY recipe — usually the post-body content under the page's main heading or og:title. Ignore everything in sidebars, "Popular posts" / "Related posts" lists, comments, ad slots, navigation and footers.
- Ingredient sections: many recipes split ingredients into named parts (e.g. "Podmłoda", "Ciasto właściwe", "Masa waniliowa", "Masa truskawkowa", "Spód", "Krem", "Dodatkowo"). When the source groups ingredients under such a heading, set "section" to that heading (in Polish, keep it short) for every ingredient in that group, preserving the source order so groups stay contiguous. If the ingredients are a single ungrouped list, use an empty string for "section" on every ingredient.
- Translate to Polish; convert US units to metric (1 cup ≈ 240ml, 1 tbsp ≈ 15ml) and keep the precise metric value in "amount"/"unit".
- Alternative measure ("alt"): ONLY a quantity in a HOUSEHOLD unit that the source states next to the precise amount — szklanki, łyżki, łyżeczki, kostki, garście, plasterki. Copy it VERBATIM, keeping the source's own wording: "3 szklanki", "około 1,5 szklanki", "do 1/3 szklanki", "3/4 kostki". Never add, drop or reword an approximation like "około"/"ok." the source did not use (source "3 szklanki" → "3 szklanki", NOT "około 3 szklanki"). Keep the precise figure in "amount"/"unit"; for a US household measure you convert to metric (e.g. "1 cup flour"), keep the metric in "amount"/"unit" and the stated cups/sticks/spoons in "alt".
- "alt" is a measure, never a note — but never drop the note either. A size ("duże"), purpose ("do dekoracji", "do posypania"), packaging ("małe opakowanie"), brand, or preparation ("grubo starte") describes the ingredient, so keep it in "name" (e.g. name "orzechy włoskie do dekoracji", "marchewka grubo starta"), and leave "alt" empty — "alt" carries only a household measure.
- Never calculate, estimate, guess or infer an "alt" from the metric amount or from your own knowledge. If the source gives only weight or volume with no household unit beside it (e.g. "300 g startej marchewki"), leave "alt" an empty string. A wrong or invented measure is worse than none.
- Times are in MINUTES as integers. "Pół godziny" → 30. "1.5 godz" → 90. "Around an hour" → 60.
- prepTimeMinutes = active hands-on prep (chopping, mixing). cookTimeMinutes = cooking/baking. totalTimeMinutes = end-to-end including passive periods (marinating, rising, cooling). Do NOT assume total = prep + cook — passive time can make total larger.
- Category: cookies, biscuits, gingerbread cookies, macarons and crescent rolls ("ciasteczka", "herbatniki", "pierniczki", "makaroniki", "rogaliki", "faworki") are "ciasteczka". Cakes, tortes, cheesecakes, gingerbread cakes, sponge cakes and apple pies ("ciasto", "tort", "sernik", "piernik", "biszkopt", "szarlotka", "mazurek", "babka", named layer cakes like "Marysieńka", no-bake layer cakes "bez pieczenia") are "ciasta". Reserve "desery" for non-cake sweets only: sweet muffins and cupcakes ("babeczki", "muffiny"), ice cream, doughnuts ("pączki"), choux ("ptysie"), tiramisu, creams/mousses, jellies ("galaretka"), sweet yeast buns ("drożdżówki", "jagodzianki", "ślimaczki").
- Category: bread and savoury rolls ("chleb", "bułki", "bułeczki", "bagietki", "kajzerki", "langosze", "paluchy chlebowe") are "pieczywo", not "obiady" or "sniadania". Sweet yeast buns (drożdżówki, jagodzianki) stay "desery", rogaliki "ciasteczka".
- Category: salads and slaws ("sałatka", "surówka", "coleslaw") are "salatki", not "przekaski" or "inne"; preserves in jars for winter ("na zimę") are "inne".
- Category: homemade syrups, tinctures and herbal remedies made for health ("syrop na odporność/na kaszel", "mikstura na zatoki", "napar prozdrowotny") are "syropy". Everyday drinks (lemoniada, herbata, kompot, soki, koktajle) stay "napoje".
- Title is never null: when the source gives no dish name (a headline like "This recipe will amaze you!"), name the dish in Polish from its ingredients.
- Title names the dish the way a menu would: not a question or how-to ("Jak zrobić domowe lody?" → "Domowe lody"), no praise words ("najlepszy", "pyszny", "idealny"), no first person ("moje", "mojej mamy") and no add-ons like "+ przepis na lukier". Proper names keep their capitals ("Prince Polo", "KFC", "Boże Narodzenie").
- Steps: only the method the source states. A post that lists ingredients and leaves the method to its video or photo gets an empty "steps" array — do not invent one.
- ${STEP_FORM_RULE}
- ${STEP_CONTENT_RULE}
- Each step is an object {"text": "...", "image": "..." | null}. "text" is the instruction (same rules as above). "image": a photo that illustrates THIS step. Use ONLY an image URL that appears verbatim in the provided Page HTML (an <img> src/data-src inside or right next to this step, or a schema.org HowToStep image) or in the Page markdown (an image ![…](url) inside or right after this step's text) — copy it EXACTLY, do not shorten, guess, or build one. NEVER use the dish's main/cover photo, a logo, an avatar, an ad or a related-recipe thumbnail. When a step has no clearly matching in-content photo, set "image" to null. Most steps will be null; that is expected.
- Return null for any non-time field the source does not specify. Do not guess.
- Times stated in the source, or computed from durations it states (a sum of step times, a stated "razem 1,5 godz"), are source data: set "timesEstimated" to false.
- When the source gives no time, you may estimate it from your knowledge of the dish, but then set "timesEstimated" to true. Set it to true whenever ANY non-null time comes from your own knowledge rather than the source.
- When estimating, include passive periods (rising, proofing, marinating, chilling, setting, resting) in totalTimeMinutes. If the recipe clearly has a long passive step whose length you cannot tell, return null for totalTimeMinutes rather than a number that ignores it.
- All three times null → "timesEstimated": false.
- servings: only a number of servings the source states ("na 4 porcje", "dla 6 osób", "Serves 4", "4 portions"). A range ("4–6 porcji"), a yield in pieces, tins or litres ("24 sztuki", "1 tortownica"), or no statement at all → null. Never estimate it.
- Best-effort if content incomplete.${foreignSource ? FOREIGN_SOURCE_RULES : ''}`,
            },
            {
              role: 'user',
              // Cap each field — Firecrawl with onlyMainContent: false on a
              // classic blog template can return tens of KB once the
              // sidebar, archive, popular-posts widget and labels are kept.
              // the model extracts the recipe from the first few KB; the
              // tail is sidebar noise and inflates latency past the timeout.
              // The transcript goes first: it is the recipe when it is there
              // at all, and it must not be pushed out by a long description.
              content:
                `Extract recipe from this content:\nTitle hint: ${sharedTitle || 'unknown'}\nExtra text: ${sharedText || ''}\n\n` +
                (transcript
                  ? `Video transcript (auto-generated captions, spoken recipe — may contain speech-recognition errors in ingredient names):\n${transcript.slice(0, 20_000)}\n\n`
                  : '') +
                `Page markdown:\n${markdown.slice(0, 20_000)}\n\nPage HTML:\n${html.slice(0, 20_000)}`,
            },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(60_000),
      })

      if (!openaiResponse.ok) {
        // OpenAI's own message says which limit or input it hit.
        const detail = await openaiResponse
          .json()
          .then((body) => (typeof body?.error?.message === 'string' ? ` — ${body.error.message.slice(0, 200)}` : ''))
          .catch(() => '')
        throw new Error(`OpenAI failed: ${httpStatus(openaiResponse)}${detail}`)
      }

      const openaiData = await openaiResponse.json()
      const content = openaiData.choices?.[0]?.message?.content
      if (!content) throw new Error('No response from OpenAI')

      // JSON mode should rule out a ```json fence, but strip one anyway: a
      // parser error is not something to show in the bell.
      let parsed: RecipeData
      try {
        parsed = JSON.parse(content.trim().replace(/^```(?:json)?\s*|\s*```$/g, '')) as RecipeData
      } catch {
        throw new Error(LLM_UNREADABLE)
      }

      // recipes.category is a strict enum: one off-list value fails the insert
      // and throws the whole extraction away.
      const { category, coerced } = toRecipeCategory(parsed.category)
      if (coerced) console.warn('[extract-recipe] unknown category from LLM, using inne:', parsed.category)
      // A missing method comes back as null as often as []; the gate below
      // and the steps column both want the list. Steps now arrive as
      // {text, image}; split them so `steps` stays a string[] (its many
      // consumers and the column) and the per-step images ride alongside.
      // servings must fit the column (1–99) or it fails the insert.
      // Ingredients without a string name are dropped (dedup trims `name`), and
      // a time the int columns cannot take ("15-20", 37.5) becomes null (#381).
      const { steps, images: stepImages } = splitLlmSteps(parsed.steps)
      return {
        ...parsed,
        ingredients: toIngredients(parsed.ingredients),
        steps,
        stepImages,
        category,
        servings: toServings(parsed.servings),
        prepTimeMinutes: toMinutes(parsed.prepTimeMinutes),
        cookTimeMinutes: toMinutes(parsed.cookTimeMinutes),
        totalTimeMinutes: toMinutes(parsed.totalTimeMinutes),
      }
    }

    // The user's other recipes, for the labelling pass below; read while the
    // LLM extracts. A failed read only costs the note its comparison.
    const existingRecipesQuery = supabase
      .from('recipes')
      .select('title, description, source_url')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100)

    // The existing dish vocabulary (E01-S21), read alongside so classifyDish can
    // reuse a name already in use instead of coining a near-synonym.
    const dishVocabularyQuery = supabase.rpc('dish_vocabulary')

    let recipeJSON = inputIsJunk ? null : await extractWithLlm()

    // YouTube second pass: the description is where channels paste the
    // recipe, so it is tried first and alone. Only when it yields no usable
    // recipe — no ingredients, or no steps — fetch the captions and run the
    // extraction again with the spoken video in front of the LLM. Costs two
    // fetches and one more OpenAI call, and only for videos that need it.
    if (canTryTranscript && (recipeJSON == null || !isExtractedRecipeUsable(recipeJSON))) {
      const fromDescription = recipeJSON
      const transcript = await fetchYoutubeTranscript(youtubeId, { fetch })
      if (transcript) {
        console.log('[extract-recipe] description had no recipe; retrying with transcript for', youtubeId)
        recipeJSON = await extractWithLlm(transcript)
      } else {
        console.warn('[extract-recipe] no transcript available for', youtubeId)
      }
      // The captions found no steps either (a music-only video, or auto
      // captions in the wrong language). The author's own ingredient list
      // beats whatever the LLM made of them; the method is in the video, which
      // the recipe page embeds.
      if (
        (recipeJSON == null || !isExtractedRecipeUsable(recipeJSON)) &&
        fromDescription != null &&
        isExtractedRecipeUsable(fromDescription, { stepsOptional: true })
      ) {
        recipeJSON = fromDescription
      }
    }

    // Whether the video (if any) actually embeds. Needed below to decide what
    // to store; resolved here (the probe ran alongside the LLM, so this awaits
    // nothing) to also word a private video's failure precisely.
    const youtubeOembed = await youtubeOembedPromise
    const embeddableYoutubeId = youtubeId != null && youtubeOembed != null ? youtubeId : null

    // A YouTube link with an empty description and no captions never sent
    // anything to the LLM. When its video also won't embed, that is almost
    // always because it is private — say so; otherwise word it like any other
    // unreadable page.
    if (recipeJSON == null) {
      throw new Error(sourceType === 'youtube' && embeddableYoutubeId == null ? YOUTUBE_UNAVAILABLE : UNREADABLE_PAGE)
    }

    if (!recipeJSON.title || typeof recipeJSON.title !== 'string') {
      throw new Error(
        fromPostCaption ? FB_CAPTION_NO_RECIPE : 'No recipe title extracted — source page may not contain a recipe',
      )
    }

    // Output-side gate (Risk 2): reject body-less recipes before any DB write.
    // Catches the case where the LLM returns a valid title but empty ingredients
    // or steps — the title-only check above doesn't catch this. A video (a
    // Facebook post's caption, a YouTube description) may list only the
    // ingredients and show the method on screen; no retry will find steps the
    // author never wrote down.
    const methodMayBeOnScreen = fromPostCaption || sourceType === 'youtube'
    if (!isExtractedRecipeUsable(recipeJSON, { stepsOptional: methodMayBeOnScreen })) {
      throw new Error(
        fromPostCaption
          ? FB_CAPTION_NO_RECIPE
          : 'Extracted content has no usable recipe (title present but no ingredients or steps)',
      )
    }

    // The same recipe saved before from another post — its author published
    // it twice — by this user or anyone else. Link this share to it rather
    // than keep a "-2" copy; checked before the labelling call, which it makes
    // unnecessary.
    if (!forceRefresh) {
      // The author gates the near-identical-ingredients tier of findSameRecipe
      // (the #639/#894 reposted-shortbread case); resolved here from the probe
      // that already ran alongside the LLM, so this awaits nothing new.
      const author = await sourceAuthorPromise
      const same = await findSameRecipe(supabase, null, { ...recipeJSON, author }, userId)
      if (same) {
        console.log('[extract-recipe] same recipe already saved from another post:', same.slug)
        return await linkToSaved(same)
      }
    }

    const timesEstimated = timesAreEstimated(recipeJSON)
    // The page's own JSON-LD recipeYield is read deterministically and beats the
    // LLM's reading of the text; the full-page embed scan keeps the <script>
    // blocks a main-content scrape may drop.
    const servings = jsonLdServings(html) ?? jsonLdServings(embedHtml) ?? recipeJSON.servings

    // Per-step photos (ZMIANA zdjęcia kroków): the LLM's in-content pick per step,
    // kept only when the URL really is in the page, filled from the page's
    // schema.org HowToStep images where they line up. Archived once the row exists.
    const stepImageSources = buildStepImageSources({
      steps: recipeJSON.steps,
      llmImages: recipeJSON.stepImages ?? [],
      howToImages: jsonLdHowToStepImages(html, sourceUrl ?? undefined),
      // The markdown too: the LLM may take a step's photo from there (a reader
      // page pairs each `![…](url)` with its step, inside the slice it reads).
      html: `${html}\n${embedHtml}\n${markdown}`,
      pageUrl: sourceUrl ?? undefined,
      coverUrl: ogImage,
    })

    // Title casing, the distinguishing note and the tags, judged against the
    // user's own recipes (minus this one, on a refresh) so the note tells
    // same-titled ones apart. The dish vocabulary is read alongside.
    const [{ data: existingRecipes }, vocabularyResult] = await Promise.all([existingRecipesQuery, dishVocabularyQuery])
    // An errored RPC (migration not applied, grant missing) yields an empty
    // vocabulary that looks like the legitimate bootstrap state, so the classifier
    // could coin a synonym and stamp it. Log it so the two cases are told apart.
    if (vocabularyResult.error) {
      console.warn('[extract-recipe] dish_vocabulary RPC failed; classifying without existing names:', vocabularyResult.error)
    }
    const vocabulary = (vocabularyResult.data ?? []) as DishVocabularyEntry[]
    // A truncated vocabulary would silently split dish groups; the RPC returns
    // one row per dish, well under PostgREST's row cap today. Warn (never fail a
    // save) if it ever approaches it.
    if (vocabulary.length >= 1000) {
      console.warn('[extract-recipe] dish vocabulary near the PostgREST row cap:', vocabulary.length)
    }

    // Labelling and the dish classification (E01-S21) run in parallel over the
    // same extracted recipe; the variant note needs the dish, so it comes after.
    const deps = { fetch, apiKey: process.env.OPENAI_API_KEY }
    const [labels, dishResult] = await Promise.all([
      labelRecipe(
        recipeJSON,
        (existingRecipes ?? []).filter((r) => r.source_url !== sourceUrl && r.source_url !== sharedUrl),
        deps,
      ),
      classifyDish(recipeJSON, vocabulary, deps),
    ])
    const { title, description, metaDescription, tags } = labels

    // The variant note: only for a classified dish, told apart from its (≤12)
    // siblings. Siblings read via the service client (recipes is owner-only RLS).
    let variantNote: string | null = null
    if (dishResult.dish) {
      const { data: siblings } = await supabase
        .from('recipes')
        .select('title, ingredients, variant_note')
        .eq('dish', dishResult.dish)
        .limit(12)
      variantNote = await writeVariantNote(
        { dish: dishResult.dish, title: recipeJSON.title, ingredients: recipeJSON.ingredients, steps: recipeJSON.steps },
        (siblings ?? []) as VariantNoteSibling[],
        deps,
      )
    }

    // The four dish columns to write — only when the classification call
    // SUCCEEDED (even a successful null, which records the review). A failed call
    // leaves them null for a later #298 re-run (`where dish_classified_at is null`).
    const dishColumns: Record<string, string | null> = dishResult.classified
      ? {
          dish: dishResult.dish,
          dish_accusative: dishResult.dishAccusative,
          variant_note: variantNote,
          dish_classified_at: new Date().toISOString(),
        }
      : {}

    const sourceAuthor = await sourceAuthorPromise
    // The ingredient-set fingerprint persisted for the title-independent dedup
    // (findSameRecipe above already read it to catch a near-simultaneous twin).
    const ingredientFp = await ingredientFingerprint(recipeJSON.ingredients)

    // Force refresh ("Odśwież przepis"): overwrite the existing recipe for
    // this (user, source_url) in place. The normal path below dedups and
    // gap-fills, so it can never replace already-populated fields. We keep
    // the existing slug so the recipe URL stays stable.
    if (forceRefresh) {
      // A refresh must not regroup a reviewed recipe, including a reviewed null
      // (an owner override): write the dish columns only when this row was never
      // classified (dish_classified_at is null). Skip the pre-read entirely when
      // the classification produced nothing to write.
      let refreshDishColumns: Record<string, string | null> = {}
      if (Object.keys(dishColumns).length > 0) {
        const { data: existingDish } = await supabase
          .from('recipes')
          .select('dish_classified_at')
          .eq('user_id', userId)
          .eq('source_url', sharedUrl)
          .maybeSingle()
        if (existingDish?.dish_classified_at == null) refreshDishColumns = dishColumns
      }

      const { data: refreshed, error: refreshError } = await supabase
        .from('recipes')
        .update({
          title,
          ingredients: recipeJSON.ingredients,
          steps: recipeJSON.steps,
          category: recipeJSON.category,
          description,
          meta_description: metaDescription,
          tags,
          ingredient_fingerprint: ingredientFp,
          source_type: sourceType,
          // Found an embed this run: store it only when it still embeds, which
          // clears a video that has since gone private; found none (the page
          // lost the embed) keeps the old id. The author is kept the same way.
          ...(youtubeId != null ? { youtube_id: embeddableYoutubeId } : {}),
          ...(sourceAuthor != null ? { source_author: sourceAuthor } : {}),
          prep_time_minutes: recipeJSON.prepTimeMinutes ?? null,
          cook_time_minutes: recipeJSON.cookTimeMinutes ?? null,
          total_time_minutes: recipeJSON.totalTimeMinutes ?? null,
          times_estimated: timesEstimated,
          servings,
          ...refreshDishColumns,
          extracted_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('source_url', sharedUrl)
        .select('id')
        .single()

      if (refreshError || !refreshed) {
        throw new Error(`Refresh update failed: ${refreshError?.message ?? 'recipe not found'}`)
      }

      const { error: shareError } = await supabase
        .from('recipe_shares')
        .update({ recipe_id: refreshed.id, status: 'completed' })
        .eq('id', shareId)
      // Thrown, so the catch below fails the share rather than leaving it pending (#382).
      if (shareError) throw new Error(`Share update failed: ${shareError.message}`)

      // A refresh replaces the gallery outright and is how an existing recipe
      // gains step photos from a better extraction (see storeCoverAndGallery).
      return await withImages(
        { recipeId: refreshed.id, title, category: recipeJSON.category, status: 'refreshed' },
        { recipeId: refreshed.id, userId, cover: ogImage, gallery, stepSources: stepImageSources, replace: true },
      )
    }

    const baseSlug = recipeSlug(title)
    // Per-user unique keys now; global ones once the existing duplicates are
    // collapsed (E01-S03a) and the slug migration lands (E01-S03b). Both
    // generations are matched below, so the deploy gap is covered: the per-user
    // key names the user's own row, the global one the single row for that key,
    // whoever owns it.
    const SLUG_KEY = 'recipes_user_id_slug_key'
    const GLOBAL_SLUG_KEY = 'recipes_slug_uniq'
    const URL_KEY = 'recipes_user_source_url_uniq'
    const GLOBAL_URL_KEY = 'recipes_source_url_uniq'
    const FINGERPRINT_KEY = 'recipes_user_source_fingerprint_uniq'
    const GLOBAL_FINGERPRINT_KEY = 'recipes_source_fingerprint_uniq'
    // The numbered suffixes, then a few random ones: a title saved more than
    // NUMBERED_SLUG_ATTEMPTS times still gets a slug instead of failing the share.
    const MAX_ATTEMPTS = NUMBERED_SLUG_ATTEMPTS + 3

    let recipe: { id: number } | null = null
    // Set when this run saved a row whose photos it found: a new recipe, or a
    // gap-filled one (whose stored photos the archived ones replace).
    let imageJob: RecipeImageJob | null = null
    let lastInsertError: { message: string } | null = null

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const slug = recipeSlugCandidate(baseSlug, attempt)

      const { data, error } = await supabase
        .from('recipes')
        .insert({
          user_id: userId,
          title,
          slug,
          description,
          meta_description: metaDescription,
          tags,
          // Archive-first invariant: insert null, then the archive step below
          // fills image_url with a Supabase URL (or leaves it null on failure).
          image_url: null,
          ingredients: recipeJSON.ingredients,
          steps: recipeJSON.steps,
          ingredient_fingerprint: ingredientFp,
          source_type: sourceType,
          source_url: sourceUrl,
          source_fingerprint: sourceFingerprint,
          source_author: sourceAuthor,
          youtube_id: embeddableYoutubeId,
          category: recipeJSON.category,
          prep_time_minutes: recipeJSON.prepTimeMinutes ?? null,
          cook_time_minutes: recipeJSON.cookTimeMinutes ?? null,
          total_time_minutes: recipeJSON.totalTimeMinutes ?? null,
          times_estimated: timesEstimated,
          servings,
          ...dishColumns,
          extracted_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (data) {
        recipe = data
        // The og:image, gallery and per-step photos are archived once the row
        // exists; until then image_url stays null (NoPhoto placeholder).
        imageJob = { recipeId: data.id, userId, cover: ogImage, gallery, stepSources: stepImageSources, replace: false }
        break
      } else {
        lastInsertError = error
      }

      // Fingerprint collision: a share of the same text from another post
      // won the race. Link this share to that recipe — or, when it is someone
      // else's, add it to the user's favorites.
      const ownFingerprint = error?.message.includes(FINGERPRINT_KEY) ?? false
      if (sourceFingerprint && (ownFingerprint || error?.message.includes(GLOBAL_FINGERPRINT_KEY))) {
        const existing = await findRecipeBySourceFingerprint(supabase, ownFingerprint ? userId : null, sourceFingerprint)
        if (existing) {
          if (!ownFingerprint && existing.user_id !== userId) return await linkToSaved(existing)
          recipe = { id: existing.id }
          break
        }
      }

      // URL collision: a parallel share won the race, OR this is a refresh
      // run for an already-stored recipe. Link this share to the existing
      // recipe and gap-fill any null fields with newly extracted values
      // (we never overwrite already-populated fields). Someone else's recipe
      // is never gap-filled: it goes to the user's favorites untouched.
      const ownUrl = error?.message.includes(URL_KEY) ?? false
      if (ownUrl || error?.message.includes(GLOBAL_URL_KEY)) {
        const existingQuery = supabase
          .from('recipes')
          .select('id, user_id, title, category, prep_time_minutes, cook_time_minutes, total_time_minutes, servings, image_url, youtube_id, source_author, description, meta_description, tags, ingredient_fingerprint, dish_classified_at')
        const { data: existing } = await (ownUrl ? existingQuery.eq('user_id', userId) : existingQuery)
          .eq('source_url', sourceUrl)
          .single()

        if (existing && !ownUrl && existing.user_id !== userId) return await linkToSaved(existing)

        if (existing) {
          const gapFill: Database['public']['Tables']['recipes']['Update'] = {}
          if (existing.prep_time_minutes == null && recipeJSON.prepTimeMinutes != null) {
            gapFill.prep_time_minutes = recipeJSON.prepTimeMinutes
          }
          if (existing.cook_time_minutes == null && recipeJSON.cookTimeMinutes != null) {
            gapFill.cook_time_minutes = recipeJSON.cookTimeMinutes
          }
          if (existing.total_time_minutes == null && recipeJSON.totalTimeMinutes != null) {
            gapFill.total_time_minutes = recipeJSON.totalTimeMinutes
          }
          // A time filled in from an estimate makes the row's times estimated;
          // stated times filled in next to an earlier estimate leave the flag.
          if (
            timesEstimated &&
            (gapFill.prep_time_minutes != null || gapFill.cook_time_minutes != null || gapFill.total_time_minutes != null)
          ) {
            gapFill.times_estimated = true
          }
          if (existing.servings == null && servings != null) {
            gapFill.servings = servings
          }
          if (existing.youtube_id == null && embeddableYoutubeId != null) {
            gapFill.youtube_id = embeddableYoutubeId
          }
          if (existing.source_author == null && sourceAuthor != null) {
            gapFill.source_author = sourceAuthor
          }
          if (existing.description == null && description != null) {
            gapFill.description = description
          }
          if (existing.meta_description == null && metaDescription != null) {
            gapFill.meta_description = metaDescription
          }
          if (!existing.tags?.length && tags.length > 0) {
            gapFill.tags = tags
          }
          // Only backfill a missing fingerprint — gap-fill never rewrites the
          // existing row's `ingredients`, so its stored fingerprint stays valid.
          if (existing.ingredient_fingerprint == null && ingredientFp != null) {
            gapFill.ingredient_fingerprint = ingredientFp
          }
          // Archive flow: an archived cover always overwrites image_url — even a
          // legacy external link. That's how the backfill
          // (scripts/backfill-archive-covers.ts, scripts/archive-recipe-images.ts)
          // moves existing recipes onto Supabase Storage. A failed archive leaves
          // the existing value alone (never writes a new external link). The
          // gallery and step photos follow the same rule: archived photos replace
          // whatever is there, which is how the backfill gives old recipes them.
          imageJob = { recipeId: existing.id, userId, cover: ogImage, gallery, stepSources: stepImageSources, replace: false }

          // Fill the dish columns only when this row was never classified (never
          // overwrite a reviewed value), the same guard as a refresh.
          const dishGapFill = existing.dish_classified_at == null ? dishColumns : {}
          const merged = { ...gapFill, ...dishGapFill }
          if (Object.keys(merged).length > 0) {
            await supabase.from('recipes').update(merged).eq('id', existing.id)
          }

          recipe = { id: existing.id }
          break
        }
      }

      // Slug collision against a different URL with the same title: retry with
      // a `-2`, `-3`, … suffix, then a random one. Global (E01-S03b) or per-user,
      // same handling — the retry lands the lowest free suffix because the DB
      // rejects taken ones.
      if (error?.message.includes(SLUG_KEY) || error?.message.includes(GLOBAL_SLUG_KEY)) continue

      // Any other error is terminal.
      break
    }

    if (!recipe) {
      throw new Error(`Database insert failed: ${lastInsertError?.message ?? 'exhausted slug retry attempts'}`)
    }

    const { error: shareError } = await supabase
      .from('recipe_shares')
      .update({ recipe_id: recipe.id, status: 'completed' })
      .eq('id', shareId)
    // Thrown, so the catch below fails the share rather than leaving it pending (#382).
    if (shareError) throw new Error(`Share update failed: ${shareError.message}`)

    const result = { recipeId: recipe.id, title, category: recipeJSON.category, status: 'completed' }
    return imageJob ? await withImages(result, imageJob) : result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    const { error: failError } = await supabase
      .from('recipe_shares')
      .update({ status: 'failed', error_message: errorMessage })
      .eq('id', shareId)
    // The original error is what Inngest retries on; this one is only logged.
    // A share left pending is caught later as stale (#382).
    if (failError) console.error('[extract-recipe] Failed to mark share failed:', failError.message)

    throw error
  }
}
