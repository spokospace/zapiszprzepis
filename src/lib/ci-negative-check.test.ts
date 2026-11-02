import { expect, it } from 'vitest'

// Deliberately red (#375 negative case): proves the CI gate job fails on a
// failing unit test. Reverted in the next commit.
it('fails on purpose to show the CI check goes red', () => {
  expect(1).toBe(2)
})
