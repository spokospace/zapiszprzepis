import { defineConfig } from '@trigger.dev/sdk/v3'

export default defineConfig({
  project: 'zapiszprzepis',
  runtime: 'node',
  logLevel: 'log',
  maxDuration: 180,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
    },
  },
  dirs: ['./src/trigger'],
})
