import { createClient } from '@supabase/supabase-js'
import { inngest } from './client'
import { SUPABASE_URL, getSuabaseServiceRoleKey } from '@/lib/env'
import { buildFirecrawlOptions } from '@/lib/firecrawl'

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
}

export const extractRecipe = inngest.createFunction(
  {
    id: 'extract-recipe',
    retries: 3,
  },
  async ({ event }) => {
    const { shareId, sharedUrl, sharedTitle, sharedText, userId, sourceType = 'facebook_text' } = event.data as ExtractRecipeEvent

    try {
      // Step 1: Fetch page with Firecrawl
      const firecrawlData = await (async () => {
        const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(buildFirecrawlOptions(sharedUrl, sourceType)),
          signal: AbortSignal.timeout(45_000),
        })

        if (!response.ok) {
          throw new Error(`Firecrawl failed: ${response.statusText}`)
        }

        return response.json()
      })()

      const markdown = firecrawlData.markdown || ''
      const html = firecrawlData.html || ''
      const ogImage = firecrawlData.metadata?.ogImage

      // Step 2: Extract recipe with OpenAI
      const recipeJSON = await (async () => {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
    {"name": "ingredient name", "amount": "quantity or empty", "unit": "unit or empty"},
    ...
  ],
  "steps": ["Step 1 description", "Step 2 description", ...],
  "category": "one of: obiady, zupy, desery, sniadania, przekaski, wegetarianskie, napoje, inne",
  "notes": "any extraction notes or quality issues"
}

Rules:
- Translate to Polish if source is English
- Convert US units to metric (approximate is fine: 1 cup ≈ 240ml, 1 tbsp ≈ 15ml)
- If ingredients/steps are incomplete, use best-effort extraction
- Mark in notes if extraction is incomplete
- If no recipe found, return null for ingredients/steps but set notes: "no recipe content found"`,
              },
              {
                role: 'user',
                content: `Extract recipe from this content:
Title hint: ${sharedTitle || 'unknown'}
Text hint: ${sharedText || ''}

Page markdown:
${markdown}

Page HTML:
${html}`,
              },
            ],
            temperature: 0.3,
          }),
          signal: AbortSignal.timeout(30_000),
        })

        if (!response.ok) {
          throw new Error(`OpenAI failed: ${response.statusText}`)
        }

        const data = await response.json()
        const content = data.choices?.[0]?.message?.content

        if (!content) {
          throw new Error('No response from OpenAI')
        }

        return JSON.parse(content) as RecipeData
      })()

      // Step 3: Insert recipe into Supabase
      const recipe = await (async () => {
        const supabase = createClient(SUPABASE_URL, getSuabaseServiceRoleKey(), {
          auth: { autoRefreshToken: false, persistSession: false },
        })

        const slug = recipeJSON.title
          .toLowerCase()
          .replace(/[^a-ząćęłńóśźż0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .substring(0, 100)

        const { data, error } = await supabase
          .from('recipes')
          .insert({
            user_id: userId,
            title: recipeJSON.title,
            slug,
            description: null,
            image_url: recipeJSON.imageUrl || ogImage,
            ingredients: recipeJSON.ingredients,
            steps: recipeJSON.steps,
            source_type: sourceType,
            source_url: sharedUrl,
            category: recipeJSON.category,
            extracted_at: new Date().toISOString(),
          })
          .select()
          .single()

        if (error) {
          throw new Error(`Database insert failed: ${error.message}`)
        }

        return data
      })()

      // Step 4: Update recipe_shares status
      await (async () => {
        const supabase = createClient(SUPABASE_URL, getSuabaseServiceRoleKey(), {
          auth: { autoRefreshToken: false, persistSession: false },
        })

        const { error } = await supabase
          .from('recipe_shares')
          .update({
            recipe_id: recipe.id,
            status: 'completed',
          })
          .eq('id', shareId)

        if (error) {
          console.warn(`Failed to update recipe_shares: ${error.message}`)
        }
      })()

      return {
        recipeId: recipe.id,
        title: recipeJSON.title,
        category: recipeJSON.category,
        status: 'completed',
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Update recipe_shares status to failed
      await (async () => {
        const supabase = createClient(SUPABASE_URL, getSuabaseServiceRoleKey(), {
          auth: { autoRefreshToken: false, persistSession: false },
        })

        await supabase
          .from('recipe_shares')
          .update({
            status: 'failed',
            error_message: errorMessage,
          })
          .eq('id', shareId)
      })()

      throw error
    }
  }
)
