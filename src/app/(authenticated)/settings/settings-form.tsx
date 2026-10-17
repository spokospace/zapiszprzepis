'use client'

import { useActionState, useEffect, useRef, useState, type ChangeEvent } from 'react'
import Link from 'next/link'
import { Avatar } from '@/app/components/ui/avatar'
import { Button } from '@/app/components/ui/button'
import { AVATAR_COLORS, avatarInitial } from '@/lib/avatar'
import { greetingName } from '@/lib/first-name'
import { greeting } from '@/lib/vocative'
import { saveProfileSettings, type SettingsFormState } from './actions'
import { resizeAvatar } from './resize-avatar'

const initialState: SettingsFormState = { status: 'idle' }

const INPUT =
  'min-h-[56px] w-full rounded-field border-2 border-field bg-white px-4 text-[19px] text-ink ' +
  'aria-[invalid=true]:border-danger'
const LABEL = 'block text-[19px] font-bold text-ink'
const HELP = 'text-[16px] text-ink-soft'

interface SettingsFormProps {
  initialDisplayName: string
  initialFirstName: string
  /** Public URL of the stored photo, or null for the letter avatar. */
  avatarSrc: string | null
  colorIndex: number
  /** /u/{username} once E01-S14 is live (profilePath()), else null. */
  profileHref: string | null
}

