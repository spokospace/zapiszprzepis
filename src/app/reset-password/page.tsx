'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { ResetPasswordForm } from './reset-password-form'

export default function ResetPasswordPage() {
  const [hasSession, setHasSession] = useState<boolean | null>(null)
  const [email, setEmail] = useState<string | undefined>()
  const [error, setError] = useState<string | undefined>()

  useEffect(() => {
    // Check if user has a session (set by Supabase /auth/v1/verify after token verification)
    const checkSession = async () => {
      try {
        const supabase = createSupabaseBrowserClient()
        const { data: { session } } = await supabase.auth.getSession()
        const urlEmail = new URLSearchParams(window.location.search).get('email')

        console.log('[reset-password] session:', session?.user?.email)

        if (session) {
          setHasSession(true)
          setEmail(session.user?.email || urlEmail || undefined)
        } else {
          setHasSession(false)
        }
      } catch (err) {
        console.error('[reset-password] error checking session:', err)
        setHasSession(false)
      }
    }

    checkSession()
  }, [])

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="flex flex-col gap-6">
        <h1>
          <Image
            src="/logo.svg"
            alt="ZapiszPrzepis"
            width={1970}
            height={668}
            priority
            unoptimized
            className="block h-auto w-48"
          />
        </h1>
        <ResetPasswordForm hasSession={hasSession} email={email} error={error} />
      </div>
    </main>
  )
}
