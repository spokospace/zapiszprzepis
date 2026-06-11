import { createClient } from '@supabase/supabase-js'
import { inngest } from './client'
import { SUPABASE_URL, getSuabaseServiceRoleKey } from '@/lib/env'
import { buildFirecrawlOptions } from '@/lib/firecrawl'
import { slugify } from '@/lib/slugify'

interface ExtractRecipeEvent {
  shareId: number
  sharedUrl: string
  sharedTitle?: string
  sharedText?: string
  userId: string
  sourceType?: 'facebook_text' | 'web_blog'
}

interface RecipeData {
  title: string
  ingredients: Array<{ name: string; amount?: string; unit?: string }>
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
    const { shareId, sharedUrl, sharedTitle, sharedText, userId, sourceType = 'facebook_text' } = event.data as ExtractRecipeEvent

    const supabase = createClient(SUPABASE_URL, getSuabaseServiceRoleKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    try {
      const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildFirecrawlOptions(sharedUrl, sourceType)),
        signal: AbortSignal.timeout(45_000),
      })

      if (!firecrawlResponse.ok) {
        throw new Error(`Firecrawl failed: ${firecrawlResponse.statusText}`)
      }

      const firecrawlData = await firecrawlResponse.json()
      const { markdown = '', html = '', metadata } = firecrawlData.data ?? {}
      const ogImage = metadata?.ogImage

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
    {"name": "ingredient name", "amount": "quantity or empty string", "unit": "unit or empty string"}
  ],
  "steps": ["Step 1 description", "Step 2 description"],
  "category": "one of: obiady, zupy, desery, sniadania, przekaski, wegetarianskie, napoje, inne",
  "prepTimeMinutes": integer or null,
  "cookTimeMinutes": integer or null,
  "totalTimeMinutes": integer or null
}
Rules:
- Translate to Polish; convert US units to metric (1 cup ≈ 240ml, 1 tbsp ≈ 15ml).
- Times are in MINUTES as integers. "Pół godziny" → 30. "1.5 godz" → 90. "Around an hour" → 60.
- prepTimeMinutes = active hands-on prep (chopping, mixing). cookTimeMinutes = cooking/baking. totalTimeMinutes = end-to-end including passive periods (marinating, rising, cooling). Do NOT assume total = prep + cook — passive time can make total larger.
- Return null for any field the source does not specify. Do not guess.
- Best-effort if content incomplete.`,
            },
            {
              role: 'user',
              content: `Extract recipe from this content:\nTitle hint: ${sharedTitle || 'unknown'}\nExtra text: ${sharedText || ''}\n\nPage markdown:\n${markdown}\n\nPage HTML:\n${html}`,
            },
          ],
          temperature: 0.3,
        }),
        signal: AbortSignal.timeout(30_000),
      })

      if (!openaiResponse.ok) {
        throw new Error(`OpenAI failed: ${openaiResponse.statusText}`)
      }

      const openaiData = await openaiResponse.json()
      const content = openaiData.choices?.[0]?.message?.content
      if (!content) throw new Error('No response from OpenAI')

      const recipeJSON = JSON.parse(content) as RecipeData

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
          break
        }

        // URL collision: a parallel share won the race. Link this share to the
        // already-stored recipe instead of creating a duplicate.
        if (error?.message.includes(URL_KEY)) {
          const { data: existing } = await supabase
            .from('recipes')
            .select('id')
            .eq('user_id', userId)
            .eq('source_url', sharedUrl)
            .single()

          if (existing) {
            recipe = existing
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
