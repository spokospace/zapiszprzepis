'use client'

import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { ArrowRight, Check, ExternalLink, Globe, Lock, Plus } from 'lucide-react'
import { buttonClasses } from '@/app/components/ui/button'
import { searchViaExa, type ExaResult } from '@/app/(authenticated)/recipes/search-via-exa-action'
import { addRecipeFromUrl } from '@/app/(authenticated)/recipes/add-recipe-action'
import { recipesNoun } from '@/app/components/app-menu-model'
import { loginPath } from '@/lib/login-redirect'
import { bindOrphans } from '@/lib/polish-typography'
import { ADD_RECIPE_PATH, recipePath, searchPath } from '@/lib/routes'

export type BlogState =
  | { kind: 'idle' }
  | { kind: 'searching' }
  | { kind: 'results'; results: ExaResult[] }
  | { kind: 'error'; rateLimited: boolean }

type Tab = 'local' | 'web'

const TAB_ID: Record<Tab, string> = { local: 'search-tab-local', web: 'search-tab-web' }
const PANEL_ID: Record<Tab, string> = { local: 'search-panel-local', web: 'search-panel-web' }

/**
 * Blog search runs only when asked (slow, paid per query): never for a guest,
 * and once per query — a result or a running search is kept when the tab is
 * reopened; only an error may be retried.
 */
export function shouldSearchBlogs(isAuthenticated: boolean, state: BlogState): boolean {
  return isAuthenticated && state.kind === 'idle'
}

/** The second line of the „Na blogach” tab. */
export function blogTabCaption(isAuthenticated: boolean, state: BlogState): string {
  if (!isAuthenticated) return 'po zalogowaniu'
  if (state.kind === 'searching') return 'szukamy…'
  if (state.kind === 'results') return `${state.results.length} ${recipesNoun(state.results.length)}`
  return 'kliknij, aby szukać'
}

/**
 * The /szukaj results as two tabs (E01-S30, handoff v8 „Dwie zakładki”): „W
 * serwisie” (the app's own results, server-rendered into `children`) and „Na
 * blogach”, which searches the trusted recipe sites with Exa on demand. The
 * page keys this by query, so a new query starts with a fresh blog search.
 */
