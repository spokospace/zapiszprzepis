import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { AwsClient } from 'aws4fetch'
import sharp from 'sharp'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { IMAGE_BASE_URL } from '../src/lib/image-host'
import { STORED_IMAGE_CACHE_CONTROL, STORED_IMAGE_QUALITY, STORED_IMAGE_WIDTH } from '../src/lib/image-store'

/**
 * Moves the recipe photos from Supabase Storage to the R2 bucket
 * `zapiszprzepis-images` (served at img.zapiszprzepis.pl), shrinking them on the
 * way: JPEG/PNG over 150 KB become WebP, at most 1600px on the long side.
 * Supabase's free plan caps storage (1 GB) and egress (5 GB); R2 has no egress fee.
 *
 *   node --env-file=.env.local --import tsx scripts/migrate-images-to-r2.ts            # dry-run: sample the savings
 *   node --env-file=.env.local --import tsx scripts/migrate-images-to-r2.ts --copy     # copy every object (resumable)
 *   node --env-file=.env.local --import tsx scripts/migrate-images-to-r2.ts --rewrite-db        # dry-run of the URL rewrite
 *   node --env-file=.env.local --import tsx scripts/migrate-images-to-r2.ts --rewrite-db --apply
 *
 * Order: --copy first (Supabase stays untouched), deploy the build that writes to R2,
 * then --rewrite-db --apply. Deleting the Supabase objects is a separate, later step.
 * The old-key -> new-key map is kept in .migration/images-map.json so every phase resumes.
 *
 * Needs R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY (an R2 API token limited to the bucket).
 * NOTE: local dev points at the PRODUCTION Supabase project.
 */
const SUPABASE_BUCKET = 'recipe-images'
const R2_BUCKET = 'zapiszprzepis-images'
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID ?? '7a4ca0444df1850c59cc436a4ff3ea71'
const MAP_FILE = '.migration/images-map.json'
const MIN_CONVERT_BYTES = 150 * 1024
const CONCURRENCY = 3
const PAGE = 1000

const args = new Set(process.argv.slice(2))
const COPY = args.has('--copy')
const REWRITE_DB = args.has('--rewrite-db')
const APPLY = args.has('--apply')

type KeyMap = Record<string, string>

function need(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

const supabaseUrl = need('NEXT_PUBLIC_SUPABASE_URL')
const supabase = createClient(supabaseUrl, need('SUPABASE_SERVICE_ROLE_KEY'))

function r2(): AwsClient {
  return new AwsClient({
    accessKeyId: need('R2_ACCESS_KEY_ID'),
    secretAccessKey: need('R2_SECRET_ACCESS_KEY'),
    service: 's3',
    region: 'auto',
  })
}

const r2Url = (key: string) =>
  `https://${ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key.split('/').map(encodeURIComponent).join('/')}`

async function listAll(): Promise<{ key: string; size: number }[]> {
  const objects: { key: string; size: number }[] = []
  let cursor: string | undefined
  do {
    let result = await supabase.storage.from(SUPABASE_BUCKET).listV2({ limit: PAGE, cursor })
    // "Too many connections" is Storage's own pool, busy with our downloads: wait and retry.
    for (let attempt = 1; result.error && attempt <= 8; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 10_000))
      result = await supabase.storage.from(SUPABASE_BUCKET).listV2({ limit: PAGE, cursor })
    }
    const { data, error } = result
    if (error) throw new Error(`list failed: ${error.message}`)
    for (const object of data.objects) {
      const size = Number((object.metadata as { size?: number } | null)?.size ?? 0)
      objects.push({ key: object.key ?? object.name, size })
    }
    cursor = data.hasNext ? data.nextCursor : undefined
  } while (cursor)
  return objects
}

const publicUrl = (key: string) => `${supabaseUrl}/storage/v1/object/public/${SUPABASE_BUCKET}/${key.split('/').map(encodeURIComponent).join('/')}`

interface Shrunk {
  bytes: Uint8Array
  contentType: string
  key: string
}

/** The bytes to store for `key`: WebP when that is clearly smaller, the original otherwise. */
async function shrink(key: string, original: Uint8Array, contentType: string): Promise<Shrunk> {
  const keep: Shrunk = { bytes: original, contentType, key }
  if (original.byteLength < MIN_CONVERT_BYTES || !/^image\/(jpeg|png)$/.test(contentType)) return keep
  try {
    const bytes = new Uint8Array(
      await sharp(original)
        .rotate()
        .resize({ width: STORED_IMAGE_WIDTH, height: STORED_IMAGE_WIDTH, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: STORED_IMAGE_QUALITY })
        .toBuffer(),
    )
    if (bytes.byteLength >= original.byteLength * 0.9) return keep
    return { bytes, contentType: 'image/webp', key: key.replace(/\.[^./]+$/, '.webp') }
  } catch (error) {
    console.warn(`  could not shrink ${key}: ${error instanceof Error ? error.message : String(error)}`)
    return keep
  }
}

async function download(key: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  // Supabase answers 429 when a burst of downloads is too fast: wait and retry.
  let response = await fetch(publicUrl(key))
  for (let attempt = 1; response.status === 429 && attempt <= 6; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, attempt * 3000))
    response = await fetch(publicUrl(key))
  }
  if (!response.ok) throw new Error(`download ${response.status} for ${key}`)
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    contentType: response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? 'application/octet-stream',
  }
}

function loadMap(): KeyMap {
  return existsSync(MAP_FILE) ? (JSON.parse(readFileSync(MAP_FILE, 'utf8')) as KeyMap) : {}
}

