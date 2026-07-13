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

import { hasScope, type AuthContext, type Scope } from '@/app/api/v1/_lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { canUseNetwork } from '@/lib/network/allowlist'
import { resolveCompany } from '@/lib/network/resolve'
import { normName } from '@/lib/staging/mappings'
import {
  CompanyCreateSchema,
  CompanyUpdateSchema,
} from '@/lib/schemas/company'
import { ContactCreateSchema, ContactUpdateSchema } from '@/lib/schemas/contact'
import { MeetingCreateSchema } from '@/lib/schemas/meeting'
import { StagingIngestSchema, StagingListQuerySchema } from '@/lib/schemas/staging'
import { classifyEvent } from '@/lib/staging/rules'
import { computeDedupe } from '@/lib/staging/dedupe'
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

/**
 * Network guard: everything `guard` does, plus the per-user allowlist. network:*
 * is internal-only — even a token that somehow carries the scope cannot use these
 * tools unless the caller is on NETWORK_ALLOWLIST. Belt-and-suspenders over the
 * grant-time restrictions in tokens.ts / the OAuth authorize route.
 */
function networkGuard(extra: Extra, scope: Scope): { ctx: AuthContext } | { error: CallToolResult } {
  const g = guard(extra, scope)
  if ('error' in g) return g
  if (!canUseNetwork(g.ctx.userId, g.ctx.role)) return { error: toolErr('Forbidden: not authorized for network intelligence') }
  return g
}

// ── network entity (node) resolution ──────────────────────────────────────────
/**
 * Find or create the graph NODE for a party/facilitator name. This is what lets
 * the network include vertices that are not CRM companies:
 *  1. If the name resolves to an existing company (exact→alias→domain→fuzzy),
 *     reuse that company's node, or create a company-linked node if none exists.
 *  2. Otherwise create/reuse a NAME-ONLY node (company_id null), deduped by
 *     normName so the same name across many intros is one node.
 * Never rejects — a name that doesn't resolve becomes a name-only node, not an
 * error. Company promotion (linking a name-only node to a real company) is a
 * separate, explicit step (network_promote_entity).
 */
type EntityRef = { entity_id: string; company_id: string | null; name: string }

/** Ensure the (single) node backing a known company exists; reuse or create it. */
async function ensureEntityForCompany(companyId: string, companyName: string, actor: string): Promise<EntityRef> {
  const { data: existing } = await supabaseAdmin
    .from('network_entities').select('id, name, company_id').eq('company_id', companyId).maybeSingle()
  if (existing) return { entity_id: existing.id, company_id: existing.company_id, name: existing.name }
  const norm = normName(companyName)
  const { data: created, error } = await supabaseAdmin
    .from('network_entities')
    .insert({ name: companyName, name_norm: norm, company_id: companyId, created_by: actor })
    .select('id, name, company_id').single()
  // A concurrent insert (or a pre-existing name-only node with the same norm)
  // can race the unique(name_norm)/unique(company_id) indexes — fall back to a read.
  if (error || !created) {
    const { data: fallback } = await supabaseAdmin
      .from('network_entities').select('id, name, company_id')
      .or(`company_id.eq.${companyId},name_norm.eq.${norm}`).limit(1).maybeSingle()
    if (fallback) return { entity_id: fallback.id, company_id: fallback.company_id, name: fallback.name }
    throw new Error(error?.message ?? 'Failed to create entity')
  }
  return { entity_id: created.id, company_id: created.company_id, name: created.name }
}

