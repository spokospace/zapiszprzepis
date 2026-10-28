import type { NextRequest } from 'next/server'
import { serve } from 'inngest/next'
import { getInngestSecondary } from '@/inngest/client'
import { extractRecipe } from '@/inngest/functions'

// Serve endpoint for the secondary Inngest account, so runs it dispatches
// execute here. Answers 404 until both INNGEST_EVENT_KEY_2 and
// INNGEST_SIGNING_KEY_2 are set. Built per request: Workers populate
// process.env per request, not at import.
function secondaryHandler() {
  const client = getInngestSecondary()
  if (!client || !process.env.INNGEST_SIGNING_KEY_2) return null
  return serve({ client, functions: [extractRecipe] })
}

const notFound = () => new Response('Not found', { status: 404 })

export async function GET(request: NextRequest, res: unknown): Promise<Response> {
  const handler = secondaryHandler()
  return handler ? handler.GET(request, res) : notFound()
}

export async function POST(request: NextRequest, res: unknown): Promise<Response> {
  const handler = secondaryHandler()
  return handler ? handler.POST(request, res) : notFound()
}

export async function PUT(request: NextRequest, res: unknown): Promise<Response> {
  const handler = secondaryHandler()
  return handler ? handler.PUT(request, res) : notFound()
}
