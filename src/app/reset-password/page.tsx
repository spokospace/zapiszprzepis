import Image from 'next/image'
import { ResetPasswordForm } from './reset-password-form'

type SearchParams = Promise<{ error?: string }>

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { error } = await searchParams

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
        <ResetPasswordForm error={error} />
      </div>
    </main>
  )
}
