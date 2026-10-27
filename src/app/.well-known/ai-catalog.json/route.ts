import { ardCatalogResponse } from '@/lib/ard-catalog'
import { getSiteUrl } from '@/lib/site-url'

/** GET /.well-known/ai-catalog.json — the ARD catalog Lighthouse's `ard-schema` audit reads (#546). */
export async function GET() {
  return ardCatalogResponse(await getSiteUrl())
}
