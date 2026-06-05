'use server'

import { exampleTask } from '@/trigger/example'

export async function triggerExampleTask(url: string) {
  // Trigger the task and wait for completion
  const handle = await exampleTask.trigger(
    { url },
    {
      idempotencyKey: `test-${Date.now()}`,
    }
  )

  return {
    runId: handle.id,
    status: 'triggered',
  }
}

export async function checkTaskStatus(runId: string) {
  // Retrieve run status from Trigger.dev API
  const apiUrl = `https://api.trigger.dev/api/v1/runs/${runId}`
  const secretKey = process.env.TRIGGER_SECRET_KEY

  if (!secretKey) {
    throw new Error('TRIGGER_SECRET_KEY not set')
  }

  const res = await fetch(apiUrl, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch run status: ${res.status}`)
  }

  const data = (await res.json()) as {
    id: string
    status: string
    output?: unknown
  }

  return {
    runId: data.id,
    status: data.status,
    output: data.output,
  }
}
