import { ardCatalogResponse } from '@/lib/ard-catalog'
import { getSiteUrl } from '@/lib/site-url'

/** GET /.well-known/ard.json — the same ARD catalog at the path ARD v0.91 names (#546). */
export async function GET() {
  return ardCatalogResponse(await getSiteUrl())
}
