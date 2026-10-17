import { describe, it, expect } from 'vitest'
import {
  AVATAR_COLORS,
  AVATAR_MAX_BYTES,
  avatarColorIndex,
  avatarInitial,
  avatarObjectPath,
  avatarUrl,
  isAvatarColorIndex,
  validateAvatarUpload,
} from './avatar'

/** WCAG 2.x relative luminance of a #rrggbb color. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const jpeg = (size: number) => {
  const b = new Uint8Array(size)
  b.set([0xff, 0xd8, 0xff].slice(0, size))
  return b
}

describe('AVATAR_COLORS', () => {
  it('has six colors with distinct names', () => {
    expect(AVATAR_COLORS).toHaveLength(6)
    expect(new Set(AVATAR_COLORS.map((c) => c.name)).size).toBe(6)
  })

  it.each(AVATAR_COLORS.map((c) => [c.name, c.hex]))('%s clears 4.5:1 with a white letter', (_name, hex) => {
    const ratio = (1 + 0.05) / (luminance(hex) + 0.05)
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })
})

describe('avatarColorIndex', () => {
  const id = '6f1c2a90-1b2c-4d5e-8f90-0123456789ab'

  it('uses the stored choice', () => {
    expect(avatarColorIndex(id, 4)).toBe(4)
    expect(avatarColorIndex(id, 0)).toBe(0)
  })

  it('derives a stable in-range color when nothing (or garbage) is stored', () => {
    const derived = avatarColorIndex(id, null)
    expect(isAvatarColorIndex(derived)).toBe(true)
    expect(avatarColorIndex(id, undefined)).toBe(derived)
    expect(avatarColorIndex(id, 9)).toBe(derived)
  })

  it('spreads different users across the palette', () => {
    const seen = new Set(Array.from({ length: 60 }, (_, i) => avatarColorIndex(`user-${i}`, null)))
    expect(seen.size).toBeGreaterThan(3)
  })
})

describe('isAvatarColorIndex', () => {
  it('accepts 0..5 integers only', () => {
    expect([0, 5].every(isAvatarColorIndex)).toBe(true)
    expect([-1, 6, 1.5, NaN, '2', null].some(isAvatarColorIndex)).toBe(false)
  })
})

describe('avatarInitial', () => {
  it('uppercases the first letter, Polish-aware', () => {
    expect(avatarInitial('ania')).toBe('A')
    expect(avatarInitial('  łucja')).toBe('Ł')
    expect(avatarInitial('żaneta K')).toBe('Ż')
  })

  it('falls back to ? for a blank name', () => {
    expect(avatarInitial('   ')).toBe('?')
    expect(avatarInitial(null)).toBe('?')
  })
})

describe('avatarUrl', () => {
  it('builds the public Storage URL', () => {
    expect(avatarUrl('https://x.supabase.co/', 'u1/1760000000000.jpg')).toBe(
      'https://x.supabase.co/storage/v1/object/public/avatars/u1/1760000000000.jpg',
    )
  })

  it('is null without a stored photo', () => {
    expect(avatarUrl('https://x.supabase.co', null)).toBeNull()
    expect(avatarUrl('https://x.supabase.co', '')).toBeNull()
  })
})

describe('avatarObjectPath', () => {
  it("names a fresh JPEG inside the owner's folder", () => {
    expect(avatarObjectPath('u1', 1760000000000)).toBe('u1/1760000000000.jpg')
  })
})

describe('validateAvatarUpload', () => {
  it('accepts a JPEG within the cap', () => {
    expect(validateAvatarUpload(jpeg(80_000))).toEqual({ ok: true })
    expect(validateAvatarUpload(jpeg(AVATAR_MAX_BYTES))).toEqual({ ok: true })
  })

  it('rejects empty, oversized and non-JPEG files', () => {
    expect(validateAvatarUpload(new Uint8Array(0)).ok).toBe(false)
    expect(validateAvatarUpload(jpeg(AVATAR_MAX_BYTES + 1)).ok).toBe(false)
    expect(validateAvatarUpload(new Uint8Array([0x89, 0x50, 0x4e, 0x47])).ok).toBe(false)
    expect(validateAvatarUpload(new Uint8Array([0xff, 0xd8])).ok).toBe(false)
  })
})
