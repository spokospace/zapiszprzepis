import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Unit tests target the pure pipeline functions under src/lib. They run in a
// node environment (no DOM) and resolve the same `@/` alias the source uses
// (mirrored from tsconfig.json). The Playwright e2e suite (e2e/*.spec.ts) and
// agent worktrees are excluded so vitest only picks up first-party unit specs.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules/**', 'e2e/**', '.claude/**'],
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
