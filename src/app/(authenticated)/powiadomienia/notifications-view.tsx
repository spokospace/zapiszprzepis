'use client'

import { useEffect, useRef, useState, useTransition, type MouseEvent, type ReactNode, type RefObject } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CircleCheck, Clock, RefreshCw, TriangleAlert } from 'lucide-react'
import { retryShare } from '@/app/(authenticated)/recipes/retry-action'
import { dismissShare, dismissAllFailedShares } from '@/app/(authenticated)/recipes/dismiss-action'
import { Button } from '@/app/components/ui/button'
import { recipePath } from '@/lib/routes'
import { isHttpUrl } from '@/lib/share-error'
import type { DoneItem, InProgressItem, NotificationsResult, ProblemItem } from '@/lib/notifications'

type Busy = { id: number | 'all'; kind: 'retry' | 'dismiss' } | null

/**
 * Screen 5 (E01-S15). Focus: the H1 takes focus on arrival, so keyboard and
 * screen-reader users start at the top of the new view rather than on the
 * bell they came from. After "Spróbuj ponownie" / "Usuń" the card leaves its
 * section; once the refreshed list is in, focus goes to the "Wymaga uwagi"
 * heading (or the H1 when that section is gone) — never to a removed node.
 */
export function NotificationsView({ result }: { result: NotificationsResult }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState<Busy>(null)
  const [message, setMessage] = useState('')
  const refocus = useRef(false)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const problemsRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  // Runs once the transition (action + refreshed list) has committed.
  useEffect(() => {
    if (pending || !refocus.current) return
    refocus.current = false
    ;(problemsRef.current ?? titleRef.current)?.focus()
  }, [pending])

  function run(next: Busy, action: () => Promise<void>, done: string) {
    setBusy(next)
    setMessage('')
    startTransition(async () => {
      await action()
      setMessage(done)
      setBusy(null)
      refocus.current = true
    })
  }

  // No-JS / no-history fallback is the plain link to "/".
  function onBack(event: MouseEvent<HTMLAnchorElement>) {
    if (window.history.length > 1) {
      event.preventDefault()
      router.back()
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/" onClick={onBack} className="inline-flex min-h-[48px] items-center gap-2 text-[17px] font-semibold text-ink">
        <ArrowLeft aria-hidden="true" className="h-5 w-5" />
        Wróć
      </Link>
      <h1 ref={titleRef} tabIndex={-1} className="mt-1 mb-2 text-[30px] leading-tight font-bold text-ink">
        Powiadomienia
      </h1>
      <p role="status" className="mb-4 min-h-[1.5em] text-[17px] font-semibold text-success">
        {message}
      </p>

      {result.status === 'error' ? (
        <p role="alert" className="rounded-card border-2 border-danger bg-danger-bg p-4 font-semibold text-danger">
          Nie udało się sprawdzić powiadomień. Odśwież stronę.
        </p>
      ) : result.problems.length + result.inProgress.length + result.done.length === 0 ? (
        <div className="rounded-card border-2 border-border-card-2 bg-surface-2 p-5">
          <p className="mb-2 flex items-center gap-2 font-semibold">
            <CircleCheck aria-hidden="true" className="h-6 w-6 text-success" />
            Wszystko gotowe. Nic nie wymaga uwagi.
          </p>
          <Link href="/" className="inline-flex min-h-[48px] items-center text-ink">
            Wróć do strony głównej
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {result.problems.length > 0 && (
            <Section
              id="wymaga-uwagi"
              headingRef={problemsRef}
              title={`Wymaga uwagi (${result.problems.length})`}
              action={
                result.problems.length >= 2 && (
                  <Button
                    variant="outline"
                    size="md"
                    disabled={pending}
                    onClick={() => run({ id: 'all', kind: 'dismiss' }, () => dismissAllFailedShares(), 'Usunięto.')}
                  >
                    {busy?.id === 'all' ? 'Usuwamy…' : 'Usuń wszystkie'}
                  </Button>
                )
              }
            >
              {result.problems.map((item) => (
                <ProblemCard
                  key={item.id}
                  item={item}
                  disabled={pending}
                  busy={busy?.id === item.id ? busy.kind : null}
                  onRetry={() => run({ id: item.id, kind: 'retry' }, () => retryShare(item.id), 'Ponawiamy zapis przepisu.')}
                  onDismiss={() => run({ id: item.id, kind: 'dismiss' }, () => dismissShare(item.id), 'Usunięto.')}
                />
              ))}
            </Section>
          )}

          {result.inProgress.length > 0 && (
            <Section
              id="w-trakcie"
              title="W trakcie"
              action={
                <Button variant="outline" size="md" disabled={pending} onClick={() => startTransition(() => router.refresh())}>
                  <RefreshCw aria-hidden="true" className="h-5 w-5" />
                  Odśwież
                </Button>
              }
            >
              {result.inProgress.map((item) => (
                <InProgressCard key={item.id} item={item} />
              ))}
            </Section>
          )}

          {result.done.length > 0 && (
            <Section id="wczesniej" title="Wcześniej">
              {result.done.map((item) => (
                <DoneCard key={item.id} item={item} />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  )
}

function Section({
  id,
  title,
  action,
  headingRef,
  children,
}: {
  id: string
  title: string
  action?: ReactNode
  headingRef?: RefObject<HTMLHeadingElement | null>
  children: ReactNode
}) {
  return (
    <section aria-labelledby={`${id}-heading`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${id}-heading`} ref={headingRef} tabIndex={-1} className="text-[22px] font-bold text-ink">
          {title}
        </h2>
        {action}
      </div>
      <ul className="flex flex-col gap-3">{children}</ul>
    </section>
  )
}

function CardLabel({ icon, children, className }: { icon: ReactNode; children: ReactNode; className: string }) {
  return <p className={`flex items-center gap-1.5 text-[16px] font-bold ${className}`}>{icon}{children}</p>
}

function ProblemCard({
  item,
  disabled,
  busy,
  onRetry,
  onDismiss,
}: {
  item: ProblemItem
  disabled: boolean
  busy: 'retry' | 'dismiss' | null
  onRetry: () => void
  onDismiss: () => void
}) {
  return (
    <li className="rounded-card border-2 border-danger bg-danger-bg p-4">
      <CardLabel icon={<TriangleAlert aria-hidden="true" className="h-5 w-5" />} className="text-danger">
        Problem
      </CardLabel>
      <p className="mt-1 font-bold break-all">{item.domain}</p>
      <p className="mt-1">{item.reason}</p>
      {isHttpUrl(item.url) && (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex min-h-[48px] items-center text-[17px] text-ink"
        >
          Otwórz stronę źródłową<span className="sr-only"> (otwiera się w nowej karcie)</span>
        </a>
      )}
      <div className="mt-2 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
        <Button disabled={disabled} onClick={onRetry}>
          {busy === 'retry' ? 'Ponawiamy…' : 'Spróbuj ponownie'}
        </Button>
        <Button variant="outline" disabled={disabled} onClick={onDismiss}>
          {busy === 'dismiss' ? 'Usuwamy…' : 'Usuń'}
        </Button>
      </div>
    </li>
  )
}

function InProgressCard({ item }: { item: InProgressItem }) {
  return (
    <li className="rounded-card border-2 border-border-card-2 bg-white p-4">
      <CardLabel icon={<Clock aria-hidden="true" className="h-5 w-5" />} className="text-ink-soft">
        W trakcie
      </CardLabel>
      <p className="mt-1 font-bold break-all">{item.domain}</p>
      <p className="mt-1 text-[16px] text-ink-soft">
        {item.slow
          ? 'Trwa to dłużej niż zwykle. Jeśli przepis się nie pojawi, dodaj link jeszcze raz.'
          : 'Zapisujemy przepis. To zwykle trwa do minuty.'}
      </p>
    </li>
  )
}

function DoneCard({ item }: { item: DoneItem }) {
  return (
    <li className="rounded-card border-2 border-border-card-2 bg-white p-4">
      <CardLabel icon={<CircleCheck aria-hidden="true" className="h-5 w-5" />} className="text-success">
        Gotowe
      </CardLabel>
      <p className="mt-1 font-bold">{item.title}</p>
      <p className="text-[16px] text-ink-soft break-all">{item.domain}</p>
      <Link href={recipePath(item.slug)} className="inline-flex min-h-[48px] items-center font-semibold text-ink">
        Otwórz przepis<span className="sr-only">: {item.title}</span>
      </Link>
    </li>
  )
}
