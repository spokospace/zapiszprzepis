import type { FinishContext, ServiceReply } from './mcp/types'

/**
 * What the panel's server actions do after a recipe change, for the MCP: guests see the
 * change at most one cache TTL late, so the caches of the recipes it touched are emptied
 * once the (already committed) change returns. A failure here never fails the call.
 */
async function refresh(slugs: string[]): Promise<void> {
  try {
    // Loaded on demand: the cache module pulls in the Supabase client, which most calls do not need.
    const { revalidateRecipeCaches } = await import('@/lib/recipe-cache')
    for (const slug of slugs) revalidateRecipeCaches(slug)
  } catch (err) {
    console.error('[staff] recipe cache invalidation failed:', err)
  }
}

const slugList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((s): s is string => typeof s === 'string' && s !== '') : []

/** For the operations that return the slug of the one recipe they changed. */
export async function finishRecipeSlug(ctx: FinishContext): Promise<ServiceReply> {
  const slug = typeof ctx.result === 'string' && ctx.result !== '' ? ctx.result : null
  await refresh(slug ? [slug] : [])
  return { ok: true, data: { slug } }
}

/** For merge and unmerge, which return every slug whose page changed. */
export async function finishRecipeMerge(ctx: FinishContext): Promise<ServiceReply> {
  const result = (typeof ctx.result === 'object' && ctx.result !== null ? ctx.result : {}) as Record<string, unknown>
  const canonical = typeof result.canonical_slug === 'string' ? [result.canonical_slug] : []
  await refresh([...canonical, ...slugList(result.loser_slugs), ...slugList(result.restored_slugs)])
  return { ok: true, data: result }
}
