-- ============================================================
-- MCP activity log
--
-- Most MCP writes (crm_create_*, crm_update_*, network_*) go straight into
-- the live tables and never touch staging — only the low-confidence ones
-- reach /triage. That left no feed of "what did an MCP-connected agent just
-- write", which made it hard to tell whether triage (and the skills driving
-- it) were actually behaving. This is an append-only log of every write an
-- MCP tool makes, regardless of which table it lands in, so /mcp-activity
-- can show the real recent activity across companies/contacts/meetings/
-- staging/network — visibility only, no new review workflow.
--
-- Always inserted via supabaseAdmin from src/lib/mcp/tools.ts (service role),
-- never from the web app's request-scoped client — hence no insert policy
-- below; authenticated users get read-only access, same as Triage.
-- ============================================================

create table mcp_activity_log (
  id           uuid primary key default uuid_generate_v4(),
  tool_name    text not null,
  actor        uuid not null references auth.users(id),
  auth_type    text not null check (auth_type in ('pat', 'oauth')),
  entity_table text,                      -- companies | contacts | meetings | staging_events | intros | network_entities | relationship_sources
  entity_id    uuid,
  summary      text not null,             -- human-readable one-liner for the activity feed
  detail       jsonb,
  created_at   timestamptz not null default now()
);

create index on mcp_activity_log (created_at desc);
create index on mcp_activity_log (entity_table, entity_id);

alter table mcp_activity_log enable row level security;

create policy "auth read mcp activity" on mcp_activity_log
  for select to authenticated using (true);
