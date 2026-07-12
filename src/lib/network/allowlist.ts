/**
 * Network Intelligence access allowlist (Phase 3).
 *
 * `network:read` / `network:write` are internal-only: they let a caller resolve
 * companies and bulk-load intros into the relationship graph. Per the launch
 * decision they are gated by an explicit *per-user allowlist*, NOT by admin
 * role — the two daily operators may be plain `user` role, and everyone else is
 * limited to staging into /triage (the existing `staging:write`).
 *
 * The allowlist is a comma-separated list of Supabase auth user UUIDs in the
 * `NETWORK_ALLOWLIST` env var, e.g.
 *
 *   NETWORK_ALLOWLIST=11111111-1111-1111-1111-111111111111,2222...
 *
 * Find the ids with:
 *   select id, email from auth.users where email in ('you@…','hernan@…');
 *
 * FAIL CLOSED: if the var is unset/empty, `isNetworkUser` is false for everyone,
 * so no one can obtain or use network scopes until it is configured. This same
 * predicate gates the three surfaces that could grant the scope (PAT creation,
 * OAuth consent, the token UI) and the MCP tools that consume it, so it is the
 * single source of truth for "who is a network user."
 */

import type { Scope } from '@/lib/schemas/token'

export const NETWORK_SCOPES: Scope[] = ['network:read', 'network:write']

function parseAllowlist(): Set<string> {
  return new Set(
    (process.env.NETWORK_ALLOWLIST ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  )
}

// Parsed once per server process; env is fixed for the process lifetime.
const ALLOWED = parseAllowlist()

/** Is this user id permitted to hold and use the network:* scopes? */
export function isNetworkUser(userId: string | null | undefined): boolean {
  return !!userId && ALLOWED.has(userId)
}

/** True once at least one user id is configured (used for help text / diagnostics). */
export function networkAllowlistConfigured(): boolean {
  return ALLOWED.size > 0
}
