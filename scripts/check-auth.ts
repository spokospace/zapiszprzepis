async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url) {
    console.error('✗ Brak NEXT_PUBLIC_SUPABASE_URL w .env.local')
    process.exit(1)
  }
  if (!key) {
    console.error('✗ Brak NEXT_PUBLIC_SUPABASE_ANON_KEY w .env.local')
    process.exit(1)
  }

  const healthUrl = `${url.replace(/\/$/, '')}/auth/v1/health`

  const res = await fetch(healthUrl, {
    headers: { apikey: key },
  })
  if (!res.ok) {
    console.error(`✗ Supabase auth zwróciło ${res.status} ${res.statusText} (${healthUrl})`)
    process.exit(1)
  }
  const body = (await res.json()) as { name?: string }
  if (body.name !== 'GoTrue') {
    console.error(`✗ Nieoczekiwana odpowiedź health: ${JSON.stringify(body)}`)
    process.exit(1)
  }
  console.log(`✓ Supabase auth healthy: ${url}`)
}

main().catch((err: Error) => {
  console.error(`✗ Smoke check failed: ${err.message}`)
  process.exit(1)
})
