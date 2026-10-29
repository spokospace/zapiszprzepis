'use server'

import { removeFavorite } from '@/app/favorites/actions'

/** „Usuń z ulubionych” on the „Przepis jest niedostępny” row: the form's recipe id, then the usual remove. */
export async function removeUnavailableFavorite(formData: FormData): Promise<void> {
  await removeFavorite(formData.get('recipeId'))
}