export function SearchTabs({
  q,
  localCount,
  hasLocalResults,
  isAuthenticated,
  hasFullAccess,
  children,
}: {
  q: string
  /** The service count, e.g. „12 przepisów”. */
  localCount: string
  hasLocalResults: boolean
  isAuthenticated: boolean
  hasFullAccess: boolean
  children?: ReactNode
}) {
  const [tab, setTab] = useState<Tab>('local')
  const [blog, setBlog] = useState<BlogState>({ kind: 'idle' })
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ local: null, web: null })

  async function runBlogSearch() {
    setBlog({ kind: 'searching' })
    const res = await searchViaExa(q)
    setBlog('error' in res ? { kind: 'error', rateLimited: res.error === 'rate_limited' } : { kind: 'results', results: res.results })
  }

  function select(next: Tab, focus = false) {
    setTab(next)
    if (focus) tabRefs.current[next]?.focus()
    if (next === 'web' && shouldSearchBlogs(isAuthenticated, blog)) void runBlogSearch()
  }

  // Arrow keys move between the two tabs (WAI-ARIA tabs pattern, automatic activation).
  function onTabKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      const next: Tab = e.key === 'Home' ? 'local' : e.key === 'End' ? 'web' : tab === 'local' ? 'web' : 'local'
      select(next, true)
    }
  }

  const tabClass = (on: boolean) =>
    `flex min-h-[60px] flex-col items-center justify-center rounded-tile border-2 px-2 py-1.5 text-center leading-tight wrap-anywhere ${
      on ? 'border-surface-dark bg-surface-dark text-white' : 'border-field bg-white text-ink hover:bg-surface-3'
    }`

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Gdzie szukać" className="grid grid-cols-2 gap-1.5" onKeyDown={onTabKeyDown}>
        <button
          ref={(el) => {
            tabRefs.current.local = el
          }}
          type="button"
          role="tab"
          id={TAB_ID.local}
          aria-selected={tab === 'local'}
          aria-controls={PANEL_ID.local}
          tabIndex={tab === 'local' ? 0 : -1}
          onClick={() => select('local')}
          className={tabClass(tab === 'local')}
        >
          <span className="text-[18px] font-bold">W serwisie</span>
          <span className="text-[16px]">{localCount}</span>
        </button>
        <button
          ref={(el) => {
            tabRefs.current.web = el
          }}
          type="button"
          role="tab"
          id={TAB_ID.web}
          aria-selected={tab === 'web'}
          aria-controls={PANEL_ID.web}
          tabIndex={tab === 'web' ? 0 : -1}
          onClick={() => select('web')}
          className={tabClass(tab === 'web')}
        >
          <span className="inline-flex items-center gap-1.5 text-[18px] font-bold">
            Na blogach
            {!isAuthenticated && (
              <>
                <Lock aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span className="sr-only">(wymaga logowania)</span>
              </>
            )}
          </span>
          <span className="text-[16px]">{blogTabCaption(isAuthenticated, blog)}</span>
        </button>
      </div>

      {/* Hidden, not unmounted: the server-rendered results stay in the page. */}
      <div role="tabpanel" id={PANEL_ID.local} aria-labelledby={TAB_ID.local} hidden={tab !== 'local'} className="flex flex-col gap-4">
        {children}
        <section aria-labelledby="blog-prompt-heading" className="mt-2 rounded-tile border-2 border-border-card bg-surface-2 p-4">
          <h2 id="blog-prompt-heading" className="text-[22px] font-bold text-ink">
            {hasLocalResults ? 'Szukasz innej wersji?' : 'Poszukaj na blogach'}
          </h2>
          <p className="mt-1 text-[17px] text-ink-soft">
            {bindOrphans('Przeszukamy polskie blogi kulinarne i strony z przepisami.')}
          </p>
          <button type="button" onClick={() => select('web', true)} className={`${buttonClasses('primary', 'lg')} mt-3 w-full text-center`}>
            <Globe aria-hidden="true" className="h-5 w-5 shrink-0" />
            Szukaj „{q}” na blogach
          </button>
        </section>
      </div>

      {/* Always present for aria-controls; filled only once opened. */}
      <div role="tabpanel" id={PANEL_ID.web} aria-labelledby={TAB_ID.web} hidden={tab !== 'web'} className="flex flex-col gap-4">
        {tab === 'web' && (
          <BlogPanel q={q} state={blog} isAuthenticated={isAuthenticated} hasFullAccess={hasFullAccess} onRetry={runBlogSearch} />
        )}
      </div>
    </div>
  )
}

