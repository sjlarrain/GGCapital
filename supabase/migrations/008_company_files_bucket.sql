-- ============================================================
-- STORAGE: company-files bucket
-- Backs the file/PDF upload on the company form. Public bucket so
-- stored getPublicUrl() links resolve; writes limited to authenticated users.
-- ============================================================

-- Create the bucket (idempotent)
insert into storage.buckets (id, name, public)
values ('company-files', 'company-files', true)
on conflict (id) do update set public = true;

-- Policies on storage.objects, scoped to this bucket.
-- Dropped first so this migration can be re-run safely.
drop policy if exists "company-files public read"       on storage.objects;
drop policy if exists "company-files auth insert"        on storage.objects;
drop policy if exists "company-files auth update"        on storage.objects;
drop policy if exists "company-files auth delete"        on storage.objects;

-- Anyone can read (public bucket).
create policy "company-files public read"
on storage.objects for select
using (bucket_id = 'company-files');

-- Authenticated users can upload.
create policy "company-files auth insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'company-files');

-- Authenticated users can overwrite (upsert) their uploads.
create policy "company-files auth update"
on storage.objects for update to authenticated
using (bucket_id = 'company-files')
with check (bucket_id = 'company-files');

-- Authenticated users can remove files.
create policy "company-files auth delete"
on storage.objects for delete to authenticated
using (bucket_id = 'company-files');
