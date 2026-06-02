export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const SAFE_NEXT_REGEX = /^\/(?!\/)/

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email)
}

export function isSafeNext(next: string): boolean {
  return SAFE_NEXT_REGEX.test(next)
}
