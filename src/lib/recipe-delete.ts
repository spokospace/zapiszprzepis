/** Shown when the owner tries to delete a recipe others keep in their favorites (E01-S03a, Q4). */
export const RECIPE_SHARED_MESSAGE =
  'Inne osoby mają ten przepis w ulubionych — możesz go usunąć tylko ze swojej listy.'

/**
 * The recipes_block_shared_delete trigger refused the delete: users other than
 * the owner have the recipe as a favorite. The database is the guard, so the
 * route learns about it only from the failed DELETE (no count is exposed).
 */
export function isRecipeSharedError(error: { code?: string; message?: string } | null | undefined): boolean {
  return error?.code === 'P0001' && (error.message ?? '').includes('recipe_shared')
}
