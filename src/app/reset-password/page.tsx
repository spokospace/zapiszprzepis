'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { ResetPasswordForm } from './reset-password-form'

export default function ResetPasswordPage() {
  const [code, setCode] = useState<string | undefined>()
  const [email, setEmail] = useState<string | undefined>()
  const [error, setError] = useState<string | undefined>()

  useEffect(() => {
    // Extract code and email from URL query params
    // Supabase /auth/v1/verify redirects with ?code=TOKEN&email=USER_EMAIL
    const searchParams = new URLSearchParams(window.location.search)
    const codeParam = searchParams.get('code')
    const emailParam = searchParams.get('email')

    console.log('[reset-password] code:', codeParam ? 'present' : 'missing')
    console.log('[reset-password] email:', emailParam)

    if (codeParam) {
      setCode(codeParam)
    }
    if (emailParam) {
      setEmail(decodeURIComponent(emailParam))
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
        <ResetPasswordForm code={code} email={email} error={error} />
      </div>
    </main>
  )
}
