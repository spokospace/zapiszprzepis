// Profile picture (E01-S13): an uploaded photo, or the first letter of the
// display name on one of six colors. Pure — shared by the settings screen, the
// server action and every place that shows a user (S14 profile, bylines).
// No env import: client components use this module too.

export const AVATAR_BUCKET = 'avatars'

/** Server-side cap; the browser re-encodes to a ~100 kB 512² JPEG first. */
export const AVATAR_MAX_BYTES = 1024 * 1024

/** Edge of the square the browser crops and re-encodes the photo to. */
export const AVATAR_SIZE = 512

/**
 * Letter-avatar backgrounds. Index = profiles.avatar_color. Every color is a
 * 700-series shade that clears 4.5:1 with a white letter (asserted in tests).
 * Order is part of the stored data — append only, never reorder.
 */
export const AVATAR_COLORS = [
  { name: 'Pomarańczowy', hex: '#c2410c' },
  { name: 'Niebieski', hex: '#1d4ed8' },
  { name: 'Zielony', hex: '#15803d' },
  { name: 'Fioletowy', hex: '#7e22ce' },
  { name: 'Różowy', hex: '#be185d' },
  { name: 'Morski', hex: '#0f766e' },
] as const

export function isAvatarColorIndex(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) < AVATAR_COLORS.length
}

/**
 * The color to show: the stored choice, or a stable pick derived from the user
 * id when none is stored (null in the DB), so defaults vary without a backfill.
 */
export function avatarColorIndex(userId: string, stored: number | null | undefined): number {
  if (isAvatarColorIndex(stored)) return stored
  let hash = 0
  for (const ch of userId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return hash % AVATAR_COLORS.length
}

/** First letter of the name, uppercased (Polish-aware); "?" for a blank name. */
export function avatarInitial(name: string | null | undefined): string {
  const first = Array.from(name?.trim() ?? '')[0]
  return first ? first.toLocaleUpperCase('pl-PL') : '?'
}

/**
 * Public URL of a stored picture, or null for a letter avatar. `supabaseUrl`
 * is passed in (server callers use SUPABASE_URL from '@/lib/env').
 */
export function avatarUrl(supabaseUrl: string, path: string | null | undefined): string | null {
  if (!path) return null
  const encoded = path.split('/').map(encodeURIComponent).join('/')
  return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${AVATAR_BUCKET}/${encoded}`
}

/** New object path inside the owner's folder; a fresh name busts the CDN cache. */
export function avatarObjectPath(userId: string, now: number = Date.now()): string {
  return `${userId}/${now}.jpg`
}

/** JPEG magic bytes (FF D8 FF) — the declared MIME type is client input. */
function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
}

export type AvatarUploadResult = { ok: true } | { ok: false; error: string }

/**
 * Validate an uploaded picture by size and real format (magic bytes). Only JPEG is
 * accepted: the browser always re-encodes the chosen photo to a 512² JPEG, and
 * the stored path ends in .jpg (enforced by a DB check).
 */
export function validateAvatarUpload(bytes: Uint8Array): AvatarUploadResult {
  const size = bytes.byteLength
  if (size <= 0) return { ok: false, error: 'Wybrany plik jest pusty.' }
  if (size > AVATAR_MAX_BYTES) return { ok: false, error: 'Zdjęcie jest za duże. Wybierz inne.' }
  if (!isJpeg(bytes)) {
    return { ok: false, error: 'Nie udało się odczytać zdjęcia. Wybierz zdjęcie JPG lub PNG.' }
  }
  return { ok: true }
}
