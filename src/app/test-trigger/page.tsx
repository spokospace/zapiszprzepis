'use client'

import { useState, useTransition } from 'react'
import { triggerExample } from '@/app/(actions)/trigger-example'
import { getExampleStatus, type ExampleStatus } from '@/app/(actions)/get-example-status'
import { getErrorMessage } from '@/lib/errors'

type State = {
  runId: string | null
  status: ExampleStatus | null
  error: string | null
}

export default function TestTriggerPage() {
  const [state, setState] = useState<State>({ runId: null, status: null, error: null })
  const [isPending, startTransition] = useTransition()

  function handleTrigger() {
    startTransition(async () => {
      try {
        const { runId } = await triggerExample()
        setState({ runId, status: null, error: null })
      } catch (err) {
        setState({
          runId: null,
          status: null,
          error: getErrorMessage(err),
        })
      }
    })
  }

  function handleCheckStatus() {
    if (!state.runId) return
    startTransition(async () => {
      try {
        const status = await getExampleStatus(state.runId!)
        setState((s) => ({ ...s, status, error: null }))
      } catch (err) {
        setState((s) => ({
          ...s,
          error: getErrorMessage(err),
        }))
      }
    })
  }

  return (
    <main className="mx-auto max-w-2xl p-8 font-mono text-sm">
      <h1 className="mb-4 text-xl font-semibold">F-01 Trigger.dev smoke</h1>
      <p className="mb-6 text-gray-600">
        Dev-only page. DELETE w S-01 when real share-target flow replaces it.
      </p>

      <div className="mb-6 flex gap-2">
        <button
          onClick={handleTrigger}
          disabled={isPending}
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        >
          Triggeruj task
        </button>
        <button
          onClick={handleCheckStatus}
          disabled={isPending || !state.runId}
          className="rounded bg-gray-700 px-4 py-2 text-white disabled:opacity-50"
        >
          Sprawdź status
        </button>
      </div>

      <pre className="overflow-auto rounded bg-gray-100 p-4">
        {JSON.stringify(state, null, 2)}
      </pre>
    </main>
  )
}
