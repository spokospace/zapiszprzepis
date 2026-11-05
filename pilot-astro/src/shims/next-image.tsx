import type { ImgHTMLAttributes } from 'react'

const SITE = 'https://zapiszprzepis.pl'
const WIDTHS = [640, 750, 828, 1080, 1200, 1920]

const optimized = (src: string, width: number) => `${SITE}/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=75`

/** The same responsive candidates next/image emits, through production's image route. */
export const imageSrcSet = (src: string) => WIDTHS.map((w) => `${optimized(src, w)} ${w}w`).join(', ')

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { src: string; fill?: boolean; priority?: boolean; unoptimized?: boolean }

/** Stands in for next/image in the pilot: a plain img with next/image's srcset and fill styles. */
export default function Image({ fill, priority, unoptimized, style, src, ...rest }: Props) {
  const remote = src.startsWith('http') && !unoptimized
  const fillStyle = fill ? { position: 'absolute' as const, height: '100%', width: '100%', left: 0, top: 0, right: 0, bottom: 0, color: 'transparent' } : undefined
  return (
    <img
      {...rest}
      src={remote ? optimized(src, 828) : src.startsWith('/') ? `${SITE}${src}` : src}
      srcSet={remote ? imageSrcSet(src) : undefined}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      style={{ ...fillStyle, ...style }}
    />
  )
}
