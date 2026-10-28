import { BUTTON_CORE, BUTTON_VARIANTS } from './button'

/**
 * The recipe page's action cards (design 2026-10-28): wide, softly rounded tiles
 * instead of pills, on the same core as buttonClasses (wrap-anywhere, no-underline!,
 * disabled look). The light frame is #6b7280 (4.8:1 on white), so the card's edge
 * clears the 3:1 for UI components.
 */
const SHAPE = `${BUTTON_CORE} w-full gap-4 rounded-xl px-5 py-3`
const TALL = `${SHAPE} min-h-[76px]`

/** The light cards' frame and fill; a stateful card (the heart) swaps it for its own. */
export const ACTION_CARD_FRAME = 'border-2 border-border-chip bg-white text-ink hover:bg-surface-2'

export const ACTION_CARD = {
  /** Shape only, for a card whose colours change with its state. */
  tall: TALL,
  dark: `${TALL} ${BUTTON_VARIANTS.dark}`,
  light: `${TALL} ${ACTION_CARD_FRAME}`,
  // Below lg the pair shares one row, so the icon stacks over a centred label.
  compact: `${SHAPE} min-h-[64px] text-[19px] max-lg:flex-col max-lg:gap-1.5 max-lg:text-center ${ACTION_CARD_FRAME}`,
} as const

/** The tall cards' icon (32 px) and the compact pair's (26 px). */
export const ACTION_CARD_ICON = 'h-8 w-8 shrink-0'
export const ACTION_CARD_ICON_COMPACT = 'h-[26px] w-[26px] shrink-0'

const TONE = {
  dark: { title: '', hint: 'text-border-card' },
  light: { title: '', hint: 'text-ink-soft' },
  accent: { title: 'text-action-text', hint: 'text-ink-soft' },
} as const

/**
 * Title over a one-line hint, left-aligned beside the icon. Both lines are visible
 * text, so the accessible name starts with the title (label-in-name, 2.5.3).
 */
export function ActionCardText({ title, hint, tone = 'light' }: { title: string; hint: string; tone?: keyof typeof TONE }) {
  return (
    <span className="flex min-w-0 flex-col text-left">
      <span className={`text-[19px] leading-tight ${TONE[tone].title}`}>{title}</span>
      <span className={`mt-1 text-[16px] leading-snug font-normal ${TONE[tone].hint}`}>{hint}</span>
    </span>
  )
}
