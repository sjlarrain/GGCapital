-- ============================================================
-- GENERALIZE interaction_logs
-- Was contact-only; now polymorphic across contacts and companies
-- (funds are companies), and carries file/link attachments.
-- ============================================================

alter table interaction_logs
  add column entity_type text not null default 'contact' check (entity_type in ('contact', 'company')),
  add column entity_id uuid,
  add column file_urls text[] not null default '{}',
  add column links text[] not null default '{}';

update interaction_logs set entity_id = contact_id;

alter table interaction_logs alter column entity_id set not null;
alter table interaction_logs drop column contact_id;

create index on interaction_logs (entity_type, entity_id);

-- ============================================================
-- STORAGE: interaction-files bucket
-- Backs file attachments on interaction log entries. Public bucket
-- so stored getPublicUrl() links resolve; writes limited to
-- authenticated users. Same pattern as 008_company_files_bucket.sql.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('interaction-files', 'interaction-files', true)
on conflict (id) do update set public = true;

drop policy if exists "interaction-files public read" on storage.objects;
drop policy if exists "interaction-files auth insert"  on storage.objects;
drop policy if exists "interaction-files auth update"  on storage.objects;
drop policy if exists "interaction-files auth delete"  on storage.objects;

create policy "interaction-files public read"
on storage.objects for select
using (bucket_id = 'interaction-files');

create policy "interaction-files auth insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'interaction-files');

create policy "interaction-files auth update"
on storage.objects for update to authenticated
using (bucket_id = 'interaction-files')
with check (bucket_id = 'interaction-files');

create policy "interaction-files auth delete"
on storage.objects for delete to authenticated
using (bucket_id = 'interaction-files');
