import type { ImgHTMLAttributes } from 'react'

type Props = ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean; unoptimized?: boolean }

/** Stands in for next/image in the pilot: a plain img, same sizing for `fill`. */
export default function Image({ fill, priority, unoptimized, style, ...rest }: Props) {
  void unoptimized
  const fillStyle = fill ? { position: 'absolute' as const, height: '100%', width: '100%', left: 0, top: 0 } : undefined
  return <img {...rest} loading={priority ? 'eager' : 'lazy'} style={{ ...fillStyle, ...style }} />
}
