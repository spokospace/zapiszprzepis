'use server'

import { runs } from '@trigger.dev/sdk/v3'

export type ExampleStatus = {
  status: string
  output?: unknown
  error?: string
}

export async function getExampleStatus(runId: string): Promise<ExampleStatus> {
  const run = await runs.retrieve(runId)
  console.log(JSON.stringify({ event: 'status.checked', runId, status: run.status }))
  return {
    status: run.status,
    output: run.output,
    error: run.error?.message,
  }
}
