export type Role = 'admin' | 'user'

export interface UserProfile {
  id: string
  email: string
  role: Role
  created_at: string
}

// ── Tag Catalogs ──────────────────────────────────────────
export interface TagItem {
  id: string
  name: string
  created_at: string
}

export interface TagCatalogs {
  industries: TagItem[]
  regions: TagItem[]
  stages: TagItem[]
  types: TagItem[]
  statuses: TagItem[]
  meetingTypes: TagItem[]
}

// ── Companies ─────────────────────────────────────────────
export interface Company {
  id: string
  name: string
  description: string | null
  source: 'Direct' | 'Fund' | null
  industry_ids: string[]
  region_ids: string[]
  stage_ids: string[]
  type_id: string | null
  status_id: string | null
  // Manager → fund hierarchy (migration 006). Optional: DB-nullable / defaulted,
  // and not yet managed by the create/edit forms.
  parent_company_id?: string | null
  // Structured fields promoted out of `description` (migration 006)
  website?: string | null
  round_size_musd?: number | null
  valuation_musd?: number | null
  legal?: string | null
  deal_date?: string | null
  files?: string[]
  // Stages a fund invests in (rolled up from its contacts). Distinct from
  // `stage_ids`, which is a portfolio company's current round (migration 006).
  investment_stage_ids?: string[]
  created_by: string
  updated_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type CompanyInsert = Omit<Company, 'id' | 'created_at' | 'updated_at'>
export type CompanyUpdate = Partial<Omit<Company, 'id' | 'created_at' | 'created_by'>> & { updated_by: string }

// ── Contacts ──────────────────────────────────────────────
export interface Contact {
  id: string
  name: string
  role: string | null
  employer: string | null
  phone: string | null
  email: string | null
  expertise: string | null
  company_id: string | null
  industry_ids: string[]
  region_ids: string[]
  investment_focus: string[]
  // Migration 006. Optional: DB-nullable / defaulted, not yet managed by the forms.
  linkedin?: string | null
  location?: string | null
  stage_ids?: string[]
  created_by: string
  updated_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type ContactInsert = Omit<Contact, 'id' | 'created_at' | 'updated_at'>
export type ContactUpdate = Partial<Omit<Contact, 'id' | 'created_at' | 'created_by'>> & { updated_by: string }

// ── Meetings ──────────────────────────────────────────────
export interface Meeting {
  id: string
  title: string
  date: string
  notes: string | null
  company_id: string | null
  type_id: string | null
  created_by: string
  updated_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type MeetingInsert = Omit<Meeting, 'id' | 'created_at' | 'updated_at'>
export type MeetingUpdate = Partial<Omit<Meeting, 'id' | 'created_at' | 'created_by'>> & { updated_by: string }

// ── Meeting Participants ───────────────────────────────────
export interface MeetingParticipant {
  id: string
  meeting_id: string
  contact_id: string
  created_at: string
}

// ── Interaction Log ───────────────────────────────────────
export interface InteractionLog {
  id: string
  contact_id: string
  note: string
  follow_up: boolean
  meeting_id: string | null
  created_by: string
  created_at: string
}

export type InteractionLogInsert = Omit<InteractionLog, 'id' | 'created_at'>

// ── Feedback ──────────────────────────────────────────────
export interface Feedback {
  id: string
  description: string
  created_by: string
  created_at: string
}

// ── Rich / Joined Views ───────────────────────────────────
export interface CompanyWithTags extends Company {
  industries: TagItem[]
  regions: TagItem[]
  stages: TagItem[]
  type: TagItem | null
  status: TagItem | null
}

export interface ContactWithCompany extends Contact {
  company: Pick<Company, 'id' | 'name'> | null
}

export interface MeetingWithCompany extends Meeting {
  company: Pick<Company, 'id' | 'name'> | null
  meetingType: Pick<TagItem, 'id' | 'name'> | null
  participants: ContactWithCompany[]
}

export interface ContactTimeline {
  type: 'meeting' | 'log'
  date: string
  meeting?: MeetingWithCompany
  log?: InteractionLog
}
