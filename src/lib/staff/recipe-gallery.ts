import type { ImageStorage } from '@/lib/image-store'
import type { PrepareContext, PrepareReply } from './mcp/types'

/**
 * recipes_add_gallery_images, before its SQL function runs: the photos are
 * downloaded from where staff found them and stored on our image host, in the
 * recipe owner's folder, the way an import archives a gallery. The function then
 * appends the stored URLs and audits the change; when it refuses (the gallery
 * would pass its cap, a race), the stored files are removed again. Nothing is
 * stored for a recipe that does not exist, and a call where no photo could be
 * stored writes nothing.
 */
export interface GalleryPrepareDeps {
  /** The bound R2 bucket, or null outside the Worker. */
  storage: () => ImageStorage | null
  archive: (images: ImageStorage, userId: string, recipeId: number, sources: readonly string[]) => Promise<string[]>
  remove: (images: ImageStorage, urls: readonly string[]) => Promise<void>
}

async function defaultDeps(): Promise<GalleryPrepareDeps> {
  // Loaded on demand: the archive module is large and only this tool needs it.
  const [{ boundImageStorage }, archive] = await Promise.all([import('@/lib/image-store'), import('@/lib/recipe-image-archive')])
  return {
    storage: boundImageStorage,
    archive: archive.archiveAddedGalleryPhotos,
    remove: async (images, urls) => {
      const paths = urls.map(archive.extractStoragePath).filter((p): p is string => p != null)
      await archive.removeImages(images, paths, 'mcp gallery undo')
    },
  }
}

export function prepareGalleryImages(deps?: GalleryPrepareDeps) {
  return async ({ params, actorId, rpc }: PrepareContext): Promise<PrepareReply> => {
    const recipeId = Number(params.p_recipe)
    const sources = Array.isArray(params.p_image_urls) ? (params.p_image_urls as string[]) : []

    const recipe = await rpc('admin_get_recipe_content_as', { p_actor: actorId, p_recipe: recipeId })
    if (!recipe.ok) return recipe
    const owner = (recipe.data as { owner_id?: unknown } | null)?.owner_id
    if (typeof owner !== 'string') return { ok: false, code: 'not_found' }

    const { storage, archive, remove } = deps ?? (await defaultDeps())
    const images = storage()
    if (!images) return { ok: false, code: 'unknown' }
    const stored = await archive(images, owner, recipeId, sources)
    if (stored.length === 0) return { ok: false, code: 'images_unreachable' }
    return { ok: true, params: { ...params, p_image_urls: stored }, undo: () => remove(images, stored) }
  }
}
