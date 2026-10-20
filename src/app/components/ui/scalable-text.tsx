'use client'

import { useTextScale } from './use-text-scale'

interface ScalableTextProps {
  /** Classes for the paragraph (colour, spacing); the 19 px base size is applied here. */
  className?: string
  children: React.ReactNode
}

/**
 * A paragraph that follows the "Wielkość tekstu" level chosen on the recipe page
 * (useTextScale shares the stored level across components). The base size sits on the
 * wrapper because .text-scalable (unlayered) scales its parent's size and would
 * override a size utility on the same element.
 */
export function ScalableText({ className = '', children }: ScalableTextProps) {
  const { scaleStyle } = useTextScale()
  return (
    <div style={scaleStyle} className="text-[19px]">
      <p className={`text-scalable ${className}`}>{children}</p>
    </div>
  )
}