function saveMap(map: KeyMap): void {
  mkdirSync(dirname(MAP_FILE), { recursive: true })
  writeFileSync(MAP_FILE, JSON.stringify(map))
}

const mb = (bytes: number) => (bytes / 1048576).toFixed(1)

/** Runs `work` over `items` with a fixed number in flight. */
async function pool<T>(items: T[], work: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < items.length) await work(items[next++])
    }),
  )
}

async function dryRun(): Promise<void> {
  const objects = await listAll()
  const total = objects.reduce((sum, o) => sum + o.size, 0)
  console.log(`${objects.length} objects, ${mb(total)} MB in Supabase`)
  // A spread over the size range: every 40th object, so the estimate is not skewed by sorting.
  const sample = objects.filter((_, i) => i % 40 === 0)
  let before = 0
  let after = 0
  await pool(sample, async ({ key }) => {
    try {
      const file = await download(key)
      const out = await shrink(key, file.bytes, file.contentType)
      before += file.bytes.byteLength
      after += out.bytes.byteLength
    } catch (error) {
      console.warn(`  skipped ${key}: ${error instanceof Error ? error.message : String(error)}`)
    }
  })
  const ratio = before > 0 ? after / before : 1
  console.log(`sample of ${sample.length}: ${mb(before)} MB -> ${mb(after)} MB (${(ratio * 100).toFixed(0)}%)`)
  console.log(`estimated bucket after migration: ~${mb(total * ratio)} MB (free R2 limit is 10240 MB)`)
}

async function copyAll(): Promise<void> {
  const client = r2()
  const map = loadMap()
  const objects = await listAll()
  const todo = objects.filter(({ key }) => !(key in map))
  console.log(`${objects.length} objects, ${todo.length} still to copy`)
  let done = 0
  let before = 0
  let after = 0
  let failed = 0
  await pool(todo, async ({ key }) => {
    try {
      const file = await download(key)
      const out = await shrink(key, file.bytes, file.contentType)
      const response = await client.fetch(r2Url(out.key), {
        method: 'PUT',
        headers: { 'Content-Type': out.contentType, 'Cache-Control': STORED_IMAGE_CACHE_CONTROL },
        body: out.bytes as BodyInit,
      })
      if (!response.ok) throw new Error(`R2 PUT ${response.status}: ${await response.text()}`)
      map[key] = out.key
      before += file.bytes.byteLength
      after += out.bytes.byteLength
    } catch (error) {
      failed++
      console.warn(`  FAILED ${key}: ${error instanceof Error ? error.message : String(error)}`)
    }
    if (++done % 100 === 0) {
      saveMap(map)
      console.log(`  ${done}/${todo.length}  ${mb(before)} MB -> ${mb(after)} MB`)
    }
  })
  saveMap(map)
  console.log(`copied ${Object.keys(map).length} objects (${failed} failed this run); ${mb(before)} MB -> ${mb(after)} MB`)
  if (failed > 0) process.exitCode = 1
}

const SUPABASE_IMAGE_RE = /https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/recipe-images\/([^"'\s?#\\]+)/g

/** The R2 URL for a Supabase image URL; the original when the key was not copied. */
function rewriteUrl(url: string, map: KeyMap, missing: Set<string>): string {
  return url.replace(SUPABASE_IMAGE_RE, (whole, key: string) => {
    const decoded = decodeURIComponent(key)
    const target = map[decoded]
    if (!target) {
      missing.add(decoded)
      return whole
    }
    return `${IMAGE_BASE_URL}/${target}`
  })
}

interface Row {
  id: number
  [column: string]: unknown
}

async function rewriteTable(
  client: SupabaseClient,
  table: string,
  columns: string[],
  map: KeyMap,
  missing: Set<string>,
): Promise<number> {
  let changed = 0
  let lastId = 0
  for (;;) {
    const { data, error } = await client
      .from(table)
      .select(['id', ...columns].join(', '))
      .gt('id', lastId)
      .order('id')
      .limit(500)
      .returns<Row[]>()
    if (error) throw new Error(`${table}: ${error.message}`)
    if (!data || data.length === 0) break
    for (const row of data) {
      lastId = row.id
      const patch: Record<string, unknown> = {}
      for (const column of columns) {
        const value = row[column]
        if (value == null) continue
        const before = JSON.stringify(value)
        const after = rewriteUrl(before, map, missing)
        if (after !== before) patch[column] = JSON.parse(after)
      }
      if (Object.keys(patch).length === 0) continue
      changed++
      if (APPLY) {
        const { error: updateError } = await client.from(table).update(patch).eq('id', row.id)
        if (updateError) throw new Error(`${table} ${row.id}: ${updateError.message}`)
      }
    }
  }
  return changed
}

async function rewriteDb(): Promise<void> {
  const map = loadMap()
  if (Object.keys(map).length === 0) throw new Error(`${MAP_FILE} is empty: run --copy first`)
  const missing = new Set<string>()
  const recipes = await rewriteTable(supabase, 'recipes', ['image_url', 'image_urls', 'step_images'], map, missing)
  const merged = await rewriteTable(supabase, 'recipes_merged_duplicates', ['row_data'], map, missing)
  console.log(`${APPLY ? 'rewrote' : 'would rewrite'} ${recipes} recipes and ${merged} merged-duplicate rows`)
  if (missing.size > 0) console.log(`${missing.size} referenced keys are not in the map (left on Supabase): ${[...missing].slice(0, 10).join(', ')}`)
  if (!APPLY) console.log('dry-run: pass --apply to write')
}

async function main(): Promise<void> {
  if (REWRITE_DB) await rewriteDb()
  else if (COPY) await copyAll()
  else await dryRun()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
