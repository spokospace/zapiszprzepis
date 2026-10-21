'use client'

import { useEffect, useRef, useState, useTransition, type MouseEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Bell, CircleAlert, CircleCheck, Clock, LoaderCircle, RefreshCw, RotateCw } from 'lucide-react'
import { retryShare } from '@/app/(authenticated)/recipes/retry-action'
import { dismissShare, dismissAllFailedShares } from '@/app/(authenticated)/recipes/dismiss-action'
import { Button } from '@/app/components/ui/button'
import { isHttpUrl, notificationTime } from '@/lib/share-error'
import type { InProgressItem, NotificationsResult, ProblemItem, ReadyItem } from '@/lib/notifications'
import { IN_PROGRESS_POLL_MAX, IN_PROGRESS_POLL_MS, finishedMessage } from '@/lib/notifications-poll'
import { clearReadShares, openReadyShare } from './actions'

type Busy = { id: number | 'all' | 'read'; kind: 'retry' | 'dismiss' } | null

/**
 * Screen 5 (E01-S15, handoff `Powiadomienia.dc.html`). Focus: the H1 takes
 * focus on arrival, so keyboard and screen-reader users start at the top of
 * the new view rather than on the bell they came from. After an action the
 * card leaves its section; once the refreshed list is in, focus goes to the
 * first section heading still on the page (or the H1) — never to a removed node.
 */
export function NotificationsView({ result }: { result: NotificationsResult }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState<Busy>(null)
  const [message, setMessage] = useState('')
  const refocus = useRef(false)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  // Runs once the transition (action + refreshed list) has committed.
  useEffect(() => {
    if (pending || !refocus.current) return
    refocus.current = false
    ;(listRef.current?.querySelector<HTMLElement>('h2') ?? titleRef.current)?.focus()
  }, [pending])

  // "W trakcie" turns into "Przepis gotowy" on its own (handoff 5): while a card is
  // in progress, re-read the list every 10 s on a visible tab, for about 5 minutes.
  const inProgressKey = result.status === 'ok' ? result.inProgress.map((i) => i.id).join(',') : ''
  useEffect(() => {
    if (!inProgressKey) return
    let polls = 0
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      if (++polls > IN_PROGRESS_POLL_MAX) return clearInterval(timer)
      router.refresh()
    }, IN_PROGRESS_POLL_MS)
    return () => clearInterval(timer)
  }, [inProgressKey, router])

  // Announce the cards that left "W trakcie" since the last render.
  const prevInProgress = useRef<number[]>([])
  useEffect(() => {
    const done = finishedMessage(prevInProgress.current, result)
    // Syncs the live region with a server refresh, not with local state.
    if (done) setMessage(done)
    prevInProgress.current = result.status === 'ok' ? result.inProgress.map((i) => i.id) : []
  }, [result])

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

  const ok = result.status === 'ok' ? result : null
  const unread = ok?.ready.filter((r) => !r.read) ?? []
  const read = ok?.ready.filter((r) => r.read) ?? []
  const empty = ok !== null && ok.problems.length + ok.inProgress.length + ok.ready.length === 0

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/"
        onClick={onBack}
        // Below lg the header carries "← Wróć" (handoff 1c); the desktop header keeps the logo.
        className="hidden min-h-[56px] items-center gap-1.5 text-[18px] font-bold text-ink no-underline! lg:inline-flex"
      >
        <ArrowLeft aria-hidden="true" className="h-6 w-6" />
        Wróć
      </Link>
      <h1 ref={titleRef} tabIndex={-1} className="mt-1 text-[28px] leading-tight font-bold text-ink">
        Powiadomienia
      </h1>
      <p role="status" className="min-h-[1.5em] py-1 text-[17px] font-semibold text-success">
        {message}
      </p>

      {result.status === 'error' ? (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-tile border-2 border-danger p-4">
          <p className="flex items-center gap-2 text-[19px] font-bold text-ink">
            <CircleAlert aria-hidden="true" className="h-6 w-6 shrink-0 text-danger" />
            Nie udało się sprawdzić powiadomień.
          </p>
          <Button variant="outline" size="md" onClick={() => startTransition(() => router.refresh())}>
            <RotateCw aria-hidden="true" className="h-5 w-5" />
            Spróbuj ponownie
          </Button>
        </div>
      ) : empty ? (
        <div className="flex flex-col gap-3 py-6">
          <span className="flex h-16 w-16 items-center justify-center rounded-pill bg-surface-3 text-ink-soft">
            <Bell aria-hidden="true" className="h-8 w-8" />
          </span>
          <p className="text-[22px] font-bold text-ink">Nie ma nowych powiadomień</p>
          <p className="text-[18px] leading-normal text-ink-soft">
            Tu napiszemy, kiedy przepis będzie gotowy albo gdy coś pójdzie nie tak przy dodawaniu.
          </p>
        </div>
      ) : ok ? (
        <div ref={listRef} className="flex flex-col gap-6">
          {ok.problems.length > 0 && (
            <Section
              id="wymaga-uwagi"
              title="Wymaga uwagi"
              action={
                ok.problems.length >= 2 && (
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
              {ok.problems.map((item) => (
                <ProblemCard
                  key={item.id}
                  item={item}
                  disabled={pending}
                  busy={busy?.id === item.id ? busy.kind : null}
                  onRetry={() => run({ id: item.id, kind: 'retry' }, () => retryShare(item.id), 'Ponawiamy dodawanie przepisu.')}
                  onDismiss={() => run({ id: item.id, kind: 'dismiss' }, () => dismissShare(item.id), 'Usunięto.')}
                />
              ))}
            </Section>
          )}

          {ok.inProgress.length > 0 && (
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
              {ok.inProgress.map((item) => (
                <InProgressCard key={item.id} item={item} />
              ))}
            </Section>
          )}

          {unread.length > 0 && (
            <Section id="nowe" title="Nowe">
              {unread.map((item) => (
                <ReadyCard key={item.id} item={item} />
              ))}
            </Section>
          )}

          {read.length > 0 && (
            <Section id="wczesniej" title="Wcześniej">
              {read.map((item) => (
                <ReadyCard key={item.id} item={item} />
              ))}
            </Section>
          )}

          {read.length > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run({ id: 'read', kind: 'dismiss' }, () => clearReadShares(), 'Usunięto przeczytane.')}
              className="min-h-[52px] self-start px-1 text-[17px] font-bold text-ink underline underline-offset-4 disabled:opacity-50"
            >
              {busy?.id === 'read' ? 'Usuwamy…' : 'Usuń przeczytane'}
            </button>
          )}
        </div>
      ) : null}
    </div>
  )
}

