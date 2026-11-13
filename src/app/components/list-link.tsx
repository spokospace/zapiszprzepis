'use client'

import type { ComponentProps, MouseEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useListTransition } from './list-transition'
import { isModifiedClick } from './modified-click'

/**
 * A link that changes a list (clear the filter, …): a plain Link without JS, and with JS
 * its navigation runs inside the list's transition, so the results dim while the new
 * list loads (#435). Modified clicks (new tab, download) keep the browser's behaviour.
 */
export function ListLink({ href, scroll = false, onClick, ...props }: ComponentProps<typeof Link> & { href: string }) {
  const router = useRouter()
  const { startTransition } = useListTransition()

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event)
    if (isModifiedClick(event)) return
    event.preventDefault()
    startTransition(() => router.push(href, { scroll }))
  }

  return <Link href={href} scroll={scroll} onClick={handleClick} {...props} />
}
