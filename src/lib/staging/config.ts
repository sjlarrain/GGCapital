/**
 * Auto-promote flag (OA-3).
 *
 * Default OFF: at launch every promotion is human-reviewed, so agents (PAT
 * callers) cannot promote via the API. Flip on by setting STAGING_AUTO_PROMOTE
 * to "true" / "1" / "on" once we trust agent-driven promotion.
 */
export function isAutoPromoteEnabled(): boolean {
  const v = (process.env.STAGING_AUTO_PROMOTE ?? '').toLowerCase()
  return v === 'true' || v === '1' || v === 'on'
}
