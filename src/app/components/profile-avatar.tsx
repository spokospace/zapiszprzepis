import { avatarColorIndex, avatarLetter } from '@/lib/public-profile'

// Full class names, so Tailwind's scanner sees every one (no `bg-avatar-${n}`).
const AVATAR_BG = ['bg-avatar-1', 'bg-avatar-2', 'bg-avatar-3', 'bg-avatar-4', 'bg-avatar-5', 'bg-avatar-6']

interface ProfileAvatarProps {
  username: string
  displayName: string
  /** Diameter in px; 88 on the public profile (E01-S14). */
  size?: number
}

/**
 * A person's letter avatar: the display name's first letter in white on one of
 * six colours picked by username, so it is the same everywhere. Decorative —
 * the name is always printed next to it. E01-S13 adds the uploaded photo here.
 */
export function ProfileAvatar({ username, displayName, size = 88 }: ProfileAvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-pill font-extrabold text-white ${AVATAR_BG[avatarColorIndex(username) - 1]}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
    >
      {avatarLetter(displayName)}
    </span>
  )
}
