import { describe, it, expect } from 'vitest'
import { classifyAttempts, type AttemptResult } from '@/lib/smoke-attempts'

const ok = (): AttemptResult => ({ kind: 'ok', recovered: false })
const recovered = (): AttemptResult => ({ kind: 'ok', recovered: true })
const cpuLimit = (): AttemptResult => ({ kind: 'cpu-limit' })
const error = (status: number): AttemptResult => ({ kind: 'error', status })

describe('classifyAttempts', () => {
  it('passes a page whose every attempt was a clean 200, with no note', () => {
    expect(classifyAttempts('/', [ok(), ok(), ok()])).toEqual({ hardFailure: null, transientNote: null })
  })

  it('tolerates a 1102 that recovered on retry: a note, not a failure', () => {
    const verdict = classifyAttempts('/', [ok(), recovered(), ok(), ok()])
    expect(verdict.hardFailure).toBeNull()
    expect(verdict.transientNote).toBe(
      'page / → every attempt served 200; 1/4 recovered from error 1102 after retry (post-deploy cold start, not an outage)',
    )
  })

  it('hard-fails a 1102 that never recovered, even among 200s (a sustained CPU-limit regression)', () => {
    const verdict = classifyAttempts('/', [ok(), cpuLimit(), ok(), cpuLimit()])
    expect(verdict.transientNote).toBeNull()
    expect(verdict.hardFailure).toBe('page / → 2/4 attempts failed (1102×2)')
  })

  it('hard-fails a page that never served a 200, marking that', () => {
    const verdict = classifyAttempts('/szukaj', [cpuLimit(), cpuLimit(), cpuLimit()])
    expect(verdict.hardFailure).toBe(
      'page /szukaj → 3/3 attempts failed (1102×3); the page never served a 200',
    )
  })

  it('counts each failing status, a 1102 and an unreachable included', () => {
    const verdict = classifyAttempts('/szukaj', [cpuLimit(), ok(), error(500), error(0)])
    expect(verdict.hardFailure).toBe('page /szukaj → 3/4 attempts failed (1102×1, 500×1, unreachable×1)')
  })

  it('treats a redirect as a failure: a public page must answer 200 to a guest', () => {
    const verdict = classifyAttempts('/login', [error(307)])
    expect(verdict.hardFailure).toBe('page /login → 1/1 attempts failed (307×1); the page never served a 200')
  })
})
