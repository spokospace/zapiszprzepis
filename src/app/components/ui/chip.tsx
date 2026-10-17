import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Controlled pressed state; sets aria-pressed and the selected styling. */
  selected?: boolean
  /** Optional count shown after the label ("kruche · 12"). */
  count?: number
  children: ReactNode
}

/** The chip look, for a chip that has to be a link (E01-S16 tag filter, "Ten przepis jest"). */
export function chipClasses(selected = false): string {
  const look = selected
    ? 'bg-ink text-white border-ink'
    : 'bg-white text-ink border-border-card-2 hover:bg-surface-3'
  return `inline-flex min-h-[48px] items-center gap-2 rounded-pill border-2 px-4 text-[17px] font-bold leading-tight wrap-anywhere no-underline! transition-colors ${look}`
}

/**
 * Toggle chip for tag/scope filters (E01-S05, S14, S16). Min 48px target, pill
 * shape; selected = dark fill + white text + "✓ " prefix, announced via aria-pressed.
 */
export function Chip({ selected = false, count, className = '', children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`${chipClasses(selected)} ${className}`}
      {...props}
    >
      <span>
        {selected ? '✓ ' : ''}
        {children}
      </span>
      {typeof count === 'number' && <span className="text-[16px] font-normal opacity-80">{count}</span>}
    </button>
  )
}
