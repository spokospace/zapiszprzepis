export function mapAuthError(code: string | undefined): string {
  if (!code) return 'unknown'
  if (code.includes('expired')) return 'expired'
  if (code.includes('used')) return 'used'
  if (code === 'flow_state_not_found') return 'expired'
  return 'unknown'
}
