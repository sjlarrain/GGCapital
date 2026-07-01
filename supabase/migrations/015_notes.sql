-- ============================================================
-- QUICK NOTES
-- Polymorphic notes on a contact or company (funds are companies),
-- kept independent of interaction_logs (which backs the public v1
-- API) and independent of meetings.
-- ============================================================

create table notes (
  id uuid primary key default uuid_generate_v4(),
  entity_type text not null check (entity_type in ('contact', 'company')),
  entity_id uuid not null,
  body text not null,
  file_urls text[] not null default '{}',
  links text[] not null default '{}',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index on notes (entity_type, entity_id);
create index on notes (created_at);

alter table notes enable row level security;

create policy "auth read notes" on notes for select to authenticated using (true);
create policy "auth write notes" on notes for insert to authenticated with check (auth.uid() = created_by);

-- ============================================================
-- STORAGE: note-files bucket
-- Backs file attachments on Quick Notes. Public bucket so stored
-- getPublicUrl() links resolve; writes limited to authenticated users.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('note-files', 'note-files', true)
on conflict (id) do update set public = true;

drop policy if exists "note-files public read" on storage.objects;
drop policy if exists "note-files auth insert"  on storage.objects;
drop policy if exists "note-files auth update"  on storage.objects;
drop policy if exists "note-files auth delete"  on storage.objects;

create policy "note-files public read"
on storage.objects for select
using (bucket_id = 'note-files');

create policy "note-files auth insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'note-files');

create policy "note-files auth update"
on storage.objects for update to authenticated
using (bucket_id = 'note-files')
with check (bucket_id = 'note-files');

create policy "note-files auth delete"
on storage.objects for delete to authenticated
using (bucket_id = 'note-files');