function Section({ id, title, action, children }: { id: string; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-heading`}>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${id}-heading`} tabIndex={-1} className="text-[17px] font-bold text-ink-soft">
          {title}
        </h2>
        {action}
      </div>
      <ul className="flex flex-col gap-2.5">{children}</ul>
    </section>
  )
}

/** The shared card body: icon, title 19 px bold, line 17 px, reason 17 px, time 16 px. */
function Card({
  border,
  icon,
  title,
  line,
  reason,
  at,
  children,
}: {
  border: string
  icon: ReactNode
  title: string
  line: ReactNode
  reason?: string
  at: string
  children?: ReactNode
}) {
  return (
    <li className={`flex flex-col gap-2 rounded-tile border-2 bg-white p-4 ${border}`}>
      <div className="flex items-start gap-2.5">
        <span className="pt-px">{icon}</span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-[19px] leading-snug font-bold text-ink">{title}</p>
          <p className="text-[17px] leading-normal break-words text-ink">{line}</p>
          {reason && <p className="text-[17px] leading-normal text-ink-soft">{reason}</p>}
          {/* Relative to "now", which differs between the server render and hydration by a moment. */}
          <p suppressHydrationWarning className="text-[16px] text-ink-soft">
            {notificationTime(at)}
          </p>
        </div>
      </div>
      {children}
    </li>
  )
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
    <Card
      border="border-danger"
      icon={<CircleAlert aria-hidden="true" className="h-6 w-6 text-danger" />}
      title="Nie udało się dodać przepisu"
      line={
        isHttpUrl(item.url) ? (
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="break-all text-ink">
            {item.domain}
            <span className="sr-only"> (otwiera się w nowej karcie)</span>
          </a>
        ) : (
          <span className="break-all">{item.domain}</span>
        )
      }
      reason={item.reason}
      at={item.at}
    >
      <div className="mt-1 flex flex-col gap-2">
        <Button disabled={disabled} onClick={onRetry}>
          <RotateCw aria-hidden="true" className="h-[22px] w-[22px]" />
          {busy === 'retry' ? 'Ponawiamy…' : 'Spróbuj ponownie'}
        </Button>
        <Button variant="outline" size="md" disabled={disabled} onClick={onDismiss}>
          {busy === 'dismiss' ? 'Usuwamy…' : 'Usuń'}
        </Button>
      </div>
    </Card>
  )
}

function InProgressCard({ item }: { item: InProgressItem }) {
  return (
    <Card
      border="border-border-card"
      icon={
        <>
          <LoaderCircle aria-hidden="true" className="h-6 w-6 animate-spin text-action motion-reduce:hidden" />
          <Clock aria-hidden="true" className="hidden h-6 w-6 text-action motion-reduce:block" />
        </>
      }
      title="Spisujemy przepis"
      line={<span className="break-all">{item.domain}</span>}
      reason={
        item.slow
          ? 'Trwa to dłużej niż zwykle. Jeśli przepis się nie pojawi, dodaj link jeszcze raz.'
          : 'Zwykle trwa to 1–3 minuty. Możesz korzystać z aplikacji.'
      }
      at={item.at}
    />
  )
}

function ReadyCard({ item }: { item: ReadyItem }) {
  return (
    <Card
      border={item.read ? 'border-border-card' : 'border-success'}
      icon={<CircleCheck aria-hidden="true" className="h-6 w-6 text-success" />}
      title="Przepis gotowy"
      line={<span className="font-bold">{item.title}</span>}
      at={item.at}
    >
      <form action={openReadyShare} className="mt-1">
        <input type="hidden" name="shareId" value={item.id} />
        <Button type="submit" variant={item.read ? 'outline' : 'primary'} className="w-full">
          Otwórz przepis<span className="sr-only">: {item.title}</span>
        </Button>
      </form>
    </Card>
  )
}
