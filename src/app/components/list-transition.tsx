'use client'

import { createContext, startTransition, use, useTransition, type ReactNode, type TransitionStartFunction } from 'react'

interface ListTransitionValue {
  isPending: boolean
  startTransition: TransitionStartFunction
}

const ListTransitionContext = createContext<ListTransitionValue | null>(null)

/**
 * One transition shared by a list's controls (category chips, tag, search) and its
 * results (#228). A control starts its `router.push`/`replace` inside it; the results
 * dim until the new list has rendered. Router navigations are transitions, so the old
 * list stays on screen and loading.tsx never shows for a change of search params on the
 * same page: without this, a tap or a search gives no sign it is working.
 */
export function ListTransition({ children }: { children: ReactNode }) {
  const [isPending, start] = useTransition()
  return <ListTransitionContext value={{ isPending, startTransition: start }}>{children}</ListTransitionContext>
}

/** The shared transition; outside a ListTransition, a plain one with no pending state. */
export function useListTransition(): ListTransitionValue {
  return use(ListTransitionContext) ?? { isPending: false, startTransition }
}

/** The list's results: dimmed and aria-busy while a control's navigation is pending. */
export function ListResults({ children }: { children: ReactNode }) {
  const { isPending } = useListTransition()
  return (
    <>
      {/* Present before it changes, so screen readers announce the text when it appears. */}
      <p role="status" className="sr-only">
        {isPending ? 'Ładowanie przepisów…' : ''}
      </p>
      <div
        aria-busy={isPending || undefined}
        className={`transition-opacity motion-reduce:transition-none ${isPending ? 'opacity-50' : ''}`}
      >
        {children}
      </div>
    </>
  )
}
