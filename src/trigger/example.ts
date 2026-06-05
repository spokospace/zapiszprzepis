import { task } from '@trigger.dev/sdk/v3'

export const exampleTask = task({
  id: 'example-task',
  run: async (payload: { url: string }) => {
    const startTime = Date.now()

    // Smoke test: fetch status from httpbin
    const res = await fetch(payload.url, {
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    }

    const data = (await res.json()) as Record<string, unknown>
    const duration_ms = Date.now() - startTime

    return {
      status: 'completed',
      output: {
        ...data,
        duration_ms,
      },
    }
  },
})