async function findOrCreateEntity(
  name: string,
  email: string | undefined,
  actor: string,
): Promise<EntityRef> {
  const match = await resolveCompany(supabaseAdmin, { name, email })

  // Company-backed node: keyed on company_id (one node per company).
  if (match?.company_id) return ensureEntityForCompany(match.company_id, match.name, actor)

  // Name-only node: keyed on normName(name).
  const norm = normName(name)
  const { data: existing } = await supabaseAdmin
    .from('network_entities').select('id, name, company_id').eq('name_norm', norm).maybeSingle()
  if (existing) return { entity_id: existing.id, company_id: existing.company_id, name: existing.name }
  const { data: created, error } = await supabaseAdmin
    .from('network_entities')
    .insert({ name, name_norm: norm, company_id: null, created_by: actor })
    .select('id, name, company_id').single()
  if (error || !created) {
    const { data: fallback } = await supabaseAdmin
      .from('network_entities').select('id, name, company_id').eq('name_norm', norm).maybeSingle()
    if (fallback) return { entity_id: fallback.id, company_id: fallback.company_id, name: fallback.name }
    throw new Error(error?.message ?? 'Failed to create entity')
  }
  return { entity_id: created.id, company_id: created.company_id, name: created.name }
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

  // No staging_promote tool: promotion into the live CRM is intentionally
  // reserved for a human clicking Promote in /triage (Alpha policy), never an
  // MCP tool call — OAuth-connected agents act as the human, so isAgent()
  // alone can't gate this the way it gates PAT callers. Use the REST
  // `/api/v1/staging/events/[id]/promote` route (session-authenticated) instead.

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

// ── Network Intelligence tools ────────────────────────────────────────────────
// Internal-only (networkGuard = scope + allowlist). These build the relationship
// constellation from intros. Critically, network_create_intro CANNOT create
// companies: it only links existing companies.id, re-resolving each party name
// server-side and rejecting any that don't resolve — new companies must go
// through staging_ingest → /triage → promote (the existing Track A machinery).
export function registerNetworkTools(server: McpServer): void {
  // ── resolution + provenance reads ───────────────────────────────────────────
  server.registerTool(
    'network_search_companies',
    {
      title: 'Resolve a company for the network',
      description:
        'Resolve a company name (or a participant email) against the CRM using exact → alias → domain → fuzzy precedence. ' +
        'Returns [{company_id, name, match, score}] with match ∈ exact|alias|domain|fuzzy, or [] when there is no confident ' +
        'match. Trust []: it means stage the company for /triage, do not invent a link. Not the same as crm_search.',
      inputSchema: {
        query: z.string().min(1).describe('Company name, or a participant email for domain-tier matching'),
        email: z.string().optional().describe('Optional participant email to enable the domain tier'),
        limit: z.number().int().min(1).max(10).optional().describe('Unused beyond 1; this tool returns the single confident match'),
      },
    },
    async ({ query, email }, extra) => {
      const g = networkGuard(extra, 'network:read'); if ('error' in g) return g.error
      // If the query itself is an email and none was passed, use it for the domain tier.
      const emailForDomain = email ?? (query.includes('@') ? query : undefined)
      const match = await resolveCompany(supabaseAdmin, { name: query, email: emailForDomain })
      return toolOk(match ? [match] : [])
    }
  )

  server.registerTool(
    'network_get_relationship_source',
    {
      title: 'Get who introduced a company to GG',
      description: 'Fetch the provenance mapping for a company (who introduced it to GG), or null if none is recorded.',
      inputSchema: { company_id: z.string().uuid() },
    },
    async ({ company_id }, extra) => {
      const g = networkGuard(extra, 'network:read'); if ('error' in g) return g.error
      const { data, error } = await supabaseAdmin
        .from('relationship_sources')
        .select('*')
        .eq('company_id', company_id)
        .maybeSingle()
      if (error) return toolErr(error.message)
      return toolOk(data ?? null)
    }
  )

  // ── writes ──────────────────────────────────────────────────────────────────
  const PartySchema = z.object({
    name: z.string().min(1).describe('Company name as it appears in the intro'),
    side: z.number().int().min(1).max(2).describe('Which side of the intro (1 or 2)'),
    company_id: z.string().uuid().optional().describe('If already resolved, the CRM company id (still verified)'),
    email: z.string().optional().describe('Optional participant email for domain-tier resolution'),
  })

  server.registerTool(
    'network_create_intro',
    {
      title: 'Create an intro (auto-creates graph nodes)',
      description:
        'Insert one introduction as edges in the network graph. Each party becomes a NODE: names that resolve to an existing ' +
        'CRM company link to it; names that do not become name-only nodes (deduped across intros) — the tool never rejects and ' +
        'never creates a CRM company. Promote a name-only node to a company later with network_promote_entity. ' +
        'Idempotent on (source, source_ref): re-running never duplicates.',
      inputSchema: {
        direction: z.enum(['outbound', 'outbound_internal', 'inbound', 'other']),
        parties: z.array(PartySchema).min(2).describe('The companies on each side; at least two'),
        occurred_on: z.string().optional().describe('YYYY-MM-DD'),
        subject: z.string().optional(),
        facilitator: z
          .object({
            company_id: z.string().uuid().optional(),
            name: z.string().optional(),
            email: z.string().optional(),
            contact_id: z.string().uuid().optional(),
          })
          .optional()
          .describe('Who made the intro. Resolved leniently — an unresolved facilitator is left null, not rejected.'),
        source: z.string().optional().describe("Defaults to 'skill_import'; use 'bulk_excel' for the loader"),
        source_ref: z.string().optional().describe('Stable idempotency key (e.g. gmail thread id, or file:row)'),
        notes: z.string().optional(),
      },
    },
    async (args, extra) => {
      const g = networkGuard(extra, 'network:write'); if ('error' in g) return g.error
      const actor = g.ctx.userId
      const source = args.source ?? 'skill_import'
      const source_ref = args.source_ref ?? null

      // Idempotency: a prior import with the same (source, source_ref) is a no-op.
      if (source_ref) {
        const { data: existing } = await supabaseAdmin
          .from('intros').select('id').eq('source', source).eq('source_ref', source_ref).is('deleted_at', null).maybeSingle()
        if (existing) return toolOk({ id: existing.id, deduped: true })
      }

      // Every party becomes a graph node (company-linked or name-only) — never rejected.
      const resolved: { entity_id: string; company_id: string | null; side: number }[] = []
      for (const p of args.parties) {
        let ent: EntityRef
        if (p.company_id) {
          const { data: c } = await supabaseAdmin.from('companies').select('id, name').eq('id', p.company_id).is('deleted_at', null).maybeSingle()
          ent = c ? await ensureEntityForCompany(c.id, c.name, actor) : await findOrCreateEntity(p.name, p.email, actor)
        } else {
          ent = await findOrCreateEntity(p.name, p.email, actor)
        }
        resolved.push({ entity_id: ent.entity_id, company_id: ent.company_id, side: p.side })
      }
      const nameOnlyParties = resolved.filter((r) => r.company_id === null).length

      // Dedupe parties by node (unique(intro_id, entity_id)); keep first side seen.
      const byEntity = new Map<string, number>()
      for (const r of resolved) if (!byEntity.has(r.entity_id)) byEntity.set(r.entity_id, r.side)

      // Facilitator: lenient — becomes a node if named, otherwise left null.
      let facilitatorEntityId: string | null = null
      let facilitatorCompanyId: string | null = null
      const f = args.facilitator
      if (f?.company_id) {
        const { data: c } = await supabaseAdmin.from('companies').select('id, name').eq('id', f.company_id).is('deleted_at', null).maybeSingle()
        if (c) { const e = await ensureEntityForCompany(c.id, c.name, actor); facilitatorEntityId = e.entity_id; facilitatorCompanyId = e.company_id }
      } else if (f?.name) {
        const e = await findOrCreateEntity(f.name, f.email, actor)
        facilitatorEntityId = e.entity_id; facilitatorCompanyId = e.company_id
      }
      let facilitatorContactId: string | null = null
      if (f?.contact_id) {
        const { data: ct } = await supabaseAdmin.from('contacts').select('id').eq('id', f.contact_id).is('deleted_at', null).maybeSingle()
        facilitatorContactId = ct?.id ?? null
      }

      // Insert the intro, then its parties. If the parties insert fails, delete
      // the just-created intro so no orphan (edge-less) intro is left behind.
      const { data: intro, error: introErr } = await supabaseAdmin
        .from('intros')
        .insert({
          direction: args.direction,
          occurred_on: args.occurred_on ?? null,
          subject: args.subject ?? null,
          facilitator_company_id: facilitatorCompanyId,
          facilitator_entity_id: facilitatorEntityId,
          facilitator_contact_id: facilitatorContactId,
          source,
          source_ref,
          notes: args.notes ?? null,
          created_by: actor,
          updated_by: actor,
        })
        .select('id')
        .single()
      if (introErr || !intro) return toolErr(introErr?.message ?? 'Failed to create intro')

      const partyRows = [...byEntity.entries()].map(([entity_id, side]) => ({ intro_id: intro.id, entity_id, side }))
      const { error: partiesErr } = await supabaseAdmin.from('intro_parties').insert(partyRows)
      if (partiesErr) {
        await supabaseAdmin.from('intros').delete().eq('id', intro.id) // compensate
        return toolErr(`Failed to link parties (${partiesErr.message}); intro rolled back.`)
      }

      return toolOk({ id: intro.id, direction: args.direction, parties: partyRows.length, name_only_parties: nameOnlyParties, facilitator_entity_id: facilitatorEntityId, source, source_ref })
    }
  )

  // ── node → company promotion ────────────────────────────────────────────────
  server.registerTool(
    'network_search_entities',
    {
      title: 'Find a network node by name',
      description:
        'Search graph nodes by name (case/accent-insensitive substring). Returns [{entity_id, name, company_id, is_company}]. ' +
        'Use it to find the node you want to promote to a CRM company.',
      inputSchema: {
        query: z.string().min(1),
        limit: z.number().int().min(1).max(50).optional(),
      },
    },
    async ({ query, limit }, extra) => {
      const g = networkGuard(extra, 'network:read'); if ('error' in g) return g.error
      const { data, error } = await supabaseAdmin
        .from('network_entities')
        .select('id, name, company_id')
        .ilike('name_norm', `%${normName(query)}%`)
        .limit(limit ?? 20)
      if (error) return toolErr(error.message)
      return toolOk((data ?? []).map((e) => ({ entity_id: e.id, name: e.name, company_id: e.company_id, is_company: e.company_id !== null })))
    }
  )

  server.registerTool(
    'network_promote_entity',
    {
      title: 'Promote a network node to a CRM company',
      description:
        'Link an existing name-only graph node to a CRM company. Either pass company_id to link an existing company, or pass ' +
        'company:{name,...} to create a new company and link it (name defaults to the node name). Idempotent if the node is ' +
        'already linked to that same company; rejects if it is linked to a different one. A name-only node you never promote ' +
        'simply stays in the graph unlinked — nothing forces promotion.',
      inputSchema: {
        entity_id: z.string().uuid(),
        company_id: z.string().uuid().optional().describe('Link to this existing company'),
        company: z
          .object({
            name: z.string().optional(),
            website: z.string().optional(),
            description: z.string().optional(),
            country: z.string().optional(),
          })
          .optional()
          .describe('Create a new company with these fields and link it (name defaults to the node name)'),
      },
    },
    async ({ entity_id, company_id, company }, extra) => {
      const g = networkGuard(extra, 'network:write'); if ('error' in g) return g.error
      const actor = g.ctx.userId

      const { data: entity } = await supabaseAdmin
        .from('network_entities').select('id, name, company_id').eq('id', entity_id).maybeSingle()
      if (!entity) return toolErr(`Node ${entity_id} not found`)
      if (entity.company_id) {
        if (company_id && entity.company_id === company_id) return toolOk({ entity_id, company_id, already_linked: true })
        return toolErr(`Node "${entity.name}" is already linked to company ${entity.company_id}. Unlink it first to relink.`)
      }

      // Resolve the target company: link existing, or create new.
      let targetCompanyId: string
      if (company_id) {
        const { data: c } = await supabaseAdmin.from('companies').select('id').eq('id', company_id).is('deleted_at', null).maybeSingle()
        if (!c) return toolErr(`Company ${company_id} not found`)
        // The partial-unique index enforces one node per company; check for a friendlier error.
        const { data: taken } = await supabaseAdmin.from('network_entities').select('id').eq('company_id', company_id).maybeSingle()
        if (taken) return toolErr(`Company ${company_id} already backs another node (${taken.id}).`)
        targetCompanyId = company_id
      } else {
        const name = company?.name?.trim() || entity.name
        const { data: created, error } = await supabaseAdmin
          .from('companies')
          .insert({
            name,
            website: company?.website ?? null,
            description: company?.description ?? null,
            country: company?.country ?? null,
            source: 'network_promote',
            created_by: actor,
            updated_by: actor,
          })
          .select('id').single()
        if (error || !created) return toolErr(error?.message ?? 'Failed to create company')
        targetCompanyId = created.id
      }

      const { data: linked, error: linkErr } = await supabaseAdmin
        .from('network_entities').update({ company_id: targetCompanyId }).eq('id', entity_id).select('id, name, company_id').single()
      if (linkErr || !linked) return toolErr(linkErr?.message ?? 'Failed to link node to company')
      return toolOk({ entity_id: linked.id, name: linked.name, company_id: linked.company_id, promoted: true })
    }
  )

  server.registerTool(
    'network_upsert_relationship_source',
    {
      title: 'Record who sourced a company to GG',
      description: 'Upsert the provenance for a company: which company/contact introduced it to GG. One row per company.',
      inputSchema: {
        company_id: z.string().uuid(),
        introduced_by_company_id: z.string().uuid().optional(),
        introduced_by_contact_id: z.string().uuid().optional(),
        note: z.string().optional(),
      },
    },
    async ({ company_id, introduced_by_company_id, introduced_by_contact_id, note }, extra) => {
      const g = networkGuard(extra, 'network:write'); if ('error' in g) return g.error

      const { data: existing } = await supabaseAdmin.from('relationship_sources').select('company_id').eq('company_id', company_id).maybeSingle()
      const patch = {
        introduced_by_company_id: introduced_by_company_id ?? null,
        introduced_by_contact_id: introduced_by_contact_id ?? null,
        note: note ?? null,
      }
      if (existing) {
        // created_by is preserved on update; the updated_at trigger refreshes the timestamp.
        const { data, error } = await supabaseAdmin.from('relationship_sources').update(patch).eq('company_id', company_id).select('*').single()
        if (error) return toolErr(error.message)
        return toolOk(data)
      }
      const { data, error } = await supabaseAdmin
        .from('relationship_sources')
        .insert({ company_id, ...patch, created_by: g.ctx.userId })
        .select('*')
        .single()
      if (error) return toolErr(error.message)
      return toolOk(data)
    }
  )
}
