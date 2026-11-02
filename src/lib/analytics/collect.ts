import { isBotUserAgent, MAX_BODY_BYTES, parseUsageEvent, type UsageEvent } from './events'

export interface CollectDeps {
  /** Is collection switched on at all? */
  enabled: boolean
  /** Is this client address still under the per-minute cap? Called only with a known address. */
  withinLimit: (clientAddress: string) => Promise<boolean>
  /** Increment today's counter. Resolves even when the write fails. */
  record: (event: UsageEvent, subject: string) => Promise<void>
  /** Hand the write to the runtime so the response does not wait for the database. */
  defer: (work: Promise<void>) => void
}

const noContent = () => new Response(null, { status: 204 })

/**
 * Handle one anonymous usage beacon. Reads only the body, the User-Agent (bot
 * check, not stored) and the client address (rate-limit key, not stored); never
 * cookies. Everything but a malformed or oversized body answers 204 with no body,
 * so a probe learns nothing about what was accepted.
 */
export async function collectUsageEvent(request: Request, deps: CollectDeps): Promise<Response> {
  if (!deps.enabled) return noContent()

  const text = await request.text()
  if (text.length > MAX_BODY_BYTES) return new Response(null, { status: 400 })

  const parsed = parseUsageEvent(text)
  if (!parsed) {
    // Valid JSON that is not an allowlisted event is dropped silently; only non-JSON is a 400.
    return isJson(text) ? noContent() : new Response(null, { status: 400 })
  }

  if (isBotUserAgent(request.headers.get('user-agent'))) return noContent()

  const address = request.headers.get('cf-connecting-ip')
  if (address && !(await deps.withinLimit(address))) return noContent()

  deps.defer(deps.record(parsed.event, parsed.subject))
  return noContent()
}

function isJson(text: string): boolean {
  try {
    JSON.parse(text)
    return true
  } catch {
    return false
  }
}
