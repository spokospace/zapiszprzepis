import { PRODUCTION_SUPABASE_URL } from '@/lib/image-remote-patterns'

// Both are public by design and also in wrangler.jsonc `vars`. A NEXT_PUBLIC_ value
// reaches the browser only when it is set at build time, so production is the fallback.
export const PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || PRODUCTION_SUPABASE_URL
export const PUBLIC_SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_49CjHG7pAqYIFe7roJDZdA_5c_jBzj2'
