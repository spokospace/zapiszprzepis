'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ExternalLink, Globe, X } from 'lucide-react'
import { buttonClasses } from '@/app/components/ui/button'
import { searchViaExa, type ExaResult } from '@/app/(authenticated)/recipes/search-via-exa-action'
import { addRecipeFromUrl } from '@/app/(authenticated)/recipes/add-recipe-action'
import { loginPath } from '@/lib/login-redirect'
import { searchPath } from '@/lib/routes'

type State =
  | { kind: 'idle' }
  | { kind: 'searching' }
  | { kind: 'results'; results: ExaResult[] }
  | { kind: 'error'; rateLimited: boolean }

/**
 * „Nie ma tego, czego szukasz?” at the end of every result list (E01-S05; A3,
 * E01-S22: not only when nothing matched). A signed-in account searches the web
 * in place with Exa, limited to the trusted recipe sites; adding a found recipe
 * ("Zapisz przepis") still needs full access (E01-S11). A guest is asked to sign
 * in — Exa is paid, so it is never run for anonymous visitors.
 */
export function WebSearchFallback({
  q,
  isAuthenticated,
  hasFullAccess,
  hasResults,
}: {
  q: string
  isAuthenticated: boolean
  hasFullAccess: boolean
  /** Some recipes matched: the note under the heading no longer says none did. */
  hasResults: boolean
}) {
  const [state, setState] = useState<State>({ kind: 'idle' })

  async function runExa() {
    setState({ kind: 'searching' })
    const res = await searchViaExa(q)
    setState('error' in res ? { kind: 'error', rateLimited: res.error === 'rate_limited' } : { kind: 'results', results: res.results })
  }

  return (
    <section aria-labelledby="no-results-heading" className="mt-6">
      <h2 id="no-results-heading" className="text-[22px] font-bold text-ink">
        Nie ma tego, czego szukasz?
      </h2>
      <p className="mt-2 text-[19px] text-ink-soft">
        {hasResults
          ? 'Poszukaj tego przepisu na sprawdzonych stronach z przepisami.'
          : `Żaden przepis nie pasuje do „${q}”. Sprawdź pisownię albo poszukaj na sprawdzonych stronach z przepisami.`}
      </p>
      {!isAuthenticated ? (
        <>
          <p className="mt-2 text-[17px] text-ink-soft">Wyszukiwanie w internecie jest dostępne po zalogowaniu.</p>
          <Link href={loginPath(searchPath(q))} className={`${buttonClasses('primary', 'lg')} mt-4 w-full`}>
            Zaloguj się i szukaj w internecie
          </Link>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={runExa}
            disabled={state.kind === 'searching'}
            aria-busy={state.kind === 'searching'}
            className={`${buttonClasses('primary', 'lg')} mt-4 w-full text-center`}
          >
            <Globe aria-hidden="true" className="h-5 w-5 shrink-0" />
            {state.kind === 'searching' ? 'Szukam…' : `Szukaj „${q}” w internecie`}
          </button>
          <div aria-live="polite">
            {state.kind === 'error' && (
              <p role="alert" className="mt-3 text-[17px] text-danger">
                {state.rateLimited
                  ? 'Za dużo wyszukiwań naraz. Spróbuj ponownie za minutę.'
                  : 'Nie udało się przeszukać internetu. Spróbuj ponownie.'}
              </p>
            )}
            {state.kind === 'results' && (
              <WebResults results={state.results} canSave={hasFullAccess} onClose={() => setState({ kind: 'idle' })} />
            )}
          </div>
        </>
      )}
    </section>
  )
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Exa results in the 1c card look: title, site, a short excerpt, open / save. */
function WebResults({ results, canSave, onClose }: { results: ExaResult[]; canSave: boolean; onClose: () => void }) {
  return (
    <div className="mt-4 rounded-card border-2 border-border-card bg-white">
      <div className="flex items-center justify-between gap-3 border-b-2 border-border-card py-1 pr-1 pl-4">
        <h3 className="text-[19px] font-bold text-ink">
          {results.length === 0 ? 'Nic nie znaleźliśmy' : `Znalezione w internecie: ${results.length}`}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-[48px] shrink-0 items-center gap-1.5 rounded-field px-3 text-[17px] font-bold text-ink hover:bg-surface-3"
        >
          <X aria-hidden="true" className="h-5 w-5" />
          Zamknij
        </button>
      </div>
      {results.length === 0 ? (
        <p className="p-4 text-[17px] text-ink-soft">Spróbuj innej nazwy dania albo składnika.</p>
      ) : (
        <ul className="divide-y-2 divide-border-card">
          {results.map((result) => (
            <li key={result.url} className="flex flex-col gap-2 p-4">
              <p className="text-[19px] leading-snug font-bold break-words text-ink">{result.title}</p>
              <p className="text-[16px] break-words text-ink-soft">{hostname(result.url)}</p>
              {!!result.highlights?.length && (
                <p className="line-clamp-3 text-[16px] leading-relaxed text-ink-soft">{result.highlights[0]}</p>
              )}
              <div className="mt-1 flex flex-wrap gap-2">
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${buttonClasses('outline', 'md')} grow`}
                >
                  <ExternalLink aria-hidden="true" className="h-5 w-5 shrink-0" />
                  Otwórz stronę
                  {/* A new tab is announced to screen readers only (owner: no visible note). */}
                  <span className="sr-only"> (w nowej karcie)</span>
                </a>
                {canSave &&
                  (result.alreadySaved ? (
                    <span className="inline-flex min-h-[48px] items-center px-2 text-[17px] font-bold text-success">
                      Już zapisany
                    </span>
                  ) : (
                    <form action={addRecipeFromUrl} className="grow">
                      <input type="hidden" name="url" value={result.url} />
                      <button type="submit" className={`${buttonClasses('primary', 'md')} w-full`}>
                        Zapisz przepis
                      </button>
                    </form>
                  ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
