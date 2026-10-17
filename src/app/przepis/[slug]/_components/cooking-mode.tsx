'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChefHat, X } from 'lucide-react'
import { buttonClasses } from '@/app/components/ui/button'
import { clampStep, isLastStep, progressRatio, progressSegments, stepLabel } from '@/lib/cooking-mode'
import { createScreenWakeLock, type ScreenWakeLock } from '@/lib/wake-lock'

/**
 * Keeps the screen on while `active` (E01-S08). Returns `false` once the browser
 * has no Wake Lock or refused it, `true` while held, `null` before the first
 * answer. Every return to the tab asks again, so a lock refused earlier (or
 * dropped by the system) can come back and clear the note.
 */
function useScreenWakeLock(active: boolean): boolean | null {
  const [held, setHeld] = useState<boolean | null>(null)

  useEffect(() => {
    if (!active) return
    let cancelled = false
    const lock: ScreenWakeLock = createScreenWakeLock({ navigator, document })
    const check = () => {
      void lock.acquire().then((ok) => {
        if (!cancelled) setHeld(ok)
      })
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') check()
    }
    check()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      setHeld(null)
      document.removeEventListener('visibilitychange', onVisibility)
      void lock.release()
    }
  }, [active])

  return held
}

/** Leave fullscreen if we are in it; never throws (no API, or already left). */
function exitFullscreen() {
  if (typeof document !== 'undefined' && document.fullscreenElement) {
    document.exitFullscreen().catch(() => {})
  }
}

interface CookingModeProps {
  title: string
  steps: string[]
}

/**
 * "Tryb gotowania" (E01-S08): an entry button and a dark, one-step-at-a-time
 * screen. Built on a native <dialog> opened with showModal() (like AppMenu): the
 * page behind is inert, focus is trapped, Escape closes and focus returns to
 * the button. Fullscreen and Wake Lock are best effort — without either the
 * dialog still covers the viewport. One same-URL history entry lets the system
 * Back gesture close the mode instead of leaving the recipe.
 */
