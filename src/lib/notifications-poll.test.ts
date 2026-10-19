import { describe, it, expect } from 'vitest'
import { finishedMessage } from './notifications-poll'
import type { NotificationsResult } from './notifications'

const ok = (over: Partial<Extract<NotificationsResult, { status: 'ok' }>>): NotificationsResult => ({
  status: 'ok',
  problems: [],
  inProgress: [],
  ready: [],
  ...over,
})
const ready = (id: number, title: string) => ({ id, url: 'u', domain: 'd', slug: 's', title, at: '', read: false })

describe('finishedMessage', () => {
  it('names the one recipe that finished', () => {
    expect(finishedMessage([7], ok({ ready: [ready(7, 'Sernik')] }))).toBe('Przepis gotowy: Sernik.')
  })

  it('counts several finished recipes', () => {
    expect(finishedMessage([7, 8], ok({ ready: [ready(7, 'A'), ready(8, 'B')] }))).toBe('Gotowe przepisy: 2.')
  })

  it('says when one failed', () => {
    const problems = [{ id: 7, url: 'u', domain: 'd', reason: 'r', at: '' }]
    expect(finishedMessage([7], ok({ problems }))).toContain('Nie udało się dodać przepisu')
  })

  it('stays silent for cards that were not in progress, on the first render and on errors', () => {
    expect(finishedMessage([7], ok({ ready: [ready(3, 'Stary')] }))).toBe('')
    expect(finishedMessage([], ok({ ready: [ready(7, 'Sernik')] }))).toBe('')
    expect(finishedMessage([7], { status: 'error' })).toBe('')
  })
})
