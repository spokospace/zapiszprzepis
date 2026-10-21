import { BookOpen, ExternalLink, Globe, MonitorPlay, User } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
import type { SourceKind } from '@/lib/recipe-source'

// lucide-react dropped its brand glyphs, so the platform marks here are
// hand-drawn — monochrome, inheriting the badge's ink colour via currentColor.
// Facebook gets its "f": the FB badge shows the author's name alone, so the logo
// is what names the platform. WordPress / Blogger are a circled / boxed letter.
// YouTube keeps a neutral "video" lucide glyph, since its text still says
// "YouTube · …".
type BadgeIcon = ComponentType<SVGProps<SVGSVGElement>>

/**
 * Facebook's roundel, monochrome so it inherits the badge's ink colour. A square
 * 16×16 viewBox (like the WordPress / Blogger marks) so it fills the badge icon
 * box — the earlier tall "f"-only glyph (320×512) letterboxed into 18 px read as
 * a broken mark. The "f" is knocked out of the solid disc, white on the badge.
 */
function FacebookIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      className={`source-icon-facebook ${className ?? ''}`}
      {...props}
    >
      <path d="M16 8.049c0-4.446-3.582-8.05-8-8.05C3.58 0-.002 3.603-.002 8.05c0 4.017 2.926 7.347 6.75 7.951v-5.625h-2.03V8.05H6.75V6.275c0-2.017 1.195-3.131 3.022-3.131.876 0 1.791.157 1.791.157v1.98h-1.009c-.993 0-1.303.621-1.303 1.258v1.51h2.218l-.354 2.326H9.25V16c3.824-.604 6.75-3.934 6.75-7.951z" />
    </svg>
  )
}

/** A circled "W" — reads as WordPress next to the blog's name. */
function WordPressIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`source-icon-wordpress ${className ?? ''}`}
      {...props}
    >
      <circle cx="12" cy="12" r="9.25" />
      <polyline points="6.5,8 8.9,16 12,10.5 15.1,16 17.5,8" />
    </svg>
  )
}

/** A "b" in a rounded square — Blogger's mark, monochrome. */
function BloggerIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`source-icon-blogger ${className ?? ''}`}
      {...props}
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <path d="M10 7v6.5a3 3 0 1 0 3-3h-3" />
    </svg>
  )
}

const ICON: Record<SourceKind, BadgeIcon> = {
  website: Globe,
  wordpress: WordPressIcon,
  blogger: BloggerIcon,
  youtube: MonitorPlay,
  facebook: FacebookIcon,
  book: BookOpen,
  person: User,
}

interface SourceBadgeProps {
  kind: SourceKind
  /** The reader-facing source text ("aniagotuje.pl", "YouTube · Kuchnia Ani"). */
  text: string
  /**
   * The original's URL. On the recipe page a URL makes the badge a link to the
   * original (with an ExternalLink glyph); a page-less recipe (book / person)
   * passes none and gets a plain, border-less badge. On a card `href` is always
   * omitted — the whole card links to the recipe, so the badge never does.
   */
  href?: string | null
  /**
   * `card`: the small white badge in a photo corner on a recipe card.
   * `recipe`: the larger pill on the recipe page's main photo (a link when `href`).
   */
  variant: 'card' | 'recipe'
}

/**
 * The source of a recipe shown on its photo (2026-10-20 handoff §1, §3): an icon
 * for the platform kind + the source name on one line, clipped with an ellipsis
 * when it is long. The caller positions it in the photo's bottom-left corner.
 */
export function SourceBadge({ kind, text, href, variant }: SourceBadgeProps) {
  const Icon = ICON[kind]

  // Style 1b: white, no frame or shadow, flush with the photo's left edge (the caller
  // places it at left 1 px / bottom 6 px); square on the left, 2 px on the right.
  const TAB = 'inline-flex max-w-full items-center gap-1.5 rounded-r-[2px] bg-white py-1 pr-3 pl-2.5 text-[16px] font-bold text-ink'

  if (variant === 'card') {
    return (
      <span className={TAB}>
        <Icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
        <span className="truncate">{text}</span>
      </span>
    )
  }

  const inner = (
    <>
      <Icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0 md:h-5 md:w-5" />
      <span className={`truncate ${href ? 'underline underline-offset-2' : ''}`}>{text}</span>
      {href && <ExternalLink aria-hidden="true" className="h-4 w-4 shrink-0 md:h-[18px] md:w-[18px]" />}
    </>
  )

  // A page-less recipe (book / person): the same tab, no link, no ExternalLink.
  if (!href) return <span className={TAB}>{inner}</span>

  // The link keeps a 48 px touch target (WCAG 2.5.8) through a transparent box around the tab.
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      aria-label={`Otwórz oryginał: ${text} (nowa karta)`}
      className="inline-flex max-w-full min-h-12 items-center no-underline!"
    >
      <span className={TAB}>{inner}</span>
    </a>
  )
}
