import type { AnchorHTMLAttributes } from 'react'

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean | null }

/** Stands in for next/link in the pilot: a plain anchor, so a click is a full page load. */
export default function Link({ prefetch, ...rest }: Props) {
  void prefetch
  return <a {...rest} />
}
