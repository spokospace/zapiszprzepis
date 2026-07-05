'use client'

import { useEffect, useState } from 'react'
import { Link, Mic, Search, X } from 'lucide-react'
import { addRecipeFromUrl } from '@/app/(authenticated)/recipes/add-recipe-action'
import { searchViaExa, type ExaResult } from '@/app/(authenticated)/recipes/search-via-exa-action'

type SearchState = 'idle' | 'loading' | 'searching' | 'results' | 'error' | 'recording' | 'mic_error'

function parseHostname(url: string): string {
  try { return new URL(url).hostname } catch { return url }
}

const ADD_ERROR_MESSAGES: Record<string, string> = {
  empty: 'Wklej adres URL lub wpisz nazwę przepisu.',
  invalid_url: 'To nie wygląda jak prawidłowy URL.',
  server: 'Coś poszło nie tak. Spróbuj ponownie.',
}

function ExaResultsPanel({ results, onClose }: { results: ExaResult[]; onClose: () => void }) {
  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-medium text-gray-700">
          {results.length === 0
            ? 'Brak wyników'
            : `${results.length} wynik${results.length === 1 ? '' : 'ów'} z sieci`}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
          aria-label="Zamknij wyniki"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {results.length === 0 ? (
        <p className="px-4 py-3 text-sm text-gray-500">Brak wyników — spróbuj innego zapytania lub wklej link.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {results.map((result) => {
            const hostname = parseHostname(result.url)
            return (
              <li key={result.url} className="px-4 py-3 space-y-2">
                <div>
                  <p className="text-sm font-medium text-gray-900 line-clamp-1">{result.title}</p>
                  <p className="text-xs text-gray-500 truncate">{hostname}</p>
                </div>
                {!!result.highlights?.length && (
                  <ul className="space-y-1">
                    {result.highlights.map((h, i) => (
                      <li key={i} className="text-xs text-gray-600 leading-relaxed line-clamp-3">{h}</li>
                    ))}
                  </ul>
                )}
                <div className="flex items-center gap-3">
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-orange-600 hover:underline flex-1 truncate"
                  >
                    Otwórz stronę ↗
                  </a>
                  {result.alreadySaved ? (
                    <span className="shrink-0 text-xs text-green-600 font-medium">Już zapisany</span>
                  ) : (
                    <form action={addRecipeFromUrl}>
                      <input type="hidden" name="url" value={result.url} />
                      <button
                        type="submit"
                        className="shrink-0 rounded-md bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600"
                      >
                        Zapisz
                      </button>
                    </form>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function AddRecipeForm({ addError }: { addError?: string | null }) {
  const [activeTab, setActiveTab] = useState<'search' | 'add'>('search')
  const [searchState, setSearchState] = useState<SearchState>('idle')
  const [exaResults, setExaResults] = useState<ExaResult[]>([])
  const [isSpeechSupported] = useState(
    () => typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  )

  useEffect(() => {
    if (addError) {
      const url = new URL(window.location.href)
      url.searchParams.delete('add_error')
      window.history.replaceState({}, '', url.toString())
    }
  }, [addError])

  const handleSubmit = async (formData: FormData) => {
    const value = String(formData.get('url') ?? '').trim()
    if (activeTab === 'add') {
      setSearchState('loading')
      try {
        await addRecipeFromUrl(formData)
      } finally {
        setSearchState('idle')
      }
    } else {
      if (!value) return
      setSearchState('searching')
      const res = await searchViaExa(value)
      if ('error' in res) {
        setSearchState('error')
      } else {
        setExaResults(res.results)
        setSearchState('results')
      }
    }
  }

  const startVoiceSearch = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition) as new () => any
    const recognition = new SR()
    recognition.lang = 'pl-PL'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    setSearchState('recording')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript
      setSearchState('searching')
      const res = await searchViaExa(transcript)
      if ('error' in res) {
        setSearchState('error')
      } else {
        setExaResults(res.results)
        setSearchState('results')
      }
    }

    recognition.onerror = () => {
      setSearchState('mic_error')
    }

    // If recognition ends before onresult fires (e.g. no speech detected), reset to idle.
    recognition.onend = () => {
      setSearchState((prev) => (prev === 'recording' ? 'idle' : prev))
    }

    recognition.start()
  }

  const tabClass = (tab: 'search' | 'add') =>
    `px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
      activeTab === tab
        ? 'border-orange-500 text-orange-600'
        : 'border-transparent text-gray-500 hover:text-gray-700'
    }`

  const busy = searchState === 'loading' || searchState === 'searching' || searchState === 'recording'

  return (
    <div>
      <div className="flex border-b border-gray-200 mb-4">
        <button
          type="button"
          onClick={() => { setActiveTab('search'); setSearchState('idle') }}
          className={tabClass('search')}
        >
          Wyszukaj przepis
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('add'); setSearchState('idle') }}
          className={tabClass('add')}
        >
          Dodaj przez link
        </button>
      </div>

      <form action={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          {activeTab === 'search'
            ? <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            : <Link aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          }
          <input
            name="url"
            type="text"
            aria-label={activeTab === 'search' ? 'Szukaj przepisu' : 'URL przepisu'}
            placeholder={activeTab === 'search' ? 'Wpisz nazwę przepisu, np. tiramisu' : 'Wklej link do przepisu'}
            disabled={busy}
            className={`w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 ${isSpeechSupported && activeTab === 'search' ? 'pr-9' : 'pr-3'} text-sm text-gray-900 placeholder:text-gray-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:bg-gray-50`}
          />
          {isSpeechSupported && activeTab === 'search' && (
            <button
              type="button"
              onClick={startVoiceSearch}
              disabled={busy}
              aria-label="Wyszukaj głosem"
              className={`absolute right-3 top-1/2 -translate-y-1/2 disabled:opacity-40 ${searchState === 'recording' ? 'text-orange-500' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <Mic className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-orange-300"
        >
          {busy ? (
            <>
              <svg aria-hidden="true" className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              {searchState === 'recording' ? 'Słucham…' : searchState === 'searching' ? 'Szukam…' : 'Wysyłanie…'}
            </>
          ) : activeTab === 'search' ? 'Szukaj' : 'Dodaj przepis'}
        </button>
      </form>
      {addError && activeTab === 'add' && (
        <p role="alert" className="mt-1.5 text-sm text-red-600">
          {ADD_ERROR_MESSAGES[addError] ?? ADD_ERROR_MESSAGES.server}
        </p>
      )}
      {searchState === 'error' && (
        <p role="alert" className="mt-1.5 text-sm text-red-600">
          Wyszukiwanie niedostępne — wklej link ręcznie.
        </p>
      )}
      {searchState === 'mic_error' && (
        <p role="alert" className="mt-1.5 text-sm text-red-600">
          Brak dostępu do mikrofonu — wpisz ręcznie.
        </p>
      )}
      {searchState === 'results' && (
        <ExaResultsPanel results={exaResults} onClose={() => setSearchState('idle')} />
      )}
    </div>
  )
}
