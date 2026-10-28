import { Inngest } from 'inngest'

export const inngest = new Inngest({ id: 'zapiszprzepis' })

// Second Inngest account, used only when the primary refuses an event. Read at
// call time, not at import: Workers populate process.env per request, so a
// module-level read can see it empty. Null when INNGEST_EVENT_KEY_2 is unset,
// which keeps the primary as the only account.
let secondary: Inngest | null | undefined

export function getInngestSecondary(): Inngest | null {
  if (secondary === undefined) {
    const eventKey = process.env.INNGEST_EVENT_KEY_2
    secondary = eventKey
      ? new Inngest({ id: 'zapiszprzepis', eventKey, signingKey: process.env.INNGEST_SIGNING_KEY_2 })
      : null
  }
  return secondary
}