/** The „Na blogach” panel, pure view (split out for tests). */
export function BlogPanel({
  q,
  state,
  isAuthenticated,
  hasFullAccess,
  onRetry,
}: {
  q: string
  state: BlogState
  isAuthenticated: boolean
  hasFullAccess: boolean
  onRetry: () => void
}) {
  if (!isAuthenticated) {
    // Exa is paid: a guest only ever sees the way to log in, no request is made.
    return (
      <div className="flex flex-col items-start gap-3 rounded-tile border-2 border-border-card bg-white p-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-3 text-ink">
          <Lock aria-hidden="true" className="h-7 w-7" />
        </span>
        <h2 className="text-[22px] font-bold text-ink">Szukanie na blogach po zalogowaniu</h2>
        <p className="text-[17px] text-ink-soft">
          {bindOrphans(`Znajdziemy przepis „${q}” na polskich blogach kulinarnych.`)}
        </p>
        <Link href={loginPath(searchPath(q))} className={`${buttonClasses('primary', 'lg')} w-full`}>
          Zaloguj się i szukaj na blogach
        </Link>
      </div>
    )
  }
  if (state.kind === 'idle' || state.kind === 'searching') {
    return (
      <div role="status" className="flex flex-col items-center gap-2 py-8 text-center">
        <span aria-hidden="true" className="h-12 w-12 animate-spin rounded-full border-[5px] border-border-accent border-t-action" />
        <p className="text-[19px] font-bold text-ink">Szukamy na blogach…</p>
        <p className="text-[16px] text-ink-soft">To trwa kilka sekund.</p>
      </div>
    )
  }
  if (state.kind === 'error') {
    return (
      <div className="flex flex-col gap-3">
        <p role="alert" className="text-[17px] text-danger">
          {state.rateLimited
            ? 'Za dużo wyszukiwań naraz. Spróbuj ponownie za minutę.'
            : 'Nie udało się przeszukać blogów. Spróbuj ponownie.'}
        </p>
        <button type="button" onClick={onRetry} className={`${buttonClasses('outline', 'lg')} w-full`}>
          Spróbuj ponownie
        </button>
      </div>
    )
  }
  const n = state.results.length
  return (
    <>
      <p role="status" className="text-[19px] text-ink">
        {n === 0 ? (
          <>Nic nie znaleźliśmy na blogach dla „{q}”. Spróbuj innej nazwy dania albo składnika.</>
        ) : (
          <>
            <strong>
              {n} {recipesNoun(n)}
            </strong>{' '}
            z blogów dla „{q}”
          </>
        )}
      </p>
      {n > 0 && (
        <ul className="flex flex-col gap-3">
          {state.results.map((result) => (
            <li key={result.url}>
              <BlogResultCard result={result} canSave={hasFullAccess} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** One blog result (handoff „Wynik z bloga”, „Wynik z bloga, który już mamy”, „Zapis z bloga”). */
function BlogResultCard({ result, canSave }: { result: ExaResult; canSave: boolean }) {
  const { existing } = result
  return (
    <article className="flex flex-col gap-2 rounded-tile border-2 border-border-card bg-white p-4">
      <p className="inline-flex items-center gap-1.5 text-[16px] break-words text-ink-soft">
        <Globe aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
        {hostname(result.url)}
      </p>
      <h3 className="text-[19px] leading-snug font-bold break-words text-ink">{result.title}</h3>
      {!!result.highlights?.length && (
        <p className="line-clamp-3 text-[16px] leading-relaxed text-ink-soft">{result.highlights[0]}</p>
      )}
      {existing && (
        <p className="inline-flex items-center gap-1.5 text-[17px] font-bold text-success">
          <Check aria-hidden="true" className="h-5 w-5 shrink-0" />
          {existing.owner === 'own' ? 'Masz go w Moich przepisach' : 'Ten przepis jest już w aplikacji Zapisz Przepis'}
        </p>
      )}
      <div className="mt-1 flex flex-col gap-2">
        {existing ? (
          <Link href={recipePath(existing.slug)} className={`${buttonClasses('primary', 'md')} w-full`}>
            <ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0" />
            Otwórz w aplikacji Zapisz Przepis
          </Link>
        ) : canSave ? (
          <form action={addRecipeFromUrl}>
            <input type="hidden" name="url" value={result.url} />
            <SaveButton />
          </form>
        ) : (
          // Saving creates the user's own recipe, so it needs full access: the code gate (3c).
          <Link href={ADD_RECIPE_PATH} className={`${buttonClasses('outline', 'md')} w-full`}>
            <Lock aria-hidden="true" className="h-5 w-5 shrink-0" />
            Odblokuj zapisywanie
          </Link>
        )}
        <a
          href={result.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[48px] items-center justify-center gap-2 text-[16px] font-bold text-ink"
        >
          <ExternalLink aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
          Otwórz stronę bloga
          {/* A new tab is announced to screen readers only (owner: no visible note). */}
          <span className="sr-only"> (w nowej karcie)</span>
        </a>
      </div>
    </article>
  )
}

function SaveButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={`${buttonClasses('primary', 'md')} w-full`}>
      <Plus aria-hidden="true" className="h-5 w-5 shrink-0" />
      {pending ? 'Zapisujemy…' : 'Zapisz do moich przepisów'}
    </button>
  )
}
