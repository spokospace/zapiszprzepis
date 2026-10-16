// Removes a one-shot query param from the address bar without a navigation,
// keeping Next.js' own history state intact.
export function stripSearchParam(name: string) {
  const url = new URL(window.location.href)
  url.searchParams.delete(name)
  window.history.replaceState(window.history.state, '', url.toString())
}
