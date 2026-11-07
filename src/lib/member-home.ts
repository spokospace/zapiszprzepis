import type { SupabaseClient } from '@supabase/supabase-js'
import { getGreetingName } from '@/lib/first-name'
import { MY_RECIPE_CARD_COLUMNS, type MyRecipeCard } from '@/lib/my-recipes'

/** Cards per home row: 4 fills the desktop row (E01-S31 §2, §5). */
export const HOME_ROW_LIMIT = 4

/** `greetingName` is undefined when the read failed (unlike null: the reader has no name). */
export type MemberHomeData = { greetingName: string | null | undefined; mine: MyRecipeCard[]; favorites: MyRecipeCard[] }

/**
 * What the signed-in home shows beyond the shared page (E01-S31 §5): the name to greet and
 * the newest of the user's own recipes and of their favorites. Favorites are private
 * (owner-only RLS); the recipe of each is embedded from the guest-safe view, as on /ulubione
 * (#231). A failed read leaves its row out.
 */
export async function getMemberHome(supabase: SupabaseClient, userId: string): Promise<MemberHomeData> {
  const [greetingName, mine, favorites] = await Promise.all([
    getGreetingName(supabase, userId),
    supabase
      .from('recipes')
      .select(MY_RECIPE_CARD_COLUMNS)
      .eq('user_id', userId)
      // Recipes staff hid are not offered on the home page (their row lives in „Moje przepisy”).
      .is('hidden_at', null)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(HOME_ROW_LIMIT)
      .returns<MyRecipeCard[]>(),
    supabase
      .from('favorites')
      .select(`recipe:public_recipes(${MY_RECIPE_CARD_COLUMNS})`)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(HOME_ROW_LIMIT)
      .returns<{ recipe: MyRecipeCard | null }[]>(),
  ])
  return {
    greetingName,
    mine: mine.data ?? [],
    favorites: (favorites.data ?? []).map((f) => f.recipe).filter((r): r is MyRecipeCard => Boolean(r)),
  }
}
