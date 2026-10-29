import type { SupabaseClient } from '@supabase/supabase-js'
import { detectSourceType } from '@/lib/detect-source-type'
import type { FinishContext, ServiceReply } from './mcp/types'
import { UUID_RE } from './users'

export const IMPORT_FILTERS = ['problem', 'failed', 'pending', 'completed', 'all'] as const
export type ImportFilter = (typeof IMPORT_FILTERS)[number]

export const IMPORT_FILTER_LABELS: Record<ImportFilter, string> = {
  problem: 'Błędy i zawieszone',
  failed: 'Nieudane',
  pending: 'W toku',
  completed: 'Gotowe',
  all: 'Wszystkie',
}

export function parseImportFilter(raw: string | undefined): ImportFilter {
  return (IMPORT_FILTERS as readonly string[]).includes(raw ?? '') ? (raw as ImportFilter) : 'problem'
}

export interface StaffImport {
  id: number
  userId: string
  username: string | null
  displayName: string | null
  sharedUrl: string
  status: 'pending' | 'completed' | 'failed'
  errorMessage: string | null
  attempts: number
  createdAt: string
  updatedAt: string
  recipeId: number | null
  /** Pending for over 15 minutes: the run most likely died. */
  stuck: boolean
}

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)

export function mapImportRow(raw: unknown): StaffImport | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const id = Number(r.share_id)
  const userId = str(r.user_id)
  const sharedUrl = str(r.shared_url)
  const createdAt = str(r.created_at)
  const updatedAt = str(r.updated_at)
  const status = r.status
  if (
    !Number.isInteger(id) || id <= 0 || !userId || !UUID_RE.test(userId) || !sharedUrl || !createdAt || !updatedAt ||
    (status !== 'pending' && status !== 'completed' && status !== 'failed')
  ) {
    return null
  }
  return {
    id,
    userId,
    username: str(r.username),
    displayName: str(r.display_name),
    sharedUrl,
    status,
    errorMessage: str(r.error_message),
    attempts: Number(r.attempts) || 0,
    createdAt,
    updatedAt,
    recipeId: r.recipe_id == null ? null : Number(r.recipe_id),
    stuck: r.stuck === true,
  }
}

export const IMPORTS_PAGE_SIZE = 25

export interface ImportsPage {
  imports: StaffImport[]
  /** Share id to continue below, or null on the last page. */
  nextBeforeId: number | null
}

export async function listImports(
  supabase: SupabaseClient,
  opts: { filter: ImportFilter; beforeId?: number | null },
): Promise<ImportsPage | null> {
  const { data, error } = await supabase.rpc('admin_list_imports', {
    p_status: opts.filter,
    p_limit: IMPORTS_PAGE_SIZE + 1,
    p_before_id: opts.beforeId ?? null,
  })
  if (error || !Array.isArray(data)) {
    console.error('[staff] admin_list_imports failed:', error?.message)
    return null
  }
  const rows = data.map(mapImportRow).filter((i): i is StaffImport => i !== null)
  const imports = rows.slice(0, IMPORTS_PAGE_SIZE)
  return {
    imports,
    nextBeforeId: rows.length > IMPORTS_PAGE_SIZE && imports.length > 0 ? imports[imports.length - 1].id : null,
  }
}

/** The payload admin_retry_import returns; the same fields the owner's retry sends. */
export interface RetryPayload {
  shareId: number
  sharedUrl: string
  sharedTitle: string | null
  sharedText: string | null
  userId: string
}

export function parseRetryPayload(raw: unknown): RetryPayload | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const shareId = Number(r.shareId)
  const sharedUrl = str(r.sharedUrl)
  const userId = str(r.userId)
  if (!Number.isInteger(shareId) || shareId <= 0 || !sharedUrl || !userId || !UUID_RE.test(userId)) return null
  return { shareId, sharedUrl, sharedTitle: str(r.sharedTitle), sharedText: str(r.sharedText), userId }
}

/**
 * The `recipe/extract` event for a retry. Identical in shape to the one
 * src/app/(authenticated)/recipes/retry-action.ts and the share action send: the
 * original sharer's id and URL, so extraction behaves as if they had retried.
 */
export function buildExtractEvent(payload: RetryPayload) {
  return {
    name: 'recipe/extract' as const,
    data: {
      shareId: payload.shareId,
      sharedUrl: payload.sharedUrl,
      sharedTitle: payload.sharedTitle ?? undefined,
      sharedText: payload.sharedText ?? undefined,
      sourceType: detectSourceType(payload.sharedUrl),
      userId: payload.userId,
    },
  }
}

/**
 * The second half of an MCP retry, same as the panel's server action: the function
 * has already validated, reset the share and audited; this sends the event. If the
 * send fails the share goes back to `failed` so it stays on the list.
 */
export async function finishImportRetry(ctx: FinishContext): Promise<ServiceReply> {
  const payload = parseRetryPayload(ctx.result)
  if (!payload) return { ok: false, code: 'unknown' }
  try {
    // Loaded on demand: the Inngest client is only needed when a retry is sent.
    const { inngest } = await import('@/inngest/client')
    await inngest.send(buildExtractEvent(payload))
  } catch (err) {
    console.error('[staff] Failed to re-trigger extraction:', err)
    await ctx.rpc('admin_import_dispatch_failed_as', {
      p_actor: ctx.actorId,
      p_share: payload.shareId,
      p_via: 'mcp',
      p_token_id: ctx.tokenId,
    })
    return { ok: false, code: 'dispatch_failed' }
  }
  return { ok: true, data: { share_id: payload.shareId, status: 'pending', dispatched: true } }
}
