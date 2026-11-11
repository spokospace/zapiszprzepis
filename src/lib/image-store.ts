import { getCloudflareContext } from '@opennextjs/cloudflare'
import { IMAGE_BASE_URL } from './image-host'

/**
 * Where archived recipe photos live: a Cloudflare R2 bucket behind a custom
 * domain, not Supabase Storage. Supabase's free plan caps storage at 1 GB and
 * egress at 5 GB, and the photos blew through both; R2 has no egress fees.
 *
 * The archive code was written against `supabase.storage.from(bucket)`, so this
 * module exposes the same four calls (upload, getPublicUrl, list, remove) on top
 * of an R2 bucket. A Supabase client still satisfies `ImageStorage`, which keeps
 * tests and the legacy objects working during the migration.
 */

export { IMAGE_BASE_URL }

/** Keys never change content (a re-archive gets a new `?v=` or file name), so browsers and the edge may keep them a year. */
export const STORED_IMAGE_CACHE_CONTROL = 'public, max-age=31536000, immutable'

/** Photos are stored at most this wide: the largest cover rendering is ~1280px. */
export const STORED_IMAGE_WIDTH = 1600
export const STORED_IMAGE_QUALITY = 82
/** Below this a re-encode is not worth a transform. */
const MIN_COMPRESS_BYTES = 150 * 1024

type StorageError = { message: string } | null

export interface ImageBucketApi {
  upload(
    path: string,
    body: Uint8Array,
    options: { contentType: string; upsert?: boolean },
  ): PromiseLike<{ error: StorageError }>
  getPublicUrl(path: string): { data: { publicUrl: string } }
  list(folder: string): PromiseLike<{ data: { name: string }[] | null; error: StorageError }>
  remove(paths: string[]): PromiseLike<{ data: { name: string }[] | null; error: StorageError }>
}

export interface ImageStorage {
  storage: { from(bucket: string): ImageBucketApi }
}

/** The parts of an R2 bucket binding this module uses. */
export interface R2BucketLike {
  put(
    key: string,
    value: Uint8Array,
    options?: { httpMetadata?: { contentType?: string; cacheControl?: string } },
  ): Promise<unknown>
  list(options?: {
    prefix?: string
    delimiter?: string
    cursor?: string
  }): Promise<{ objects: { key: string }[]; truncated: boolean; cursor?: string }>
  delete(keys: string | string[]): Promise<void>
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** An R2 bucket seen through the `supabase.storage.from()` calls the archive uses. */
export function r2Storage(bucket: R2BucketLike, baseUrl = IMAGE_BASE_URL): ImageStorage {
  const api: ImageBucketApi = {
    async upload(path, body, { contentType }) {
      try {
        await bucket.put(path, body, { httpMetadata: { contentType, cacheControl: STORED_IMAGE_CACHE_CONTROL } })
        return { error: null }
      } catch (error) {
        return { error: { message: message(error) } }
      }
    },
    getPublicUrl: (path) => ({ data: { publicUrl: `${baseUrl}/${path}` } }),
    async list(folder) {
      try {
        const prefix = `${folder}/`
        const names: { name: string }[] = []
        let cursor: string | undefined
        do {
          const page = await bucket.list({ prefix, delimiter: '/', cursor })
          for (const object of page.objects) names.push({ name: object.key.slice(prefix.length) })
          cursor = page.truncated ? page.cursor : undefined
        } while (cursor)
        return { data: names, error: null }
      } catch (error) {
        return { data: null, error: { message: message(error) } }
      }
    },
    async remove(paths) {
      try {
        await bucket.delete(paths)
        return { data: paths.map((name) => ({ name })), error: null }
      } catch (error) {
        return { data: null, error: { message: message(error) } }
      }
    },
  }
  return { storage: { from: () => api } }
}

interface ImagesBindingLike {
  input(stream: ReadableStream<Uint8Array>): {
    transform(options: { width: number; height: number; fit: 'scale-down' }): {
      output(options: { format: 'image/webp'; quality: number }): Promise<{ response(): Response }>
    }
  }
}

interface WorkerBindings {
  IMAGE_BUCKET?: R2BucketLike
  IMAGES?: ImagesBindingLike
}

function bindings(): WorkerBindings | null {
  try {
    return getCloudflareContext().env as unknown as WorkerBindings
  } catch {
    // Not inside a Worker request (scripts, unit tests).
    return null
  }
}

/**
 * Where to write photos: the R2 bucket when the Worker has it bound, otherwise
 * `fallback` (a script's own storage, or the Supabase client in tests).
 */
export function imageStorage(fallback: ImageStorage): ImageStorage {
  return boundImageStorage() ?? fallback
}

/** The R2 bucket the Worker has bound, or null outside the Worker (scripts, tests). */
export function boundImageStorage(): ImageStorage | null {
  const bucket = bindings()?.IMAGE_BUCKET
  return bucket ? r2Storage(bucket) : null
}

export interface StoredPhoto {
  bytes: Uint8Array
  contentType: string
  ext: string
}

/**
 * Shrinks a photo for storage: WebP, at most STORED_IMAGE_WIDTH on the long side
 * (Cloudflare Images binding). Returns the photo untouched when the binding is
 * missing, the photo is already small, the transform fails, or the result is not
 * smaller, so archiving never fails because of compression.
 */
export async function compressPhoto<T extends StoredPhoto>(photo: T): Promise<T> {
  const images = bindings()?.IMAGES
  if (!images) return photo
  const isWebp = photo.contentType === 'image/webp'
  if (photo.bytes.byteLength < MIN_COMPRESS_BYTES) return photo
  try {
    const result = await images
      .input(new Response(photo.bytes as BodyInit).body as ReadableStream<Uint8Array>)
      .transform({ width: STORED_IMAGE_WIDTH, height: STORED_IMAGE_WIDTH, fit: 'scale-down' })
      .output({ format: 'image/webp', quality: STORED_IMAGE_QUALITY })
    const bytes = new Uint8Array(await result.response().arrayBuffer())
    if (bytes.byteLength === 0 || (isWebp && bytes.byteLength >= photo.bytes.byteLength)) return photo
    return { ...photo, bytes, contentType: 'image/webp', ext: 'webp' }
  } catch (error) {
    console.warn(`[compressPhoto] kept the original: ${message(error)}`)
    return photo
  }
}
