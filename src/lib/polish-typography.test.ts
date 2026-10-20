import { describe, it, expect } from 'vitest'
import { bindOrphans } from './polish-typography'

const NBSP = ' '

describe('bindOrphans', () => {
  it('binds a one-letter conjunction to the next word', () => {
    expect(bindOrphans('Syropy i napary')).toBe(`Syropy i${NBSP}napary`)
  })

  it('leaves a label without orphans unchanged', () => {
    expect(bindOrphans('Obiady')).toBe('Obiady')
    expect(bindOrphans('Ciasteczka')).toBe('Ciasteczka')
  })

  it('binds every single-letter word, including chained ones and a capital at the start', () => {
    expect(bindOrphans('A to i owo')).toBe(`A${NBSP}to i${NBSP}owo`)
    expect(bindOrphans('mleko w proszku z cukrem')).toBe(`mleko w${NBSP}proszku z${NBSP}cukrem`)
    expect(bindOrphans('w i z')).toBe(`w${NBSP}i${NBSP}z`)
  })

  it('never binds a letter that is part of a longer word', () => {
    expect(bindOrphans('mleka i cukru')).toBe(`mleka i${NBSP}cukru`)
    expect(bindOrphans('ryby')).toBe('ryby')
  })

  it('is idempotent', () => {
    const once = bindOrphans('Syropy i napary')
    expect(bindOrphans(once)).toBe(once)
  })

  it('does not bind a trailing one-letter word with nothing after it', () => {
    expect(bindOrphans('witamina A')).toBe('witamina A')
  })
})
