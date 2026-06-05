'use client'

import { useState } from 'react'
import { triggerExampleTask, checkTaskStatus } from './actions'

export default function TestTriggerPage() {
  const [runId, setRunId] = useState<string>('')
  const [taskStatus, setTaskStatus] = useState<string>('')
  const [output, setOutput] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const handleTrigger = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await triggerExampleTask('https://httpbin.org/status/200')
      setRunId(result.runId)
      setTaskStatus('triggered')
      setOutput('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleCheckStatus = async () => {
    if (!runId) return

    setLoading(true)
    setError('')
    try {
      const result = await checkTaskStatus(runId)
      setTaskStatus(result.status)
      setOutput(JSON.stringify(result.output, null, 2))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold text-slate-900 mb-2">Trigger.dev Test</h1>
        <p className="text-slate-600 mb-8">Smoke test dla async job runner</p>

        <div className="bg-white rounded-lg shadow-lg p-8 space-y-6">
          <button
            onClick={handleTrigger}
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-slate-400 text-white font-semibold py-3 px-6 rounded-lg transition"
          >
            {loading ? 'Uruchamianie...' : 'Trigger Task'}
          </button>

          {runId && (
            <div className="bg-slate-100 p-4 rounded border border-slate-300">
              <p className="text-sm text-slate-600">Run ID:</p>
              <p className="font-mono text-lg text-slate-900 break-all">{runId}</p>
            </div>
          )}

          {taskStatus && (
            <div
              className={`p-4 rounded border ${
                taskStatus === 'completed'
                  ? 'bg-green-50 border-green-300'
                  : 'bg-blue-50 border-blue-300'
              }`}
            >
              <p className="text-sm font-semibold text-slate-600">Status:</p>
              <p className={taskStatus === 'completed' ? 'text-green-700' : 'text-blue-700'}>
                {taskStatus}
              </p>
            </div>
          )}

          {runId && taskStatus !== 'completed' && (
            <button
              onClick={handleCheckStatus}
              disabled={loading}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-slate-400 text-white font-semibold py-3 px-6 rounded-lg transition"
            >
              {loading ? 'Sprawdzanie...' : 'Sprawdź status'}
            </button>
          )}

          {output && (
            <div className="bg-slate-900 text-slate-50 p-4 rounded font-mono text-sm overflow-auto max-h-48">
              <p className="text-slate-400 mb-2">Output:</p>
              <pre>{output}</pre>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-300 text-red-700 p-4 rounded">
              <p className="font-semibold">Error:</p>
              <p>{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
