'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { useFormStatus } from 'react-dom'
import { ClipboardPaste } from 'lucide-react'
import { addRecipeFromUrl } from '@/app/(authenticated)/recipes/add-recipe-action'
import { Button } from '@/app/components/ui/button'
import { extractFirstUrl } from '@/lib/extract-url'
import { stripSearchParam } from '@/lib/strip-search-param'
import type { AddRecipeError } from '@/lib/routes'

/** /dodaj has no name search, so an empty field asks for a link only (E01-S10). */
export const ADD_FROM_LINK_ERRORS: Record<AddRecipeError, string> = {
  empty: 'Wklej link do przepisu.',
  invalid_url: 'To nie wygląda jak prawidłowy URL.',
  server: 'Coś poszło nie tak. Spróbuj ponownie.',
  no_access: 'Dodawanie przepisów wymaga kodu dostępu.',
}

const FIELD_ID = 'recipe-link'
const ERROR_ID = 'recipe-link-error'

/**
 * What „Wklej” puts in the field: the first http(s) link in the clipboard
 * ("Zobacz to https://…" from a mobile app), else the trimmed text. null when
 * the read is refused or the clipboard is empty — the caller shows a hint.
 */
export async function readLinkFromClipboard(clipboard: Pick<Clipboard, 'readText'>): Promise<string | null> {
  try {
    const text = await clipboard.readText()
    return extractFirstUrl(text) ?? (text.trim() || null)
  } catch {
    return null
  }
}


function SubmitButton() {
  // The action redirects on every outcome, so pending lasts until the next page loads.
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? 'Dodaję…' : 'Dodaj przepis'}
    </Button>
  )
}

type ViewProps = {
  value: string
  onValueChange: (value: string) => void
  error: AddRecipeError | null
  /** The Clipboard API can read here; otherwise „Wklej” is not rendered. */
  canPaste: boolean
  pasteFailed: boolean
  onPaste: () => void
  autoFocus?: boolean
  inputRef?: RefObject<HTMLInputElement | null>
}

/** The A7 link form, pure view (rendered by AddFromLinkForm; split out for tests). */
export function AddFromLinkFormView({ value, onValueChange, error, canPaste, pasteFailed, onPaste, autoFocus, inputRef }: ViewProps) {
  const message = error ? ADD_FROM_LINK_ERRORS[error] : null
  return (
    <form action={addRecipeFromUrl} className="flex flex-col gap-3">
      <label htmlFor={FIELD_ID} className="text-[19px] font-bold text-ink">
        Link do przepisu
      </label>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          id={FIELD_ID}
          name="url"
          // text, not url: the server's Polish messages explain a bad link, not the browser's.
          type="text"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="https://…"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          autoFocus={autoFocus}
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? ERROR_ID : undefined}
          className={`min-h-[56px] min-w-0 flex-1 rounded-tile border-2 bg-white px-4 text-[19px] text-ink placeholder:text-ink-muted ${
            message ? 'border-danger' : 'border-field'
          }`}
        />
        {canPaste && (
          <Button variant="outline" onClick={onPaste} className="shrink-0">
            <ClipboardPaste aria-hidden="true" className="h-5 w-5" />
            Wklej
          </Button>
        )}
      </div>
      {message && (
        <p id={ERROR_ID} role="alert" className="text-[17px] font-bold text-danger">
          {message}
        </p>
      )}
      {pasteFailed && (
        <p role="status" className="text-[16px] text-ink-soft">
          Nie udało się wkleić. Przytrzymaj pole i wybierz „Wklej”.
        </p>
      )}
      <SubmitButton />
    </form>
  )
}

/**
 * E01-S10 — the "Z linku" form on /dodaj: a labelled link field, „Wklej”
 * (Clipboard API) and „Dodaj przepis”. addRecipeFromUrl re-checks access and
 * sends any error back to /dodaj?add_error=…, which arrives here as `error`.
 */
export function AddFromLinkForm({ error = null, autoFocus }: { error?: AddRecipeError | null; autoFocus?: boolean }) {
  // Controlled: „Wklej” fills it, and React 19 would reset an uncontrolled field after the action.
  const [value, setValue] = useState('')
  const [canPaste, setCanPaste] = useState(false)
  const [pasteFailed, setPasteFailed] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // A mount-only capability probe: `navigator` can't be read during render
    // without desyncing hydration, and this settles after one run.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanPaste(typeof navigator.clipboard?.readText === 'function')
  }, [])

  useEffect(() => {
    if (error) stripSearchParam('add_error')
  }, [error])

  const paste = async () => {
    // Only reachable when the mount probe found the Clipboard API.
    const link = await readLinkFromClipboard(navigator.clipboard)
    setPasteFailed(link === null)
    if (link !== null) setValue(link)
    inputRef.current?.focus()
  }

  return (
    <AddFromLinkFormView
      value={value}
      onValueChange={(next) => {
        setValue(next)
        // Typing or a long-press paste answers the hint.
        setPasteFailed(false)
      }}
      error={error}
      canPaste={canPaste}
      pasteFailed={pasteFailed}
      onPaste={paste}
      autoFocus={autoFocus}
      inputRef={inputRef}
    />
  )
}
