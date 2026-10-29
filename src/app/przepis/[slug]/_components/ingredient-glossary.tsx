import { ChevronDown } from 'lucide-react'
import type { GlossaryEntry } from '@/lib/ingredient-glossary'

/**
 * „Mniej znane nazwy” (#544): a short explanation of each unfamiliar ingredient or dish
 * name the recipe mentions (manchego, guanciale, aioli), with a common substitute when
 * there is one. Each term is a native `<details>`: a visible, labelled 48 px control that
 * opens by tap, click or keyboard (Enter/Space) and works without JS — never hover-only.
 * Nothing renders when the recipe mentions no glossary term.
 */
export function IngredientGlossary({ entries }: { entries: GlossaryEntry[] }) {
  if (entries.length === 0) return null
  return (
    <section aria-labelledby="glossary-heading" className="mt-8 print:hidden">
      <h3 id="glossary-heading" className="text-[19px] font-bold text-ink">
        Mniej znane nazwy
      </h3>
      <p className="mb-2 text-[16px] text-ink-soft">Kliknij nazwę, żeby zobaczyć wyjaśnienie.</p>
      <ul>
        {entries.map((entry) => (
          <li key={entry.term} className="border-b-[1.5px] border-border-card">
            <details className="group">
              {/* list-none + the webkit marker rule drop the default triangle; the chevron
                  replaces it and turns when open. The question itself is the label. */}
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-2 text-[17px] font-bold text-action-text underline hover:text-action-hover [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 break-words">Co to jest {entry.term}?</span>
                <ChevronDown aria-hidden="true" size={22} strokeWidth={2.5} className="shrink-0 transition-transform group-open:rotate-180" />
              </summary>
              {/* 19 px on the parent: .text-scalable scales its parent's size. */}
              <div className="pb-3 text-[19px]">
                <p className="text-scalable leading-snug text-ink">{entry.explanation}</p>
                {entry.substitute && (
                  <p className="text-scalable mt-1 leading-snug text-ink-soft">
                    <b className="text-ink">Zamiennik:</b> {entry.substitute}
                  </p>
                )}
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  )
}
