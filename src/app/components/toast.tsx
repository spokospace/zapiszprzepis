'use client'

import { useEffect, useState } from 'react'

export interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'info'
  duration?: number
}

export function Toast({ message, type = 'success', duration = 3000 }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
    }, duration)

    return () => clearTimeout(timer)
  }, [duration])

  if (!isVisible) return null

  const bgColor = {
    success: 'bg-emerald-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
  }[type]

  const icon = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
  }[type]

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-6 right-6 flex items-center gap-3 rounded-lg ${bgColor} px-4 py-3 text-sm font-medium text-white shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-300`}
    >
      <span className="text-lg">{icon}</span>
      <span>{message}</span>
    </div>
  )
}
