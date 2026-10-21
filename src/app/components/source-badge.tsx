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

/** Facebook's "f" mark, monochrome so it inherits the badge's ink colour. */
function FacebookIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 320 512"
      fill="currentColor"
      className={`source-icon-facebook ${className ?? ''}`}
      {...props}
    >
      <path d="M279.14 288l14.22-92.66h-88.91v-60.13c0-25.35 12.42-50.06 52.24-50.06h40.42V6.26S260.43 0 225.36 0c-73.22 0-121.08 44.38-121.08 124.72v70.62H176v92.66h59.28V512h91.46V288z" />
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
