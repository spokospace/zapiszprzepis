import { Camera, Link as LinkIcon } from 'lucide-react'
import { AddFromLinkForm } from './add-from-link-form'
import type { AddRecipeError } from '@/lib/routes'

const STEPS = [
  'Skopiuj link do przepisu ze strony, YouTube, Facebooka albo Instagrama.',
  'Wklej go w pole powyżej i kliknij „Dodaj przepis”.',
  'Przepis pojawi się w „Moich przepisach” za chwilę. Powiadomimy Cię, gdy będzie gotowy.',
]

/**
 * A7 (E01-S10): where the recipe comes from, the link form, and how adding
 * works. The source tiles are status, not controls: "Z linku" is the only live
 * source, and adding from a photo is a backlog non-goal shown as "wkrótce".
 */
export function AddRecipePanel({ error = null, autoFocus }: { error?: AddRecipeError | null; autoFocus?: boolean }) {
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="add-source-heading">
        <h2 id="add-source-heading" className="mb-2 text-[19px] font-bold text-ink">
          Skąd dodajesz przepis?
        </h2>
        <ul className="grid grid-cols-2 gap-2.5">
          <li className="flex flex-col gap-1 rounded-card border-[3px] border-action bg-surface-accent p-3">
            <LinkIcon aria-hidden="true" className="h-6 w-6 text-action-text" />
            <span className="text-[19px] font-bold text-ink">Z linku</span>
            <span className="text-[16px] text-ink-soft">Strona, YouTube, Facebook, Instagram</span>
            <span className="mt-auto self-start rounded-pill bg-action px-2 py-0.5 text-[14px] font-bold text-white">
              Wybrane
            </span>
          </li>
          <li className="flex flex-col gap-1 rounded-card border-2 border-dashed border-field bg-surface-3 p-3">
            <Camera aria-hidden="true" className="h-6 w-6 text-ink-soft" />
            <span className="text-[19px] font-bold text-ink">Ze zdjęcia</span>
            <span className="text-[16px] text-ink-soft">Zdjęcie przepisu albo strony z książki</span>
            <span className="mt-auto self-start rounded-pill border border-field bg-white px-2 py-0.5 text-[14px] font-bold text-ink-soft">
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
      </section>
    </div>
  )
}
