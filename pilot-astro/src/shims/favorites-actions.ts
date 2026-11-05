// Stands in for the Server Actions in the pilot, which has no Next server. A guest never reaches
// these: FavoriteButton sends a guest to login first.
export async function addFavorite() {
  return { ok: false, reason: 'unauthenticated' } as const
}

export async function removeFavorite() {
  return { ok: false, reason: 'unauthenticated' } as const
}
