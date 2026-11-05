'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Toast, type ToastProps } from '@/app/components/toast'
import { browserSession } from '@/lib/browser-session'

type Notice = Required<Pick<ToastProps, 'message' | 'type' | 'clearParam'>>

/** The one-shot messages a redirect to the recipe page leaves in the address bar. */
export function recipeNotices(params: URLSearchParams): Notice[] {
  const notices: Notice[] = []
  if (params.get('duplicate') === '1') {
    notices.push({ message: 'Ten przepis już masz.', type: 'info', clearParam: 'duplicate' })
  }
  if (params.get('in_favorites') === '1') {
    notices.push({
      message: 'Ten przepis już jest w aplikacji Zapisz Przepis. Dodaliśmy go do Twoich ulubionych.',
      type: 'info',
      clearParam: 'in_favorites',
    })
  }
  if (params.get('refreshing') === '1') {
    notices.push({ message: 'Odświeżam przepis — zmiany pojawią się za chwilę.', type: 'success', clearParam: 'refreshing' })
  }
  const refreshError = {
    '1': 'Nie można odświeżyć — przepis nie ma źródłowego adresu.',
    no_access: 'Odświeżanie przepisów wymaga kodu dostępu.',
    rate_limited: 'Za dużo odświeżeń naraz. Spróbuj później, za kilka minut.',
    unavailable: 'Nie udało się odświeżyć. Spróbuj za chwilę.',
  }[params.get('refresh_error') ?? '']
  if (refreshError) notices.push({ message: refreshError, type: 'error', clearParam: 'refresh_error' })
  return notices
}

/**
 * Read in the browser, so the page stays the same for everyone. Kept in state because each
 * toast removes its param from the address bar, which would otherwise take the toast with it.
 */
export function RecipeNotices() {
  const params = useSearchParams()
  const [notices, setNotices] = useState<Notice[]>([])

  useEffect(() => {
    const found = recipeNotices(new URLSearchParams(params.toString()))
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (found.length > 0) setNotices(found)
    // The add flow favorited this recipe on the server, so the hearts must read it again.
    if (params.get('in_favorites') === '1') void browserSession.sync({ force: true })
  }, [params])

  return notices.map((notice) => <Toast key={notice.clearParam} {...notice} duration={5000} />)
}
