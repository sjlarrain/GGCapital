import type { NextRequest } from 'next/server'
import { authenticate, hasScope } from '../../_lib/auth'
import { ok, unauthorized, forbidden, serverError, badRequest } from '../../_lib/respond'
import { parseBody, isResponse } from '../../_lib/validate'
import { StagingIngestSchema, StagingListQuerySchema } from '@/lib/schemas/staging'
import { logStagingTransition } from '@/lib/staging/log'
import { supabaseAdmin } from '@/lib/supabase/admin'

// ── GET /staging/events — review queue ────────────────────────────────────────
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized()
  if (!hasScope(ctx, 'staging:read')) return forbidden()

  const raw = Object.fromEntries(req.nextUrl.searchParams)
  const parsed = StagingListQuerySchema.safeParse(raw)
  if (!parsed.success) return badRequest('Invalid query parameters')
  const q = parsed.data

  let query = supabaseAdmin
    .from('staging_events')
    .select('*')
    .order('created_at', { ascending: false })
    .range(q.offset, q.offset + q.limit - 1)

  if (q.status) query = query.eq('status', q.status)
  if (q.event_class) query = query.eq('event_class', q.event_class)
  if (q.min_confidence !== undefined) query = query.gte('confidence', q.min_confidence)

  const { data, error } = await query
  if (error) return serverError(error.message)
  return ok(data)
}

// ── POST /staging/events — ingest (idempotent on source + source_ref) ─────────
export async function POST(req: NextRequest) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized()
  if (!hasScope(ctx, 'staging:write')) return forbidden()

  const body = await parseBody(req, StagingIngestSchema)
  if (isResponse(body)) return body

  // Idempotency: when a source_ref is supplied, a duplicate (source, source_ref)
  // must NOT create a second event — return the existing one unchanged (202).
  if (body.source_ref) {
    const { data: existing } = await supabaseAdmin
      .from('staging_events')
      .select('id, status')
      .eq('source', body.source)
      .eq('source_ref', body.source_ref)
      .maybeSingle()
    if (existing) {
      return ok({ id: existing.id, status: existing.status }, 202)
    }
  }

  const { data, error } = await supabaseAdmin
    .from('staging_events')
    .insert({
      source:         body.source,
      source_ref:     body.source_ref ?? null,
      raw_payload:    body.raw_payload,
      extracted:      body.extracted ?? null,
      proposed_links: body.proposed_links ?? null,
      event_class:    body.event_class ?? null,
      confidence:     body.confidence ?? null,
      created_by:     ctx.userId,
    })
    .select('id, status')
    .single()

  if (error) return serverError(error.message)

  await logStagingTransition(supabaseAdmin, {
    eventId: data.id,
    from:    null,
    to:      'pending',
    action:  'ingest',
    actor:   ctx.userId,
    detail:  { source: body.source, source_ref: body.source_ref ?? null },
  })

  return ok({ id: data.id, status: data.status }, 202)
}