/** Screen 2a (E01-S13): picture, public name, private first name, live preview, one save. */
export function SettingsForm({ initialDisplayName, initialFirstName, avatarSrc, colorIndex, profileHref }: SettingsFormProps) {
  // Controlled on purpose: React 19 resets uncontrolled fields after a form
  // action, which would wipe what the user typed whenever validation rejects it.
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [firstName, setFirstName] = useState(initialFirstName)
  const [color, setColor] = useState(colorIndex)
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  // "✓ Zapisano" stays on the button until the next edit.
  const [editedSinceSave, setEditedSinceSave] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [state, formAction, pending] = useActionState(async (prev: SettingsFormState, formData: FormData) => {
    const result = await saveProfileSettings(prev, formData)
    // A saved photo now comes back from the server as avatarSrc; drop the local copy.
    if (result.status === 'success') {
      setPhoto(null)
      setRemovePhoto(false)
    }
    return result
  }, initialState)

  const shownSrc = photo?.url ?? (removePhoto ? null : avatarSrc)
  const name = displayName.trim() || initialDisplayName
  const saved = state.status === 'success' && !editedSinceSave && !pending

  function edited() {
    setEditedSinceSave(true)
  }

  useEffect(() => {
    if (state.status === 'error' && state.field) {
      document.getElementById(state.field === 'avatar' ? 'avatar-pick' : state.field)?.focus()
    }
  }, [state])

  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo.url)
  }, [photo])

  async function onPick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // picking the same file again still fires change
    if (!file) return
    try {
      const blob = await resizeAvatar(file)
      setPhoto({ blob, url: URL.createObjectURL(blob) })
      setRemovePhoto(false)
      setPhotoError(null)
      edited()
    } catch {
      setPhotoError('Nie udało się odczytać zdjęcia. Wybierz zdjęcie JPG lub PNG.')
    }
  }

  function submit(formData: FormData) {
    if (photo) formData.set('avatar', photo.blob, 'avatar.jpg')
    if (removePhoto) formData.set('removeAvatar', '1')
    setEditedSinceSave(false)
    formAction(formData)
  }

  const fieldError = (field: SettingsFormState['field']) => state.status === 'error' && state.field === field
  const greetingText = greeting(greetingName(firstName, name))

  return (
    <form action={submit} className="flex flex-col gap-6" noValidate>
      <fieldset className="flex flex-col gap-4">
        <legend className={`${LABEL} mb-3`}>Obrazek</legend>
        <div className="flex items-center gap-4">
          <Avatar src={shownSrc} name={name} colorIndex={color} size={96} />
          <div className="flex flex-col gap-2">
            <Button id="avatar-pick" variant="outline" size="md" onClick={() => fileRef.current?.click()}>
              {shownSrc ? 'Zmień zdjęcie' : 'Dodaj zdjęcie'}
            </Button>
            {shownSrc && (
              <Button
                variant="outline"
                size="md"
                onClick={() => {
                  setPhoto(null)
                  setRemovePhoto(Boolean(avatarSrc))
                  edited()
                }}
              >
                Usuń zdjęcie
              </Button>
            )}
          </div>
          {/* No name: the raw file is never posted, only the resized JPEG (submit()). */}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPick} />
        </div>
        {(photoError || fieldError('avatar')) && (
          <p role="alert" className="text-[17px] font-semibold text-danger">
            {photoError ?? state.message}
          </p>
        )}

        {!shownSrc && (
          <fieldset>
            <legend className={`${LABEL} mb-2`}>Kolor tła</legend>
            <div className="grid grid-cols-3 gap-x-2 gap-y-3">
              {AVATAR_COLORS.map((c, i) => (
                <label key={c.hex} className="flex cursor-pointer flex-col items-center gap-1 text-[16px] text-ink-soft has-[:checked]:font-bold has-[:checked]:text-ink">
                  <input
                    type="radio"
                    name="avatarColor"
                    value={i}
                    checked={color === i}
                    onChange={() => {
                      setColor(i)
                      edited()
                    }}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden
                    style={{ backgroundColor: c.hex }}
                    className="flex h-12 w-12 items-center justify-center rounded-full text-[22px] font-bold text-white peer-checked:ring-3 peer-checked:ring-ink peer-checked:ring-offset-3 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-8 peer-focus-visible:outline-focus"
                  >
                    {color === i ? '✓' : avatarInitial(name)}
                  </span>
                  {c.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {shownSrc && <input type="hidden" name="avatarColor" value={color} />}
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor="displayName" className={LABEL}>
          Nazwa przy przepisach
        </label>
        <p id="displayName-help" className={HELP}>
          Tak podpiszemy przepisy, które dodasz. Widzą ją wszyscy.
        </p>
        <input
          id="displayName"
          name="displayName"
          type="text"
          autoComplete="nickname"
          value={displayName}
          onChange={(e) => {
            setDisplayName(e.target.value)
            edited()
          }}
          maxLength={60}
          required
          aria-invalid={fieldError('displayName') || undefined}
          aria-describedby={fieldError('displayName') ? 'displayName-help settings-status' : 'displayName-help'}
          className={INPUT}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="firstName" className={LABEL}>
          Imię
        </label>
        <p id="firstName-help" className={HELP}>
          Tylko do powitania na stronie głównej. Nikt inny go nie widzi.
        </p>
        <input
          id="firstName"
          name="firstName"
          type="text"
          autoComplete="given-name"
          value={firstName}
          onChange={(e) => {
            setFirstName(e.target.value)
            edited()
          }}
          maxLength={40}
          aria-invalid={fieldError('firstName') || undefined}
          aria-describedby={fieldError('firstName') ? 'firstName-help settings-status' : 'firstName-help'}
          className={INPUT}
        />
      </div>

      <section aria-labelledby="preview-heading" className="rounded-xl border-2 border-border-card bg-surface-2 p-4">
        <h2 id="preview-heading" className="sr-only">
          Podgląd
        </h2>
        <div role="status" aria-live="polite" className="flex flex-col gap-2 text-[17px] text-ink-soft">
          <p>Tak zobaczą Cię inni:</p>
          <p className="flex items-center gap-3 text-[19px] font-bold text-ink">
            <Avatar src={shownSrc} name={name} colorIndex={color} size={48} />
            <span className="break-words">{name}</span>
          </p>
          <p className="mt-2">Powitanie:</p>
          <p className="text-[19px] font-bold text-ink">{greetingText}</p>
        </div>
        {profileHref && (
          <p className="mt-3 text-[17px]">
            <Link href={profileHref} className="font-semibold text-action-text">
              Zobacz swój profil publiczny
            </Link>
          </p>
        )}
      </section>

      <div className="flex flex-col gap-2">
        <Button
          type="submit"
          disabled={pending}
          className={`w-full ${saved ? 'bg-success! hover:bg-success!' : ''}`}
        >
          {pending ? 'Zapisywanie…' : saved ? '✓ Zapisano' : 'Zapisz zmiany'}
        </Button>
        {state.status === 'error' && state.field !== 'avatar' && (
          <p id="settings-status" role="alert" className="text-[17px] font-semibold text-danger">
            {state.message}
          </p>
        )}
        {/* The button already reads "✓ Zapisano"; this repeats it for screen readers. */}
        <p role="status" className="sr-only">
          {saved ? state.message : ''}
        </p>
      </div>
    </form>
  )
}
