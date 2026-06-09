import { task } from '@trigger.dev/sdk/v3'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, getSuabaseServiceRoleKey } from '@/lib/env'
import { buildFirecrawlOptions } from '@/lib/firecrawl'

interface ExtractRecipeInput {
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

export const extractRecipeTask = task({
  id: 'extract-recipe',
  run: async (input: ExtractRecipeInput) => {
    const { shareId, sharedUrl, sharedTitle, sharedText, userId, sourceType = 'facebook_text' } = input

    try {
      // Step 1: Fetch page with Firecrawl
      const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildFirecrawlOptions(sharedUrl, sourceType)),
      })

      if (!firecrawlResponse.ok) {
        throw new Error(`Firecrawl failed: ${firecrawlResponse.statusText}`)
      }

      const firecrawlData = await firecrawlResponse.json()
      const markdown = firecrawlData.markdown || ''
      const html = firecrawlData.html || ''
      const ogImage = firecrawlData.metadata?.ogImage

      // Step 2: Extract recipe with OpenAI
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
      })

      if (!openaiResponse.ok) {
        throw new Error(`OpenAI failed: ${openaiResponse.statusText}`)
      }

      const openaiData = await openaiResponse.json()
      const content = openaiData.choices?.[0]?.message?.content

      if (!content) {
        throw new Error('No response from OpenAI')
      }

      let recipeData: RecipeData
      try {
        recipeData = JSON.parse(content)
      } catch (e) {
        throw new Error(`Failed to parse OpenAI response: ${content}`)
      }

      // Step 3: Insert recipe into Supabase
      const supabase = createClient(SUPABASE_URL, getSuabaseServiceRoleKey(), {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })

      // Create slug from title
      const slug = recipeData.title
        .toLowerCase()
        .replace(/[^a-ząćęłńóśźż0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 100)

      const { data: recipe, error: recipeError } = await supabase
        .from('recipes')
        .insert({
          user_id: userId,
          title: recipeData.title,
          slug,
          description: null,
          image_url: recipeData.imageUrl || ogImage,
          ingredients: recipeData.ingredients,
          steps: recipeData.steps,
          source_type: sourceType,
          source_url: sharedUrl,
          category: recipeData.category,
          extracted_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (recipeError) {
        throw new Error(`Database insert failed: ${recipeError.message}`)
      }

      // Step 4: Update recipe_shares status to completed
      const { error: shareError } = await supabase
        .from('recipe_shares')
        .update({
          recipe_id: recipe.id,
          status: 'completed',
          attempts: (await supabase
            .from('recipe_shares')
            .select('attempts')
            .eq('id', shareId)
            .single()).data?.attempts ?? 0 + 1,
        })
        .eq('id', shareId)

      if (shareError) {
        console.warn(`Failed to update recipe_shares: ${shareError.message}`)
      }

      return {
        recipeId: recipe.id,
        title: recipeData.title,
        category: recipeData.category,
        status: 'completed',
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Update recipe_shares status to failed
      const supabase = createClient(SUPABASE_URL, getSuabaseServiceRoleKey(), {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })

      await supabase
        .from('recipe_shares')
        .update({
          status: 'failed',
          error_message: errorMessage,
          attempts: (await supabase
            .from('recipe_shares')
            .select('attempts')
            .eq('id', shareId)
            .single()).data?.attempts ?? 0 + 1,
        })
        .eq('id', shareId)

      throw error
    }
  },
})
