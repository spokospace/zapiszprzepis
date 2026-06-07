'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { ResetPasswordForm } from './reset-password-form'

export default function ResetPasswordPage() {
  const [code, setCode] = useState<string | undefined>()
  const [email, setEmail] = useState<string | undefined>()
  const [error, setError] = useState<string | undefined>()

  useEffect(() => {
    // Extract token and email from hash (Supabase sends as #access_token=...&type=recovery)
    const hash = window.location.hash.slice(1)
    const params = new URLSearchParams(hash)
    const accessToken = params.get('access_token')
    const urlEmail = new URLSearchParams(window.location.search).get('email')

    if (accessToken) {
      setCode(accessToken)
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
        <ResetPasswordForm accessToken={code} email={email} error={error} />
      </div>
    </main>
  )
}
