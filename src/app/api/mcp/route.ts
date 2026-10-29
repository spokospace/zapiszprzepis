import { handleMcp } from '@/lib/staff/mcp/handler'
import { mcpService } from '@/lib/staff/mcp/service'

// Staff MCP endpoint (Phase 4 of the admin panel). Bearer-token auth, not a
// Supabase session: src/middleware.ts lets /api/mcp through and handleMcp checks
// the token itself. All behaviour lives in src/lib/staff/mcp/.
export const dynamic = 'force-dynamic'

export function POST(request: Request): Promise<Response> {
  return handleMcp(request, mcpService)
}

// The transport also allows a GET for a server-sent stream and a DELETE for sessions;
// this server is stateless and request/response only.
const notAllowed = () =>
  new Response(JSON.stringify({ error: 'method_not_allowed' }), {
    status: 405,
    headers: { Allow: 'POST', 'Content-Type': 'application/json' },
  })

export const GET = notAllowed
export const DELETE = notAllowed
