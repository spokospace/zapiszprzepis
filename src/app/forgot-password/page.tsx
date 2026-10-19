import { BrandLogo } from '@/app/components/brand-logo'
import { ForgotPasswordForm } from './forgot-password-form'

type SearchParams = Promise<{
  error?: string
  email?: string
  sent?: string
}>

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { error, email, sent } = await searchParams

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="flex flex-col gap-6">
        <h1>
          <BrandLogo />
        </h1>
        <ForgotPasswordForm error={error} email={email} sent={sent} />
      </div>
    </main>
  )
}
