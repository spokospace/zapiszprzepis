'use client'

import { useState } from 'react'
import { Globe } from 'lucide-react'
import { buttonClasses } from '@/app/components/ui/button'
import { ExaResultsPanel } from '@/app/components/add-recipe-form'
import { searchViaExa, type ExaResult } from '@/app/(authenticated)/recipes/search-via-exa-action'
import { webSearchUrl } from '@/lib/search'

type State = { kind: 'idle' } | { kind: 'searching' } | { kind: 'results'; results: ExaResult[] } | { kind: 'error' }

/**
 * The empty search result (E01-S05): „Nie ma tego, czego szukasz?”. With full
 * access the existing Exa web search runs in place, with its "Zapisz" action;
 * everyone else (Exa is paid, E01-S11) gets a regular web search in a new tab.
 */
export function WebSearchFallback({ q, hasFullAccess }: { q: string; hasFullAccess: boolean }) {
  const [state, setState] = useState<State>({ kind: 'idle' })
  const label = `Szukaj „${q}” w internecie`

  async function runExa() {
    setState({ kind: 'searching' })
    const res = await searchViaExa(q)
    setState('error' in res ? { kind: 'error' } : { kind: 'results', results: res.results })
  }

  return (
    <section aria-labelledby="no-results-heading" className="mt-6">
      <h2 id="no-results-heading" className="text-[22px] font-bold text-ink">
        Nie ma tego, czego szukasz?
      </h2>
      <p className="mt-2 text-[19px] text-ink-soft">
        Żaden przepis nie pasuje do „{q}”. Sprawdź pisownię albo poszukaj w internecie.
      </p>
      {hasFullAccess ? (
        <>
          <button
            type="button"
            onClick={runExa}
            disabled={state.kind === 'searching'}
            aria-busy={state.kind === 'searching'}
            className={`${buttonClasses('primary', 'lg')} mt-4 w-full`}
          >
            <Globe aria-hidden="true" className="h-5 w-5" />
            {state.kind === 'searching' ? 'Szukam…' : label}
          </button>
          {state.kind === 'error' && (
            <p role="alert" className="mt-3 text-[16px] text-danger">
              Nie udało się przeszukać internetu. Spróbuj ponownie.
            </p>
          )}
          {state.kind === 'results' && (
            <ExaResultsPanel results={state.results} onClose={() => setState({ kind: 'idle' })} />
          )}
        </>
      ) : (
        <a
          href={webSearchUrl(q)}
          target="_blank"
          rel="noopener noreferrer"
          className={`${buttonClasses('primary', 'lg')} mt-4 w-full flex-wrap text-center`}
        >
          <Globe aria-hidden="true" className="h-5 w-5" />
          {label}
          <span className="text-[16px] font-normal">(otworzy się w nowej karcie)</span>
        </a>
      )}
    </section>
  )
}
