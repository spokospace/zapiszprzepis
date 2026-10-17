import { AVATAR_COLORS, avatarInitial } from '@/lib/avatar'

interface AvatarProps {
  /** Photo URL (avatarUrl() or a local object URL); null shows the letter. */
  src: string | null
  /** Display name — its first letter is the fallback. */
  name: string
  /** Index into AVATAR_COLORS (avatarColorIndex()). */
  colorIndex: number
  /** Edge in px: 96 settings, 88 public profile, 48 bylines. */
  size?: number
  /** Decorative by default: callers show the name as text right next to it. */
  alt?: string
}

/** Profile picture: the photo, or the first letter on one of six colors (E01-S13). */
export function Avatar({ src, name, colorIndex, size = 48, alt = '' }: AvatarProps) {
  const style = { width: size, height: size }
  if (src) {
    // A plain <img>: tiny 512² JPEGs from Supabase Storage need no optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} width={size} height={size} style={style} className="shrink-0 rounded-full object-cover" />
  }
  return (
    <span
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      style={{ ...style, backgroundColor: AVATAR_COLORS[colorIndex]?.hex ?? AVATAR_COLORS[0].hex, fontSize: Math.round(size * 0.46) }}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold leading-none text-white select-none"
    >
      {avatarInitial(name)}
    </span>
  )
}
