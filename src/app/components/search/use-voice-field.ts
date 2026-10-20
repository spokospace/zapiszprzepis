'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { isSpeechRecognitionSupported, speechRecognitionCtor, startVoiceSearch, type VoiceState } from '@/lib/speech'

/** The „Powiedz” status line, shared by every search field (E01-S27). */
export const MIC_STATUS: Record<VoiceState, string> = {
  idle: '',
  // While listening the „Słucham…” screen carries its own live region (E01-S27).
  listening: '',
  error: 'Nie udało się rozpoznać mowy. Wpisz nazwę przepisu.',
  denied:
    'Przeglądarka nie pozwala użyć mikrofonu. Włącz go w ustawieniach strony (ikona kłódki obok adresu) i naciśnij „Powiedz” jeszcze raz.',
}

/**
 * „Powiedz” wiring shared by the page search field (HomeSearch) and the desktop
 * header field (HeaderSearch): the capability probe, the listen/stop lifecycle and
 * the programmatic value write that announces itself as typing (so the quick-search
 * bar and suggestions follow it). Kept out of the components so both call sites use
 * exactly the same voice behavior (E01-S27).
 */
export function useVoiceField(
  inputRef: RefObject<HTMLInputElement | null>,
  formRef: RefObject<HTMLFormElement | null>,
) {
  const voiceRef = useRef<ReturnType<typeof startVoiceSearch> | null>(null)
  const [micSupported, setMicSupported] = useState(false)
  const [micState, setMicState] = useState<VoiceState>('idle')
  const [heard, setHeard] = useState('')

  useEffect(() => {
    // Mount-only capability probe: `window` cannot be read during render
    // without desyncing hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMicSupported(isSpeechRecognitionSupported(window))
    return () => {
      voiceRef.current?.stop()
    }
  }, [])

  // A programmatic value change announces itself like typing, so „Powiedz”/„Wyczyść”
  // and the parts of the screen that read the field (suggestions, quick-search bar)
  // follow it.
  const setFieldValue = useCallback(
    (value: string) => {
      const input = inputRef.current
      if (!input) return
      input.value = value
      input.dispatchEvent(new Event('input', { bubbles: true }))
    },
    [inputRef],
  )

  const startListening = useCallback(() => {
    const SR = speechRecognitionCtor(window)
    if (!SR) return
    voiceRef.current = startVoiceSearch(SR, {
      onHeard: setHeard,
      onState: setMicState,
      onSearch: (phrase) => {
        setFieldValue(phrase)
        formRef.current?.requestSubmit()
      },
    })
  }, [formRef, setFieldValue])

  // „Przestań słuchać i pisz”: abort, not stop — stop() would still end with a
  // search. What was heard stays in the field for typing on.
  const stopListening = useCallback(() => {
    const phrase = voiceRef.current?.stop()
    if (phrase) setFieldValue(phrase)
    inputRef.current?.focus()
  }, [inputRef, setFieldValue])

  // Typing again clears a stale „nie udało się”/„brak zgody” message.
  const clearError = useCallback(() => {
    setMicState((prev) => (prev === 'error' || prev === 'denied' ? 'idle' : prev))
  }, [])

  return { micSupported, micState, heard, startListening, stopListening, setFieldValue, clearError }
}
