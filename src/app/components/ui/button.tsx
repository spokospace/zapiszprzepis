import type { ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'dark' | 'outline' | 'danger' | 'facebook'
export type ButtonSize = 'md' | 'lg' | 'xl'

/** Min touch target 48px (WCAG 2.5.8); lg = primary action 56px; xl = cooking mode 72px. */
const SIZES: Record<ButtonSize, string> = {
  md: 'min-h-[48px] px-4 text-[17px]',
  lg: 'min-h-[56px] px-5 text-[18px]',
  xl: 'min-h-[72px] px-6 text-[20px]',
}

export const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  // #c2410c + white text clears 4.5:1; never use #ea580c/#f97316 with white.
  primary: 'bg-action text-white hover:bg-action-hover',
  // #111827 with white text (17:1): secondary actions on light surfaces (A5 gallery lock, cooking mode).
  dark: 'bg-ink text-white hover:bg-ink-soft',
  // Secondary: white with a 2 px #111827 frame (style 1b).
  outline: 'bg-white text-ink border-2 border-ink hover:bg-surface-3',
  danger: 'bg-white text-danger border-2 border-danger hover:bg-surface-3',
  // Brand blue: white text only at 19px+ bold (large text, 4.2:1 vs AA's 3:1).
  facebook: 'bg-facebook text-white hover:brightness-90',
}

// wrap-anywhere: a label echoing user text (a search query) wraps instead of
// scrolling the page sideways at 320 px (WCAG 1.4.10). no-underline!: a <Link>
// styled as a button is recognisable by its shape, so it drops the global link
// underline (the `!` beats the unlayered `a` rule in globals.css).
// No radius and no gap here: the action cards (action-card.tsx) build on the same core.
export const BUTTON_CORE =
  'inline-flex items-center justify-center font-bold no-underline! ' +
  'leading-tight wrap-anywhere transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
const BASE = `${BUTTON_CORE} gap-2 rounded-pill`

/** Shared class string so <Link> and <button> render identically. */
export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'lg'): string {
  return `${BASE} ${SIZES[size]} ${BUTTON_VARIANTS[variant]}`
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

/** Defaults to type="button" so it never submits a surrounding form by accident; pass type="submit" explicitly. */
export function Button({ variant = 'primary', size = 'lg', className = '', type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={`${buttonClasses(variant, size)} ${className}`} {...props} />
}
