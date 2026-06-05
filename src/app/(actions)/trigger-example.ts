'use server'

import { tasks } from '@trigger.dev/sdk/v3'
import type { exampleTask } from '@/trigger/example'

export async function triggerExample(): Promise<{ runId: string }> {
  const handle = await tasks.trigger<typeof exampleTask>('example', {})
  console.log(JSON.stringify({ event: 'trigger.dispatched', runId: handle.id }))
  return { runId: handle.id }
}
