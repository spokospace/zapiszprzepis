'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { ResetPasswordForm } from './reset-password-form'

export default function ResetPasswordPage() {
  const [code, setCode] = useState<string | undefined>()
  const [error, setError] = useState<string | undefined>()
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const codeParam = searchParams.get('code')
    const errorParam = searchParams.get('error')

    if (codeParam) setCode(codeParam)
    if (errorParam) setError(errorParam)
    setIsReady(true)
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
        {isReady && <ResetPasswordForm code={code} error={error} />}
      </div>
    </main>
  )
}
