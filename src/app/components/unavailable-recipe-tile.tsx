import type { ReactNode } from 'react'

/**
 * The row a hidden recipe leaves in „Moje przepisy” and „Ulubione” (admin panel,
 * Phase 2). It carries neither the title nor a link: the public views no longer
 * hold the recipe, and the owner or favoriter only needs to know it is not gone
 * for good. `action` is an optional control (ulubione: „Usuń z ulubionych”).
 */
export function UnavailableRecipeTile({ action }: { action?: ReactNode }) {
  return (
    <div className="flex h-full flex-col justify-between gap-3 rounded-tile border-2 border-dashed border-border-card-2 bg-surface-2 p-4">
      <div>
        <p className="text-[18px] font-bold text-ink">Przepis jest niedostępny</p>
        <p className="mt-1 text-ink-soft">Ten przepis został tymczasowo ukryty.</p>
      </div>
      {action}
    </div>
  )
}
