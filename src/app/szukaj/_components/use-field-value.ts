'use client'

import { useEffect, useState } from 'react'

/**
 * The search field's live value, read from its `input` events, so the parts of
 * /szukaj around the field (quick-search bar, suggestions) follow typing without
 * owning the field. Programmatic changes dispatch `input` too (HomeSearch).
 */
export function useFieldValue(fieldId: string, initial: string): string {
  const [value, setValue] = useState(initial)
  useEffect(() => {
    function onInput(event: Event) {
      const target = event.target as HTMLInputElement | null
      if (target?.id === fieldId) setValue(target.value)
    }
    document.addEventListener('input', onInput)
    return () => document.removeEventListener('input', onInput)
  }, [fieldId])
  return value
}
