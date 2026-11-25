/**
 * Append-only log of CRM/network writes made through MCP tools.
 *
 * Most MCP writes land straight in the live tables (crm_create_*, crm_update_*,
 * network_*) and never pass through staging, so /triage alone can't show what
 * an MCP-connected agent has actually been doing. Every write tool in
 * registerCrmTools / registerNetworkTools calls logMcpActivity once it
 * succeeds; /mcp-activity reads this table back as a flat recent-activity feed.
 *
 * Only ever called from tools.ts with supabaseAdmin (service role) — RLS on
 * mcp_activity_log grants authenticated users read-only access.
 */

import { supabaseAdmin } from '@/lib/supabase/admin'
import type { AuthContext } from '@/app/api/v1/_lib/auth'

export type McpActivityEntityTable =
  | 'companies'
  | 'contacts'
  | 'meetings'
  | 'staging_events'
  | 'intros'
  | 'network_entities'
  | 'relationship_sources'

export async function logMcpActivity(params: {
  tool: string
  ctx: AuthContext
  entityTable: McpActivityEntityTable
  entityId: string | null
  summary: string
  detail?: Record<string, unknown> | null
}): Promise<void> {
  const { tool, ctx, entityTable, entityId, summary, detail } = params
  await supabaseAdmin.from('mcp_activity_log').insert({
    tool_name: tool,
    actor: ctx.userId,
    auth_type: ctx.authType,
    entity_table: entityTable,
    entity_id: entityId,
    summary,
    detail: detail ?? null,
  })
}
