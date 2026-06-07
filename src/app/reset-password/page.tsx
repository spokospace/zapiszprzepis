'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { ResetPasswordForm } from './reset-password-form'

export default function ResetPasswordPage() {
  const [code, setCode] = useState<string | undefined>()
  const [email, setEmail] = useState<string | undefined>()
  const [error, setError] = useState<string | undefined>()

  useEffect(() => {
    // Extract token from query params (Supabase /auth/v1/verify redirects with ?token=...&type=recovery)
    const searchParams = new URLSearchParams(window.location.search)
    const token = searchParams.get('token')
    const urlEmail = searchParams.get('email')

    console.log('[reset-password] token:', token)
    console.log('[reset-password] email:', urlEmail)

    if (token) {
      setCode(token)
    }
    if (urlEmail) {
      setEmail(decodeURIComponent(urlEmail))
    }
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
        <ResetPasswordForm token={code} email={email} error={error} />
      </div>
    </main>
  )
}
