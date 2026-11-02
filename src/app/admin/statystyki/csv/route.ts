import { getStaff } from '@/lib/staff/context'
import { loadUsageSummary, MAX_USAGE_DAYS, usageCsvFilename, usageSummaryCsv } from '@/lib/staff/usage'

// CSV export of the usage counters (/admin/statystyki/csv?dni=30). A route handler
// is outside the admin layout, so it checks the permission itself.
export const dynamic = 'force-dynamic'

const notFound = () => new Response('Not found', { status: 404 })

export async function GET(request: Request): Promise<Response> {
  const staff = await getStaff()
  if (!staff || !staff.permissions.has('analytics.read')) return notFound()

  const days = Number(new URL(request.url).searchParams.get('dni') ?? 30)
  if (!Number.isInteger(days) || days < 1 || days > MAX_USAGE_DAYS) return notFound()

  const summary = await loadUsageSummary(staff.supabase, days)
  if (!summary) return new Response('Nie udało się wczytać statystyk.', { status: 502 })

  return new Response(usageSummaryCsv(summary), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${usageCsvFilename(summary)}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
