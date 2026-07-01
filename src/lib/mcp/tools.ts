/**
 * MCP tool surface for the GG Capital CRM.
 *
 * These tools are the agent's "hands": one tool per CRM/staging operation,
 * mirroring the REST routes under `/api/v1/*` and reusing the *same* building
 * blocks — the zod schemas in `@/lib/schemas/*`, the `supabaseAdmin` client, and
 * the staging libs (`rules`, `promote`, `config`, `log`). Auth/scope rules are
 * identical to REST: the caller's identity arrives in `extra.authInfo.extra`
 * (populated by `withMcpAuth`'s verifier) and is checked with `hasScope`.
 *
 * Keeping tools thin + schema-shared means the Skill (A6), the REST API, and
 * these tools all enforce the same contract.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js'
import type { ServerRequest, ServerNotification, CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

import { hasScope, isAgent, type AuthContext, type Scope } from '@/app/api/v1/_lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  CompanyCreateSchema,
  CompanyUpdateSchema,
} from '@/lib/schemas/company'
import { ContactCreateSchema, ContactUpdateSchema } from '@/lib/schemas/contact'
import { MeetingCreateSchema } from '@/lib/schemas/meeting'
import { StagingIngestSchema, StagingListQuerySchema } from '@/lib/schemas/staging'
import { classifyEvent } from '@/lib/staging/rules'
import { computeDedupe } from '@/lib/staging/dedupe'
import { promoteStagingEvent, StagingNotReadyError, StagingNothingToPromoteError } from '@/lib/staging/promote'
import { isAutoPromoteEnabled } from '@/lib/staging/config'
import { logStagingTransition } from '@/lib/staging/log'

type Extra = RequestHandlerExtra<ServerRequest, ServerNotification>

// ── result + auth helpers ─────────────────────────────────────────────────────
function toolOk(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}
function toolErr(message: string): CallToolResult {
  return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true }
}

/** Rebuild the REST AuthContext from the MCP auth info attached by the verifier. */
function ctxFrom(extra: Extra): AuthContext | null {
  const info = extra.authInfo
  const meta = info?.extra as { userId?: string; role?: 'admin' | 'user'; authType?: AuthContext['authType'] } | undefined
  if (!info || !meta?.userId || !meta.role || !meta.authType) return null
  return { userId: meta.userId, role: meta.role, scopes: (info.scopes ?? []) as Scope[], authType: meta.authType }
}

/** Guard: resolve ctx + require a scope, or return an error result. */
function guard(extra: Extra, scope: Scope): { ctx: AuthContext } | { error: CallToolResult } {
  const ctx = ctxFrom(extra)
  if (!ctx) return { error: toolErr('Unauthorized') }
  if (!hasScope(ctx, scope)) return { error: toolErr(`Forbidden: missing scope ${scope}`) }
  return { ctx }
}

