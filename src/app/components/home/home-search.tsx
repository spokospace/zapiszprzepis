'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, Search } from 'lucide-react'
import { buttonClasses } from '@/app/components/ui/button'
import { SEARCH_PATH } from '@/lib/routes'
import { isSpeechRecognitionSupported, speechRecognitionCtor, type SpeechRecognitionLike } from '@/lib/speech'

type MicState = 'idle' | 'listening' | 'error'

const MIC_STATUS: Record<MicState, string> = {
  idle: '',
  listening: 'Słucham… powiedz, czego szukasz.',
  error: 'Nie udało się rozpoznać mowy. Wpisz nazwę przepisu.',
}

/**
 * The home search (E01-S04): a plain GET form to SEARCH_PATH, so it works
 * before hydration and without JS. The mic button is progressive enhancement,
 * rendered only where the Web Speech API exists; the recognised phrase fills
 * the field and submits it.
 */
export function HomeSearch({ id }: { id: string }) {
  const formRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const [micSupported, setMicSupported] = useState(false)
  const [micState, setMicState] = useState<MicState>('idle')

  useEffect(() => {
    // Mount-only capability probe: `window` cannot be read during render
    // without desyncing hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMicSupported(isSpeechRecognitionSupported(window))
    return () => recognitionRef.current?.abort()
  }, [])

  function toggleMic() {
    if (micState === 'listening') {
      // abort, not stop: stop() would still deliver the partial phrase and submit it.
      recognitionRef.current?.abort()
      setMicState('idle')
      return
    }
    const SR = speechRecognitionCtor(window)
    if (!SR) return
    const recognition = new SR()
    recognition.lang = 'pl-PL'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim()
      if (!transcript || !inputRef.current) return
      inputRef.current.value = transcript
      formRef.current?.requestSubmit()
    }
    recognition.onerror = () => setMicState('error')
    recognition.onend = () => setMicState((prev) => (prev === 'listening' ? 'idle' : prev))
    recognitionRef.current = recognition
    setMicState('listening')
    recognition.start()
  }

  return (
    <form ref={formRef} role="search" method="get" action={SEARCH_PATH}>
      <label htmlFor={id} className="mb-2 block text-[18px] text-ink-soft">
        Szukaj przepisu po nazwie lub składniku
      </label>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          id={id}
          type="search"
          name="q"
          required
          enterKeyHint="search"
          autoComplete="off"
          onInput={() => setMicState((prev) => (prev === 'error' ? 'idle' : prev))}
          placeholder="np. sernik, pierogi"
          className="h-[60px] min-w-0 flex-1 rounded-field border-2 border-field bg-white px-4 text-[19px] text-ink placeholder:text-ink-muted"
        />
        {micSupported && (
          <button
            type="button"
            onClick={toggleMic}
            aria-pressed={micState === 'listening'}
            className="inline-flex h-[60px] shrink-0 items-center gap-1.5 rounded-field border-2 border-field bg-white px-3 text-[17px] font-bold text-ink hover:bg-surface-3"
          >
            <Mic aria-hidden="true" className="h-5 w-5" />
            Mów
          </button>
        )}
      </div>
      <p role="status" aria-live="polite" className="mt-2 text-[16px] text-ink-soft empty:sr-only">
        {MIC_STATUS[micState]}
      </p>
      <button type="submit" className={`${buttonClasses('primary', 'lg')} mt-3 w-full text-[19px]`}>
        <Search aria-hidden="true" className="h-5 w-5" />
        Szukaj przepisu
      </button>
    </form>
  )
}
