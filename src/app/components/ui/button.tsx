import type { ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'outline' | 'danger'
export type ButtonSize = 'md' | 'lg' | 'xl'

/** Min touch target 48px (WCAG 2.5.8); lg = primary action 56px; xl = cooking mode 72px. */
const SIZES: Record<ButtonSize, string> = {
  md: 'min-h-[48px] px-4 text-[17px]',
  lg: 'min-h-[56px] px-5 text-[18px]',
  xl: 'min-h-[72px] px-6 text-[20px]',
}

const VARIANTS: Record<ButtonVariant, string> = {
  // #c2410c + white text clears 4.5:1; never use #ea580c/#f97316 with white.
  primary: 'bg-action text-white hover:bg-action-hover',
  outline: 'bg-white text-ink border-2 border-field hover:bg-surface-3',
  danger: 'bg-white text-danger border-2 border-danger hover:bg-surface-3',
}

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-field font-bold ' +
  'leading-tight transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

/** Shared class string so <Link> and <button> render identically. */
export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'lg'): string {
  return `${BASE} ${SIZES[size]} ${VARIANTS[variant]}`
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function Button({ variant = 'primary', size = 'lg', className = '', ...props }: ButtonProps) {
  return <button className={`${buttonClasses(variant, size)} ${className}`} {...props} />
}