// ── registration ──────────────────────────────────────────────────────────────
export function registerCrmTools(server: McpServer): void {
  // ── search + reads ──────────────────────────────────────────────────────────
  server.registerTool(
    'crm_search',
    {
      title: 'Search CRM',
      description: 'Full-text search across companies and contacts by name or email. Use before creating records to avoid duplicates.',
      inputSchema: { q: z.string().min(2).describe('Search text, ≥2 chars') },
    },
    async ({ q }, extra) => {
      const g = guard(extra, 'crm:read'); if ('error' in g) return g.error
      const [companies, contacts] = await Promise.all([
        supabaseAdmin.from('companies').select('id, name, website, data_status, missing_fields').ilike('name', `%${q}%`).is('deleted_at', null).limit(10),
        supabaseAdmin.from('contacts').select('id, name, email, company_id, data_status, missing_fields, company:companies(id, name)').or(`name.ilike.%${q}%,email.ilike.%${q}%`).is('deleted_at', null).limit(10),
      ])
      if (companies.error) return toolErr(companies.error.message)
      if (contacts.error) return toolErr(contacts.error.message)
      return toolOk({ q, companies: companies.data ?? [], contacts: contacts.data ?? [] })
    }
  )

  server.registerTool(
    'crm_get_company',
    { title: 'Get company', description: 'Fetch a single company by id.', inputSchema: { id: z.string().uuid() } },
    async ({ id }, extra) => {
      const g = guard(extra, 'crm:read'); if ('error' in g) return g.error
      const { data, error } = await supabaseAdmin.from('companies').select('*').eq('id', id).is('deleted_at', null).single()
      if (error || !data) return toolErr('Not found')
      return toolOk(data)
    }
  )

  server.registerTool(
    'crm_get_contact',
    { title: 'Get contact', description: 'Fetch a single contact by id.', inputSchema: { id: z.string().uuid() } },
    async ({ id }, extra) => {
      const g = guard(extra, 'crm:read'); if ('error' in g) return g.error
      const { data, error } = await supabaseAdmin.from('contacts').select('*').eq('id', id).is('deleted_at', null).single()
      if (error || !data) return toolErr('Not found')
      return toolOk(data)
    }
  )

  server.registerTool(
    'crm_get_meeting',
    { title: 'Get meeting', description: 'Fetch a single meeting by id.', inputSchema: { id: z.string().uuid() } },
    async ({ id }, extra) => {
      const g = guard(extra, 'crm:read'); if ('error' in g) return g.error
      const { data, error } = await supabaseAdmin.from('meetings').select('*').eq('id', id).single()
      if (error || !data) return toolErr('Not found')
      return toolOk(data)
    }
  )

  server.registerTool(
    'tags_list',
    {
      title: 'List tag catalogs',
      description: 'List the controlled tag catalogs (industries, regions, stages, types, statuses, meeting types). Only use ids from these catalogs — never invent tags.',
      inputSchema: {},
    },
    async (_args, extra) => {
      const g = guard(extra, 'crm:read'); if ('error' in g) return g.error
      const [industries, regions, stages, types, statuses, meetingTypes] = await Promise.all([
        supabaseAdmin.from('tag_industries').select('*').order('name'),
        supabaseAdmin.from('tag_regions').select('*').order('name'),
        supabaseAdmin.from('tag_stages').select('*').order('name'),
        supabaseAdmin.from('tag_types').select('*').order('name'),
        supabaseAdmin.from('tag_statuses').select('*').order('name'),
        supabaseAdmin.from('tag_meeting_types').select('*').order('name'),
      ])
      return toolOk({
        industries: industries.data ?? [], regions: regions.data ?? [], stages: stages.data ?? [],
        types: types.data ?? [], statuses: statuses.data ?? [], meetingTypes: meetingTypes.data ?? [],
      })
    }
  )

  // ── creates ───────────────────────────────────────────────────────────────
  server.registerTool(
    'crm_create_company',
    { title: 'Create company', description: 'Create a company. Search first to avoid duplicates. Tag ids must come from tags_list.', inputSchema: CompanyCreateSchema.shape },
    async (args, extra) => {
      const g = guard(extra, 'crm:write'); if ('error' in g) return g.error
      const parsed = CompanyCreateSchema.safeParse(args)
      if (!parsed.success) return toolErr(JSON.stringify(parsed.error.flatten()))
      const { data, error } = await supabaseAdmin.from('companies').insert({ ...parsed.data, created_by: g.ctx.userId, updated_by: g.ctx.userId }).select().single()
      if (error) return toolErr(error.message)
      return toolOk(data)
    }
  )

  server.registerTool(
    'crm_create_contact',
    { title: 'Create contact', description: 'Create a contact. Requires name, email, and company_id.', inputSchema: ContactCreateSchema.shape },
    async (args, extra) => {
      const g = guard(extra, 'crm:write'); if ('error' in g) return g.error
      const parsed = ContactCreateSchema.safeParse(args)
      if (!parsed.success) return toolErr(JSON.stringify(parsed.error.flatten()))
      const { data, error } = await supabaseAdmin.from('contacts').insert({ ...parsed.data, created_by: g.ctx.userId, updated_by: g.ctx.userId }).select().single()
      if (error) return toolErr(error.message)
      return toolOk(data)
    }
  )

  server.registerTool(
    'crm_create_meeting',
    { title: 'Create meeting', description: 'Create a meeting. Requires company_id, date (YYYY-MM-DD) and title.', inputSchema: MeetingCreateSchema.shape },
    async (args, extra) => {
      const g = guard(extra, 'crm:write'); if ('error' in g) return g.error
      const parsed = MeetingCreateSchema.safeParse(args)
      if (!parsed.success) return toolErr(JSON.stringify(parsed.error.flatten()))
      const { data, error } = await supabaseAdmin.from('meetings').insert({ ...parsed.data, created_by: g.ctx.userId, updated_by: g.ctx.userId }).select().single()
      if (error) return toolErr(error.message)
      return toolOk(data)
    }
  )

  // ── updates ───────────────────────────────────────────────────────────────
  server.registerTool(
    'crm_update_company',
    { title: 'Update company', description: 'Patch a company by id. Only send fields you want to change.', inputSchema: { id: z.string().uuid(), ...CompanyUpdateSchema.shape } },
    async ({ id, ...patch }, extra) => {
      const g = guard(extra, 'crm:write'); if ('error' in g) return g.error
      const parsed = CompanyUpdateSchema.safeParse(patch)
      if (!parsed.success) return toolErr(JSON.stringify(parsed.error.flatten()))
      const { data, error } = await supabaseAdmin.from('companies').update({ ...parsed.data, updated_by: g.ctx.userId }).eq('id', id).is('deleted_at', null).select().single()
      if (error || !data) return toolErr('Not found')
      return toolOk(data)
    }
  )

  server.registerTool(
    'crm_update_contact',
    { title: 'Update contact', description: 'Patch a contact by id. Only send fields you want to change.', inputSchema: { id: z.string().uuid(), ...ContactUpdateSchema.shape } },
    async ({ id, ...patch }, extra) => {
      const g = guard(extra, 'crm:write'); if ('error' in g) return g.error
      const parsed = ContactUpdateSchema.safeParse(patch)
      if (!parsed.success) return toolErr(JSON.stringify(parsed.error.flatten()))
      const { data, error } = await supabaseAdmin.from('contacts').update({ ...parsed.data, updated_by: g.ctx.userId }).eq('id', id).is('deleted_at', null).select().single()
      if (error || !data) return toolErr('Not found')
      return toolOk(data)
    }
  )

  // ── staging / triage ──────────────────────────────────────────────────────
  server.registerTool(
    'staging_ingest',
    { title: 'Stage an event', description: 'Submit a low-confidence or incomplete observation to the review queue instead of writing directly to the CRM.', inputSchema: StagingIngestSchema.shape },
    async (args, extra) => {
      const g = guard(extra, 'staging:write'); if ('error' in g) return g.error
      const parsed = StagingIngestSchema.safeParse(args)
      if (!parsed.success) return toolErr(JSON.stringify(parsed.error.flatten()))
      const body = parsed.data

      if (body.source_ref) {
        const { data: existing } = await supabaseAdmin.from('staging_events').select('id, status').eq('source', body.source).eq('source_ref', body.source_ref).maybeSingle()
        if (existing) return toolOk({ id: existing.id, status: existing.status, deduped: true })
      }

      const { data, error } = await supabaseAdmin.from('staging_events').insert({
        source: body.source, source_ref: body.source_ref ?? null, raw_payload: body.raw_payload,
        extracted: body.extracted ?? null, proposed_links: body.proposed_links ?? null,
        event_class: body.event_class ?? null, confidence: body.confidence ?? null, created_by: g.ctx.userId,
      }).select('id, status').single()
      if (error) return toolErr(error.message)

      await logStagingTransition(supabaseAdmin, { eventId: data.id, from: null, to: 'pending', action: 'ingest', actor: g.ctx.userId, detail: { source: body.source, source_ref: body.source_ref ?? null } })
      return toolOk({ id: data.id, status: data.status })
    }
  )

  server.registerTool(
    'staging_list',
    { title: 'List staging queue', description: 'List staged events, optionally filtered by status/class/confidence.', inputSchema: StagingListQuerySchema.shape },
    async (args, extra) => {
      const g = guard(extra, 'staging:read'); if ('error' in g) return g.error
      const parsed = StagingListQuerySchema.safeParse(args)
      if (!parsed.success) return toolErr(JSON.stringify(parsed.error.flatten()))
      const q = parsed.data
      let query = supabaseAdmin.from('staging_events').select('*').order('created_at', { ascending: false }).range(q.offset, q.offset + q.limit - 1)
      if (q.status) query = query.eq('status', q.status)
      if (q.event_class) query = query.eq('event_class', q.event_class)
      if (q.min_confidence !== undefined) query = query.gte('confidence', q.min_confidence)
      const { data, error } = await query
      if (error) return toolErr(error.message)
      return toolOk(data)
    }
  )

  server.registerTool(
    'staging_classify',
    { title: 'Classify a staged event', description: 'Run the hard gates + confidence rules on a staged event → classified | needs_info | ready.', inputSchema: { id: z.string().uuid() } },
    async ({ id }, extra) => {
      const g = guard(extra, 'staging:write'); if ('error' in g) return g.error
      const { data: event, error: loadErr } = await supabaseAdmin.from('staging_events').select('*').eq('id', id).single()
      if (loadErr || !event) return toolErr('Not found')
      if (event.status === 'promoted' || event.status === 'rejected') return toolErr(`Cannot classify a ${event.status} event`)

      const dedupe = await computeDedupe(supabaseAdmin, { event_class: event.event_class, proposed_links: event.proposed_links })
      const result = classifyEvent({ event_class: event.event_class, confidence: event.confidence, extracted: event.extracted, proposed_links: event.proposed_links, dedupe })
      const { data: updated, error: updErr } = await supabaseAdmin.from('staging_events').update({
        status: result.status, event_class: result.event_class, confidence: result.confidence, blocking_reasons: result.blocking_reasons, classified_by: g.ctx.userId,
      }).eq('id', id).select('id, status, event_class, confidence, blocking_reasons').single()
      if (updErr || !updated) return toolErr(updErr?.message ?? 'Update failed')

      await logStagingTransition(supabaseAdmin, { eventId: id, from: event.status, to: result.status, action: 'classify', actor: g.ctx.userId, detail: { blocking_reasons: result.blocking_reasons, confidence: result.confidence } })
      return toolOk(updated)
    }
  )

  server.registerTool(
    'staging_promote',
    { title: 'Promote a staged event', description: 'Promote a READY staged event into the official CRM tables (transactional). Agents (PAT) are blocked while auto-promote is off; human sessions may promote.', inputSchema: { id: z.string().uuid() } },
    async ({ id }, extra) => {
      const g = guard(extra, 'staging:promote'); if ('error' in g) return g.error
      const { data: event, error: loadErr } = await supabaseAdmin.from('staging_events').select('id, status').eq('id', id).single()
      if (loadErr || !event) return toolErr('Not found')
      if (event.status !== 'ready') return toolErr('Event is not ready for promotion')
      if (isAgent(g.ctx) && !isAutoPromoteEnabled()) return toolErr('Auto-promote is disabled; agent promotion requires human review')

      try {
        const result = await promoteStagingEvent(id, g.ctx.userId)
        return toolOk(result)
      } catch (e) {
        if (e instanceof StagingNotReadyError || e instanceof StagingNothingToPromoteError) return toolErr(e.message)
        if (e instanceof Error && e.message === 'STAGING_NOT_FOUND') return toolErr('Not found')
        return toolErr(e instanceof Error ? e.message : 'Promotion failed')
      }
    }
  )

  server.registerTool(
    'staging_reject',
    { title: 'Reject a staged event', description: 'Terminally reject a staged event with an optional note.', inputSchema: { id: z.string().uuid(), note: z.string().optional() } },
    async ({ id, note }, extra) => {
      const g = guard(extra, 'staging:write'); if ('error' in g) return g.error
      const { data: event, error: loadErr } = await supabaseAdmin.from('staging_events').select('id, status').eq('id', id).single()
      if (loadErr || !event) return toolErr('Not found')
      if (event.status === 'promoted' || event.status === 'rejected') return toolErr(`Cannot reject a ${event.status} event`)

      const { data: updated, error: updErr } = await supabaseAdmin.from('staging_events').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', id).select('id, status').single()
      if (updErr || !updated) return toolErr(updErr?.message ?? 'Update failed')

      await logStagingTransition(supabaseAdmin, { eventId: id, from: event.status, to: 'rejected', action: 'reject', actor: g.ctx.userId, detail: note ? { note } : null })
      return toolOk(updated)
    }
  )
}
