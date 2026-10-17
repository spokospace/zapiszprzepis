import type { RemotePattern } from 'next/dist/shared/lib/image-config'

// The image allowlist is baked in when Next builds, but the Worker's `vars`
// (wrangler.jsonc) only exist at runtime, so a build without
// NEXT_PUBLIC_SUPABASE_URL falls back to the production project.
const PRODUCTION_SUPABASE_URL = 'https://wvrlgddgdddwmgzbvtij.supabase.co'

/**
 * The only remote images /_next/image may fetch: recipe photos archived in
 * Supabase Storage. A `**` hostname made it an open, unauthenticated image
 * proxy (#131): anyone could make the Worker fetch and resize any image on
 * the web. Covers that archiving never replaced are rendered `unoptimized`
 * (isArchivedImageUrl), so they never reach the optimizer.
 */
export function imageRemotePatterns(supabaseUrl = PRODUCTION_SUPABASE_URL): RemotePattern[] {
  return [
    {
      protocol: 'https',
      hostname: new URL(supabaseUrl).hostname,
      pathname: '/storage/v1/object/public/recipe-images/**',
    },
  ]
}
