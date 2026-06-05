export async function fetchWithTimeout(
  url: string,
  options: { timeoutMs?: number; headers?: HeadersInit } = {},
): Promise<Response> {
  const { timeoutMs = 10_000, headers } = options
  return fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) })
}
