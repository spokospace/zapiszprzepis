import { createClient } from '@supabase/supabase-js'
import { inngest } from './client'
import { SUPABASE_URL, getSuabaseServiceRoleKey } from '@/lib/env'
import { buildFirecrawlOptions, buildEmbedScanOptions } from '@/lib/firecrawl'
import { slugify } from '@/lib/slugify'
import { archiveImage } from '@/lib/recipe-image-archive'
import { youtubeIdFromUrl, findEmbeddedYoutubeId } from '@/lib/youtube'
import { isBlogspotUrl, fetchBloggerPost } from '@/lib/blogger-feed'
import { looksUnextractable } from '@/lib/content-quality'
import { RECIPE_CATEGORIES } from '@/lib/recipe-categories'

interface ExtractRecipeEvent {
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

interface RecipeData {
  title: string
  ingredients: Array<{ name: string; amount?: string; unit?: string; section?: string }>
  steps: string[]
  category: string
  imageUrl?: string
  prepTimeMinutes?: number | null
  cookTimeMinutes?: number | null
  totalTimeMinutes?: number | null
}

export const extractRecipe = inngest.createFunction(
  { id: 'extract-recipe', retries: 3, triggers: { event: 'recipe/extract' } },
  async ({ event }) => {
    const { shareId, sharedUrl, sharedTitle, sharedText, userId, sourceType = 'facebook_text', force: forceRefresh = false } = event.data as ExtractRecipeEvent

    const supabase = createClient(SUPABASE_URL, getSuabaseServiceRoleKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    try {
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
          throw new Error(`Firecrawl failed: ${response.statusText}`)
        }
        const data = await response.json()
        return data.data ?? {}
      }

      // Recipe text comes from the main-content scrape, retrying with
      // fullContent when a blog template trips Firecrawl's main-content
      // heuristic and leaves just a "Skip to main content" link.
      async function scrapeWithRetry() {
        let s = await firecrawlScrape(buildFirecrawlOptions(sharedUrl, sourceType, { fullContent: false }))
        if (!s.markdown || s.markdown.length < 200) {
          console.warn('[extract-recipe] markdown < 200 chars; retrying with fullContent')
          s = await firecrawlScrape(buildFirecrawlOptions(sharedUrl, sourceType, { fullContent: true }))
        }
        return s
      }

      let markdown = ''
      let html = ''
      let ogImage: string | undefined
      let embedHtml = ''

      // Blogspot: pull the post straight from the Blogger JSON feed instead of
      // rendering with Firecrawl — deterministic, no Google Translate / empty
      // main-content junk. Fall back to Firecrawl when the feed has nothing
      // (custom-domain blogs, disabled feed).
      const bloggerPost = isBlogspotUrl(sharedUrl)
        ? await fetchBloggerPost(sharedUrl).catch((err) => {
            console.warn('[extract-recipe] Blogger feed failed, falling back to Firecrawl:', err)
            return null
          })
        : null

      if (bloggerPost) {
        console.log('[extract-recipe] using Blogger feed for', sharedUrl)
        html = bloggerPost.html
        embedHtml = bloggerPost.html
        ogImage = bloggerPost.image ?? undefined
        // Give the LLM clean text, prefixed with the post title as a strong
        // title signal.
        const text = bloggerPost.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        markdown = bloggerPost.title ? `${bloggerPost.title}\n\n${text}` : text
      } else {
        // For blog sources also run a dedicated full-page scrape in parallel to
        // find an embedded YouTube player — the recipe-text scrape strips
        // iframes (onlyMainContent + BLOG_EXCLUDE_TAGS's 'iframe'). No extra
        // latency (Promise.all); a failure there must not sink the extraction.
        const [scraped, scrapedEmbedHtml] = await Promise.all([
          scrapeWithRetry(),
          sourceType === 'web_blog'
            ? firecrawlScrape(buildEmbedScanOptions(sharedUrl))
                .then((d) => (d.html ?? '') as string)
                .catch((err) => {
                  console.warn('[extract-recipe] embed scan failed:', err)
                  return ''
                })
            : Promise.resolve(''),
        ])
        markdown = scraped.markdown ?? ''
        html = scraped.html ?? ''
        ogImage = scraped.metadata?.ogImage
        embedHtml = scrapedEmbedHtml
      }

      // S-04: capture a YouTube video id for the detail-page embed. Either the
      // shared URL is itself a YouTube link (source_type 'youtube'), or a blog
      // page embeds a player (found in the Blogger feed html / the embed scan).
      const youtubeId = youtubeIdFromUrl(sharedUrl) ?? findEmbeddedYoutubeId(embedHtml || html)

      // Fail fast on junk (Google Translate interstitial, empty main content)
      // before spending an OpenAI call — throwing lets Inngest retry, since the
      // junk is usually transient, and yields a clear error if it persists.
      if (looksUnextractable(markdown) && looksUnextractable(html)) {
        throw new Error('Scraped page had no readable recipe content (possible Google Translate interstitial or render failure)')
      }

      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a recipe extraction expert. Extract recipe information from user-provided content.
Return ONLY valid JSON (no markdown, no explanations) with this exact structure:
{
  "title": "Recipe title in Polish",
  "ingredients": [
    {"name": "ingredient name", "amount": "quantity or empty string", "unit": "unit or empty string", "section": "section heading or empty string"}
  ],
  "steps": ["Step 1 description", "Step 2 description"],
  "category": "one of: ${RECIPE_CATEGORIES.map(c => c.value).join(', ')}",
  "prepTimeMinutes": integer or null,
  "cookTimeMinutes": integer or null,
  "totalTimeMinutes": integer or null
}
Rules:
- The page often includes navigation, related/popular posts widgets, comments and ads. Focus ONLY on the PRIMARY recipe — usually the post-body content under the page's main heading or og:title. Ignore everything in sidebars, "Popular posts" / "Related posts" lists, comments, ad slots, navigation and footers.
- Ingredient sections: many recipes split ingredients into named parts (e.g. "Podmłoda", "Ciasto właściwe", "Masa waniliowa", "Masa truskawkowa", "Spód", "Krem", "Dodatkowo"). When the source groups ingredients under such a heading, set "section" to that heading (in Polish, keep it short) for every ingredient in that group, preserving the source order so groups stay contiguous. If the ingredients are a single ungrouped list, use an empty string for "section" on every ingredient.
- Translate to Polish; convert US units to metric (1 cup ≈ 240ml, 1 tbsp ≈ 15ml).
- Times are in MINUTES as integers. "Pół godziny" → 30. "1.5 godz" → 90. "Around an hour" → 60.
- prepTimeMinutes = active hands-on prep (chopping, mixing). cookTimeMinutes = cooking/baking. totalTimeMinutes = end-to-end including passive periods (marinating, rising, cooling). Do NOT assume total = prep + cook — passive time can make total larger.
- Return null for any field the source does not specify. Do not guess.
- Best-effort if content incomplete.`,
            },
            {
              role: 'user',
              // Cap each field — Firecrawl with onlyMainContent: false on a
              // classic blog template can return tens of KB once the
              // sidebar, archive, popular-posts widget and labels are kept.
              // gpt-4o-mini extracts the recipe from the first few KB; the
              // tail is sidebar noise and inflates latency past the timeout.
              content: `Extract recipe from this content:\nTitle hint: ${sharedTitle || 'unknown'}\nExtra text: ${sharedText || ''}\n\nPage markdown:\n${markdown.slice(0, 20_000)}\n\nPage HTML:\n${html.slice(0, 20_000)}`,
            },
          ],
          temperature: 0.3,
        }),
        signal: AbortSignal.timeout(60_000),
      })

      if (!openaiResponse.ok) {
        throw new Error(`OpenAI failed: ${openaiResponse.statusText}`)
      }

      const openaiData = await openaiResponse.json()
      const content = openaiData.choices?.[0]?.message?.content
      if (!content) throw new Error('No response from OpenAI')

      const recipeJSON = JSON.parse(content) as RecipeData

      if (!recipeJSON.title || typeof recipeJSON.title !== 'string') {
        throw new Error('No recipe title extracted — source page may not contain a recipe')
      }

      // Force refresh ("Odśwież przepis"): overwrite the existing recipe for
      // this (user, source_url) in place. The normal path below dedups and
      // gap-fills, so it can never replace already-populated fields. We keep
      // the existing slug so the recipe URL stays stable.
      if (forceRefresh) {
        const { data: refreshed, error: refreshError } = await supabase
          .from('recipes')
          .update({
            title: recipeJSON.title,
            ingredients: recipeJSON.ingredients,
            steps: recipeJSON.steps,
            category: recipeJSON.category,
            source_type: sourceType,
            youtube_id: youtubeId,
            prep_time_minutes: recipeJSON.prepTimeMinutes ?? null,
            cook_time_minutes: recipeJSON.cookTimeMinutes ?? null,
            total_time_minutes: recipeJSON.totalTimeMinutes ?? null,
            extracted_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('source_url', sharedUrl)
          .select('id')
          .single()

        if (refreshError || !refreshed) {
          throw new Error(`Refresh update failed: ${refreshError?.message ?? 'recipe not found'}`)
        }

        if (ogImage != null) {
          const archivedUrl = await archiveImage(supabase, userId, refreshed.id, ogImage)
          await supabase.from('recipes').update({ image_url: archivedUrl ?? ogImage }).eq('id', refreshed.id)
        }

        await supabase
          .from('recipe_shares')
          .update({ recipe_id: refreshed.id, status: 'completed' })
          .eq('id', shareId)

        return { recipeId: refreshed.id, title: recipeJSON.title, category: recipeJSON.category, status: 'refreshed' }
      }

      const baseSlug = slugify(recipeJSON.title)
      const SLUG_KEY = 'recipes_user_id_slug_key'
      const URL_KEY = 'recipes_user_source_url_uniq'
      const MAX_ATTEMPTS = 10

      let recipe: { id: number } | null = null
      let lastInsertError: { message: string } | null = null

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const slug = attempt === 1 ? baseSlug : `${baseSlug}-${attempt}`

        const { data, error } = await supabase
          .from('recipes')
          .insert({
            user_id: userId,
            title: recipeJSON.title,
            slug,
            description: null,
            image_url: ogImage ?? null,
            ingredients: recipeJSON.ingredients,
            steps: recipeJSON.steps,
            source_type: sourceType,
            source_url: sharedUrl,
            youtube_id: youtubeId,
            category: recipeJSON.category,
            prep_time_minutes: recipeJSON.prepTimeMinutes ?? null,
            cook_time_minutes: recipeJSON.cookTimeMinutes ?? null,
            total_time_minutes: recipeJSON.totalTimeMinutes ?? null,
            extracted_at: new Date().toISOString(),
          })
          .select('id')
          .single()

        if (!data) {
          lastInsertError = error
        }

        if (data) {
          recipe = data
          // Archive the external og:image into Supabase Storage. On failure
          // we keep the external URL already stored in image_url.
          if (ogImage != null) {
            const archivedUrl = await archiveImage(supabase, userId, data.id, ogImage)
            if (archivedUrl != null) {
              await supabase.from('recipes').update({ image_url: archivedUrl }).eq('id', data.id)
            }
          }
          break
        }

        // URL collision: a parallel share won the race, OR this is a refresh
        // run for an already-stored recipe. Link this share to the existing
        // recipe and gap-fill any null fields with newly extracted values
        // (we never overwrite already-populated fields).
        if (error?.message.includes(URL_KEY)) {
          const { data: existing } = await supabase
            .from('recipes')
            .select('id, prep_time_minutes, cook_time_minutes, total_time_minutes, image_url, youtube_id')
            .eq('user_id', userId)
            .eq('source_url', sharedUrl)
            .single()

          if (existing) {
            const gapFill: Record<string, number | string> = {}
            if (existing.prep_time_minutes == null && recipeJSON.prepTimeMinutes != null) {
              gapFill.prep_time_minutes = recipeJSON.prepTimeMinutes
            }
            if (existing.cook_time_minutes == null && recipeJSON.cookTimeMinutes != null) {
              gapFill.cook_time_minutes = recipeJSON.cookTimeMinutes
            }
            if (existing.total_time_minutes == null && recipeJSON.totalTimeMinutes != null) {
              gapFill.total_time_minutes = recipeJSON.totalTimeMinutes
            }
            if (existing.youtube_id == null && youtubeId != null) {
              gapFill.youtube_id = youtubeId
            }
            // Archive flow: when archiveImage returns a Storage URL, always
            // overwrite image_url — even if it's already populated with an
            // external link. That's how scripts/archive-recipe-images.ts
            // backfills existing recipes to be archive-first. External URL
            // is only kept when there was no prior value AND archive failed.
            if (ogImage != null) {
              const archivedUrl = await archiveImage(supabase, userId, existing.id, ogImage)
              if (archivedUrl != null) {
                gapFill.image_url = archivedUrl
              } else if (existing.image_url == null) {
                gapFill.image_url = ogImage
              }
            }

            if (Object.keys(gapFill).length > 0) {
              await supabase.from('recipes').update(gapFill).eq('id', existing.id)
            }

            recipe = { id: existing.id }
            break
          }
        }

        // Slug collision against a different URL with the same title: retry
        // with `-2`, `-3`, … suffix.
        if (error?.message.includes(SLUG_KEY)) continue

        // Any other error is terminal.
        break
      }

      if (!recipe) {
        throw new Error(`Database insert failed: ${lastInsertError?.message ?? 'exhausted slug retry attempts'}`)
      }

      await supabase
        .from('recipe_shares')
        .update({ recipe_id: recipe.id, status: 'completed' })
        .eq('id', shareId)

      return { recipeId: recipe.id, title: recipeJSON.title, category: recipeJSON.category, status: 'completed' }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      await supabase
        .from('recipe_shares')
        .update({ status: 'failed', error_message: errorMessage })
        .eq('id', shareId)

      throw error
    }
  }
)
