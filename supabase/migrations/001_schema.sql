-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- TAG CATALOGS
-- ============================================================

create table tag_industries (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table tag_regions (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table tag_stages (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table tag_types (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table tag_statuses (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- ============================================================
-- COMPANIES
-- ============================================================

create table companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  -- tag links (array of ids for simplicity in v1)
  industry_ids uuid[] default '{}',
  region_ids uuid[] default '{}',
  stage_id uuid references tag_stages(id) on delete set null,
  type_id uuid references tag_types(id) on delete set null,
  status_id uuid references tag_statuses(id) on delete set null,
  -- audit
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index on companies (deleted_at);
create index on companies (name);

-- ============================================================
-- CONTACTS
-- ============================================================

create table contacts (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  role text,
  employer text,
  phone text,
  email text,
  expertise text,
  -- optional company link
  company_id uuid references companies(id) on delete set null,
  -- tags
  industry_ids uuid[] default '{}',
  region_ids uuid[] default '{}',
  -- audit
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index on contacts (deleted_at);
create index on contacts (name);
create index on contacts (company_id);

-- ============================================================
-- MEETINGS
-- ============================================================

create table meetings (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  date date not null,
  notes text,
  -- mandatory company
  company_id uuid not null references companies(id) on delete restrict,
  -- audit
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index on meetings (deleted_at);
create index on meetings (company_id);
create index on meetings (date);

-- ============================================================
-- MEETING PARTICIPANTS (many-to-many: meetings <-> contacts)
-- ============================================================

create table meeting_participants (
  id uuid primary key default uuid_generate_v4(),
  meeting_id uuid not null references meetings(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (meeting_id, contact_id)
);

create index on meeting_participants (meeting_id);
create index on meeting_participants (contact_id);

-- ============================================================
-- INTERACTION LOG
-- ============================================================

create table interaction_logs (
  id uuid primary key default uuid_generate_v4(),
  contact_id uuid not null references contacts(id) on delete cascade,
  note text not null,
  follow_up boolean not null default false,
  -- optional meeting reference
  meeting_id uuid references meetings(id) on delete set null,
  -- audit
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index on interaction_logs (contact_id);
create index on interaction_logs (follow_up) where follow_up = true;

-- ============================================================
-- USER PROFILES (role management)
-- ============================================================

create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- FEEDBACK
-- ============================================================

create table feedback (
  id uuid primary key default uuid_generate_v4(),
  description text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- AUTO-UPDATE updated_at
-- ============================================================

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger companies_updated_at before update on companies
  for each row execute function update_updated_at();

create trigger contacts_updated_at before update on contacts
  for each row execute function update_updated_at();

create trigger meetings_updated_at before update on meetings
  for each row execute function update_updated_at();

-- ============================================================
-- AUTO-CREATE USER PROFILE ON SIGNUP
-- ============================================================

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into user_profiles (id, email, role)
  values (
    new.id,
    new.email,
    case when not exists (select 1 from user_profiles) then 'admin' else 'user' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