export function CookingMode({ title, steps }: CookingModeProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  /** Our history entry is on top of the stack and still needs consuming. */
  const pushedRef = useRef(false)
  /** Mirrors `open` synchronously so finish() runs once per session. */
  const openRef = useRef(false)
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const wakeLock = useScreenWakeLock(open)

  const total = steps.length
  const current = clampStep(index, total)
  const last = isLastStep(current, total)
  const segments = progressSegments(current, total)

  /**
   * Every exit path (× Zakończ, Gotowe, Escape, Back) ends here. Idempotent, and
   * it does not wait for the dialog's `close` event, which some embedded
   * Chromium builds deliver late or never.
   */
  const finish = useCallback(() => {
    if (!openRef.current) return
    openRef.current = false
    setOpen(false)
    exitFullscreen()
    dialogRef.current?.close()
    // Native focus return is unreliable once history.back() re-renders the route.
    triggerRef.current?.focus()
    if (pushedRef.current) {
      pushedRef.current = false
      window.history.back()
    }
  }, [])

  // Back gesture: the browser already popped our entry, so only close.
  useEffect(() => {
    const onPopState = () => {
      if (!pushedRef.current) return
      pushedRef.current = false
      finish()
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [finish])

  // The fullscreen root joins the top layer after the dialog and would be painted
  // over it: re-open the dialog so it is stacked last again, keeping focus.
  useEffect(() => {
    if (!open) return
    const onFullscreenChange = () => {
      const dialog = dialogRef.current
      if (!document.fullscreenElement || !dialog?.open) return
      const focused = document.activeElement
      dialog.close()
      dialog.showModal()
      if (focused instanceof HTMLElement) focused.focus()
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [open])

  // Leaving the page with the mode open: drop fullscreen too (the lock has its own cleanup).
  useEffect(() => exitFullscreen, [])

  if (total === 0) return null

  function start() {
    const dialog = dialogRef.current
    if (!dialog) return
    setIndex(0)
    openRef.current = true
    setOpen(true)
    window.history.pushState({ ...window.history.state, zpCookingMode: true }, '')
    pushedRef.current = true
    dialog.showModal()
    headingRef.current?.focus()
    // Fullscreen goes on the page root (the spec refuses <dialog> elements) and is
    // requested in this click, the gesture it needs. Never awaited: some in-app
    // browsers leave the promise pending forever. iPhone Safari has no element
    // fullscreen at all.
    const root = document.documentElement
    if (document.fullscreenEnabled && typeof root.requestFullscreen === 'function') {
      root.requestFullscreen({ navigationUI: 'hide' }).catch(() => {})
    }
  }

  function go(delta: number) {
    const next = clampStep(current + delta, total)
    setIndex(next)
    // "← Wstecz" disables itself on step 1; keep focus inside on a live button.
    if (next === 0) nextRef.current?.focus()
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDialogElement>) {
    if (event.key === 'ArrowRight' || event.key === 'PageDown') {
      event.preventDefault()
      if (!last) go(1)
    } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
      event.preventDefault()
      if (current > 0) go(-1)
    }
  }

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        onClick={start}
        aria-haspopup="dialog"
        aria-controls="cooking-mode"
        className={`${buttonClasses('primary', 'lg')} w-full sm:w-auto`}
      >
        <ChefHat aria-hidden="true" className="h-6 w-6" />
        Tryb gotowania
      </button>

      <dialog
        id="cooking-mode"
        ref={dialogRef}
        aria-labelledby="cooking-mode-title"
        // Escape (native cancel). onClose is a safety net for any other native
        // close; it skips the close event of the fullscreen re-stack (reopened by then).
        onCancel={finish}
        onClose={() => {
          if (!dialogRef.current?.open) finish()
        }}
        onKeyDown={onKeyDown}
        // Full viewport on every screen; the focus ring is lightened because the
        // global #1d4ed8 outline is too dark on #111827 (colour override only; `!`
        // because the global rule is unlayered and would beat a layered utility).
        className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-surface-dark p-0 text-white backdrop:bg-surface-dark [&_:focus-visible]:outline-accent-dark!"
      >
        <div className="mx-auto flex h-full max-w-3xl flex-col px-4 pt-4 pb-4 sm:px-8 sm:pt-6">
          <div className="flex items-center justify-between gap-3">
            <h2
              id="cooking-mode-title"
              ref={headingRef}
              tabIndex={-1}
              className="min-w-0 truncate text-[16px] font-normal text-border-card-2"
            >
              <span className="sr-only">Tryb gotowania: </span>
              {title}
            </h2>
            <button
              type="button"
              onClick={finish}
              className="inline-flex min-h-[56px] shrink-0 items-center gap-1.5 rounded-field border-2 border-border-card-2 px-4 text-[18px] font-bold text-white hover:bg-white/10"
            >
              <X aria-hidden="true" className="h-6 w-6" />
              Zakończ
            </button>
          </div>

          <div
            role="progressbar"
            aria-label="Postęp przepisu"
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuenow={current + 1}
            aria-valuetext={stepLabel(current, total)}
            className="mt-5 mb-5 flex h-2 gap-1"
          >
            {segments ? (
              segments.map((state, i) => (
                <span
                  key={i}
                  className={`h-full flex-1 rounded-pill ${state === 'todo' ? 'bg-ink-muted' : 'bg-progress'}`}
                />
              ))
            ) : (
              <span className="h-full flex-1 overflow-hidden rounded-pill bg-ink-muted">
                <span
                  className="block h-full rounded-pill bg-progress transition-[width] motion-reduce:transition-none"
                  style={{ width: `${progressRatio(current, total) * 100}%` }}
                />
              </span>
            )}
          </div>

          {/* Announced after every "Dalej" / "Wstecz". */}
          <div aria-live="polite" className="flex min-h-0 flex-1 flex-col">
            <p className="mb-3 text-[22px] font-bold text-accent-dark">{stepLabel(current, total)}</p>
            <p className="min-h-0 flex-1 overflow-y-auto text-[30px] leading-[1.4] break-words">{steps[current]}</p>
          </div>

          {wakeLock === false && (
            <p className="mt-3 text-[16px] text-border-card-2">
              Ekran może się wygasić — ta przeglądarka nie pozwala go podtrzymać.
            </p>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => go(-1)}
              disabled={current === 0}
              className={buttonClasses('outline', 'xl')}
            >
              ← Wstecz
            </button>
            <button
              type="button"
              ref={nextRef}
              onClick={() => (last ? finish() : go(1))}
              className={buttonClasses('primary', 'xl')}
            >
              {last ? 'Gotowe ✓' : 'Dalej →'}
            </button>
          </div>
        </div>
      </dialog>
    </>
  )
}
