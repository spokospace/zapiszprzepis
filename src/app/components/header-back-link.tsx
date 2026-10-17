'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useSessionStorage } from '@/app/components/ui/use-session-storage'
import { HEADER_BACK_FALLBACK, headerBackLink, type HeaderBackLink as Target } from '@/lib/header-back-link'
import { listStorageKey, parseListKey } from '@/lib/recipe-list-context'

type Props = {
  /** Signed-in header: three buttons on the right, so below 360 px the link must stack. */
  crowded: boolean
  className?: string
}

const ROW = 'flex-row gap-1.5 text-[18px]'
// Below 360 px the 18 px row does not fit beside Dodaj + Powiadomienia + MENU, so
// it stacks like them: arrow over a 13 px caption, still 56 px tall.
const STACK_BELOW_360 = 'flex-col gap-0.5 text-[13px] min-[360px]:flex-row min-[360px]:gap-1.5 min-[360px]:text-[18px]'

function BackLinkView({ target, crowded, className }: Props & { target: Target }) {
  return (
    <Link
      href={target.href}
      aria-label={target.ariaLabel}
      className={`-ml-2 inline-flex h-14 shrink-0 items-center justify-center rounded-field px-2 leading-none font-bold text-ink no-underline! hover:bg-surface-3 ${crowded ? STACK_BELOW_360 : ROW} ${className ?? ''}`}
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
