import { logger, task, wait } from '@trigger.dev/sdk/v3'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { getErrorMessage } from '@/lib/errors'

const PRIMARY_URL = 'https://httpbin.org/anything'
const FALLBACK_URL = 'https://api.github.com/zen'

type Payload = { url?: string }
type FetchResult = { status: number; bytes: number; source: 'primary' | 'fallback' }
type ExampleResult = FetchResult & { triggered_at: string; completed_at: string; duration_ms: number }

async function probe(url: string): Promise<Omit<FetchResult, 'source'>> {
  const res = await fetchWithTimeout(url)
  const body = await res.text()
  return { status: res.status, bytes: body.length }
}

export const exampleTask = task({
  id: 'example',
  retry: { maxAttempts: 3 },
  maxDuration: 300,
  run: async (payload: Payload, { ctx }): Promise<ExampleResult> => {
    const triggered_at = new Date().toISOString()
    const start = Date.now()
    logger.log('task.started', { runId: ctx.run.id, payload })

    await wait.for({ seconds: 5 })

    const primary = payload.url ?? PRIMARY_URL
    let result: FetchResult
    try {
      const r = await probe(primary)
      result = { ...r, source: 'primary' }
    } catch (err) {
      logger.warn('primary fetch failed, trying fallback', {
        runId: ctx.run.id,
        primary,
        error: getErrorMessage(err),
      })
      const r = await probe(FALLBACK_URL)
      result = { ...r, source: 'fallback' }
    }

    const completed_at = new Date().toISOString()
    const duration_ms = Date.now() - start
    logger.log('task.completed', {
      runId: ctx.run.id,
      status: result.status,
      source: result.source,
      duration_ms,
    })

    return { ...result, triggered_at, completed_at, duration_ms }
  },
})
