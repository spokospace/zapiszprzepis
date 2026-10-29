/** SHA-256 (hex) of a string or raw bytes, via WebCrypto so it runs on both
 *  Workers (the extraction job) and Node (the backfill scripts). */
export async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}
