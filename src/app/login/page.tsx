import Image from 'next/image'
import { SignInForm } from './signin-form'

type SearchParams = Promise<{
  error?: string
  email?: string
  sent?: string
  success?: string
}>

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { error, email, sent, success } = await searchParams

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
        <SignInForm error={error} email={email} sent={sent} success={success} />
      </div>
    </main>
  )
}
