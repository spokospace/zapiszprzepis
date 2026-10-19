'use client'

import { Suspense, type MouseEvent } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useSessionStorage } from '@/app/components/ui/use-session-storage'
import { HEADER_BACK_FALLBACK, headerBackLink, type HeaderBackLink as Target } from '@/lib/header-back-link'
import { listStorageKey, parseListKey } from '@/lib/recipe-list-context'

type Props = {
  className?: string
}

// One 18 px row at every width: beside Dodaj + MENU (signed in) or „Zaloguj się”
// + MENU (guest) it fits at 320 px. It stacked below 360 px only while the bell
// was in the phone header too (#323).
function BackLinkView({
  target,
  className,
  onClick,
}: Props & { target: Target; onClick?: (event: MouseEvent<HTMLAnchorElement>) => void }) {
  return (
    <Link
      href={target.href}
      aria-label={target.ariaLabel}
      onClick={onClick}
      className={`-ml-2 inline-flex h-14 shrink-0 flex-row items-center justify-center gap-1.5 rounded-field px-2 text-[18px] leading-none font-bold text-ink no-underline! hover:bg-surface-3 ${className ?? ''}`}
    >
      <ArrowLeft aria-hidden="true" className="h-6 w-6" />
      {target.text}
    </Link>
  )
}

function ResolvedBackLink({ slug, ...props }: Props & { slug: string }) {
  const from = parseListKey(useSearchParams().get('from'))
  const [raw] = useSessionStorage(from ? listStorageKey(from) : '')
  return <BackLinkView target={headerBackLink(from, raw, slug)} {...props} />
}

/**
 * "← Wróć" (or "← Wyniki") in place of the logo on a recipe page, mobile 1c header
 * (E01-S19): 18 px bold, 56 px target, back to the list the recipe was opened from.
 */
export function HeaderBackLink({ slug, ...props }: Props & { slug: string }) {
  return (
    <Suspense fallback={<BackLinkView target={HEADER_BACK_FALLBACK} {...props} />}>
      <ResolvedBackLink slug={slug} {...props} />
    </Suspense>
  )
}

/** The generic "← Wróć": back in history, or to the start page when there is none. */
export const PAGE_BACK: Target = { href: '/', text: 'Wróć', ariaLabel: 'Wróć' }

/**
 * "← Wróć" in place of the logo on every other screen below the start page
 * (handoff 1c: C2 search, 2a settings, A7 /dodaj, 3c, 5 notifications, category,
 * profile). It goes back in history like the browser button; with no history (a
 * new tab, a shared link) or without JS it is a plain link to the start page.
 */
export function PageBackLink(props: Props) {
  const router = useRouter()
  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (window.history.length > 1) {
      event.preventDefault()
      router.back()
    }
  }
  return <BackLinkView target={PAGE_BACK} onClick={onClick} {...props} />
}
