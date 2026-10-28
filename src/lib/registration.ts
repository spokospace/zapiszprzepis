// Temporary switch: OPEN_REGISTRATION=true lets anyone sign up without an invite
// code. Anything else (including unset) keeps the invite gate, so removing the
// variable closes registration again. Kept out of env.ts on purpose: that module
// is server-only and requires its variables at import time, which would break
// the signup page's unit test.
export function isOpenRegistration(): boolean {
  return process.env.OPEN_REGISTRATION === 'true'
}
