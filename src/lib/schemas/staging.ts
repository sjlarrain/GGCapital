import { z } from 'zod'

export const STAGING_STATUSES = [
  'pending',
  'classified',
  'needs_info',
  'ready',
  'promoted',
  'rejected',
] as const
export type StagingStatus = (typeof STAGING_STATUSES)[number]

export const EVENT_CLASSES = [
  'new_company',
  'new_contact',
  'meeting',
  'interaction',
  'update',
  'unknown',
] as const
export type EventClass = (typeof EVENT_CLASSES)[number]

export const STAGING_SOURCES = ['manual', 'agent', 'import', 'email'] as const

// ── Ingest (POST /staging/events) ─────────────────────────────────────────────
// raw_payload is whatever the caller saw; extracted/proposed_links/class/confidence
// are optional hints — classification (rules.ts) can also (re)compute them.
export const StagingIngestSchema = z.object({
  source:         z.enum(STAGING_SOURCES),
  source_ref:     z.string().min(1).nullable().optional(),
  raw_payload:    z.record(z.string(), z.unknown()),
  extracted:      z.record(z.string(), z.unknown()).nullable().optional(),
  proposed_links: z.record(z.string(), z.unknown()).nullable().optional(),
  event_class:    z.enum(EVENT_CLASSES).nullable().optional(),
  confidence:     z.number().min(0).max(1).nullable().optional(),
}).strict()

export type StagingIngest = z.infer<typeof StagingIngestSchema>

// ── Queue listing (GET /staging/events) ───────────────────────────────────────
export const StagingListQuerySchema = z.object({
  status:         z.enum(STAGING_STATUSES).optional(),
  event_class:    z.enum(EVENT_CLASSES).optional(),
  min_confidence: z.coerce.number().min(0).max(1).optional(),
  limit:          z.coerce.number().int().min(1).max(100).default(50),
  offset:         z.coerce.number().int().min(0).default(0),
}).strict()

export type StagingListQuery = z.infer<typeof StagingListQuerySchema>
