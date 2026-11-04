import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { SUPABASE_URL, getSuabaseServiceRoleKey } from '@/lib/env'
import { withinRateLimit } from '@/lib/rate-limit'
import { collectUsageEvent } from '@/lib/analytics/collect'
import { usageAnalyticsEnabled } from '@/lib/analytics/events'

// Anonymous usage counter (.ai/specs/2026-10-30-first-party-usage-analytics.md).
// src/middleware.ts excludes this path, so no session check runs and no cookie is
// read. All behaviour lives in src/lib/analytics/collect.ts.
export const dynamic = 'force-dynamic'

export function POST(request: Request): Promise<Response> {
  return collectUsageEvent(request, {
    enabled: usageAnalyticsEnabled(),
    withinLimit: (address) => withinRateLimit('USAGE_LIMIT', address),
    record: async (event, subject) => {
      try {
        const supabase = createClient(SUPABASE_URL, getSuabaseServiceRoleKey(), {
          auth: { autoRefreshToken: false, persistSession: false },
        })
        const { error } = await supabase.rpc('usage_count', { p_event: event, p_subject: subject })
        if (error) console.error('[usage] counter write failed:', error.message)
      } catch (err) {
        console.error('[usage] counter write failed:', err)
      }
    },
    defer: (work) => {
      try {
        getCloudflareContext().ctx.waitUntil(work)
      } catch {
        // No Workers runtime (next dev): the write simply runs on its own.
        void work
      }
    },
  })
}

const notAllowed = () => new Response(null, { status: 405, headers: { Allow: 'POST' } })

export const GET = notAllowed
export const DELETE = notAllowed
