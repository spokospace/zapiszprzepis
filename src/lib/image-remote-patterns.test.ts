import { describe, expect, it } from 'vitest'
import { hasRemoteMatch } from 'next/dist/shared/lib/match-remote-pattern'
import { imageRemotePatterns } from '@/lib/image-remote-patterns'

const SUPABASE = 'https://wvrlgddgdddwmgzbvtij.supabase.co'
const BUCKET = `${SUPABASE}/storage/v1/object/public/recipe-images`

/** Whether the image optimizer would fetch `url` (Next's own matcher). */
const optimizable = (url: string) => hasRemoteMatch([], imageRemotePatterns(SUPABASE), new URL(url))

describe('imageRemotePatterns — the optimizer only fetches archived recipe photos (#131)', () => {
  it.each([
    [`${BUCKET}/user-1/7.jpg`, 'an archived cover'],
    [`${BUCKET}/user-1/7/lq3x-0.jpg`, 'an archived gallery photo'],
  ])('allows %s (%s)', (url) => {
    expect(optimizable(url)).toBe(true)
  })

  it.each([
    ['https://any-host.example/huge.jpg', 'any host on the web'],
    ['https://www.najprzepis.pl/upload/66477920_8933c3cf37e485_full.jpg', 'a cover archiving never replaced'],
    ['https://other-project.supabase.co/storage/v1/object/public/recipe-images/x.jpg', 'another Supabase project'],
    [`${SUPABASE}/storage/v1/object/public/avatars/user-1.jpg`, 'another bucket'],
    [`${SUPABASE}/storage/v1/object/sign/recipe-images/x.jpg`, 'a non-public object URL'],
    [`http://wvrlgddgdddwmgzbvtij.supabase.co/storage/v1/object/public/recipe-images/x.jpg`, 'plain http'],
  ])('refuses %s (%s)', (url) => {
    expect(optimizable(url)).toBe(false)
  })

  it('falls back to the production project when the build has no NEXT_PUBLIC_SUPABASE_URL', () => {
    expect(imageRemotePatterns(undefined)).toEqual(imageRemotePatterns(SUPABASE))
  })
})
