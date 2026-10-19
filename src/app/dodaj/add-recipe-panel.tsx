import { Camera, Link as LinkIcon } from 'lucide-react'
import { AddFromLinkForm } from './add-from-link-form'
import type { AddRecipeError } from '@/lib/routes'

// A7 wording from the design handoff (.ai/design/przebudowa-handoff, Propozycja A).
const STEPS = [
  'Wklejasz link, my spisujemy przepis po polsku.',
  'Trwa to 1–3 minuty. Możesz zamknąć stronę.',
  'Gotowy przepis pojawi się w „Moje przepisy”, a dzwonek da znać o problemie.',
]

/**
 * A7 (E01-S10): where the recipe comes from, the link form, and how adding
 * works. The source tiles are status, not controls: "Z linku" is the only live
 * source; "Ze zdjęcia" is already in place but greyed with "wkrótce", so
 * enabling it later won't change the layout.
 */
export function AddRecipePanel({ error = null, autoFocus }: { error?: AddRecipeError | null; autoFocus?: boolean }) {
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="add-source-heading">
        <h2 id="add-source-heading" className="mb-2 text-[19px] font-bold text-ink">
          Skąd dodajesz przepis?
        </h2>
        <ul className="grid grid-cols-2 gap-2.5">
          <li className="flex flex-col gap-1 rounded-card border-2 border-action bg-surface-accent p-3">
            <LinkIcon aria-hidden="true" className="h-6 w-6 text-action-text" />
            <span className="text-[19px] font-bold text-ink">Z linku</span>
            <span className="text-[16px] text-ink-soft">Facebook, YouTube, blog</span>
          </li>
          <li className="flex flex-col gap-1 rounded-card border-2 border-dashed border-field bg-surface-3 p-3">
            <Camera aria-hidden="true" className="h-6 w-6 text-ink-soft" />
            <span className="text-[19px] font-bold text-ink">Ze zdjęcia</span>
            <span className="text-[16px] text-ink-soft">Zrzut ekranu lub książka</span>
            {/* The word, not just the grey, says it is unavailable (WCAG 1.4.1). */}
            <span className="mt-auto self-start rounded-pill border border-field bg-white px-2 py-0.5 text-[16px] font-bold text-ink-soft">
              wkrótce
            </span>
          </li>
        </ul>
      </section>

      <AddFromLinkForm error={error} autoFocus={autoFocus} />

      <section aria-labelledby="add-steps-heading">
        <h2 id="add-steps-heading" className="mb-2 text-[22px] font-bold text-ink">
          Jak to działa
        </h2>
        <ol className="list-decimal space-y-1.5 pl-6 text-[19px] leading-normal text-ink">
          {STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="mt-3 text-[16px] text-ink-soft">
          Na telefonie możesz też użyć „Udostępnij → ZapiszPrzepis” prosto z Facebooka lub YouTube.
        </p>
      </section>
    </div>
  )
}
