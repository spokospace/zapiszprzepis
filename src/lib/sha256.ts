/** SHA-256 (hex) of a string, via WebCrypto so it runs on both Workers (the
 *  extraction job) and Node (the backfill scripts). */
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}
