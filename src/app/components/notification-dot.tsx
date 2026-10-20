/**
 * The notifications "something new" signal (E01-S15b): a fixed-size dot,
 * never a number. A dot is the smallest footprint for a cramped, large-font
 * navbar (older users enlarge the system font) and does not grow or clip the
 * way a numeric badge would. The 2 px white ring separates it from the icon it
 * sits on. The dot is decorative — the text equivalent lives in the host
 * control's accessible name — so it is `aria-hidden`.
 *
 * Shared by the MENU button and the MENU-drawer "Powiadomienia" row so the dots
 * cannot drift. `tone="action"` (default) is the orange brand cue for „coś
 * nowego” — not red, because it is news, not an error (owner, 2026-10-20).
 * `tone="ink"` is the neutral „nie udało się sprawdzić” state: `#1f2937`, not an
 * amber that would fail 3:1 as a non-text UI element (#335).
 */
export function NotificationDot({ className = '', tone = 'action' }: { className?: string; tone?: 'action' | 'ink' }) {
  return (
    <span
      aria-hidden="true"
      className={`h-3 w-3 shrink-0 rounded-pill border-2 border-white ${tone === 'ink' ? 'bg-ink' : 'bg-action'} ${className}`}
    />
  )
}
