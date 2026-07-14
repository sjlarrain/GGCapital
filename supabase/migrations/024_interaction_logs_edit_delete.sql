-- ============================================================
-- 024 — Notes (interaction_logs): allow edit (anyone) and delete (owner only)
-- ============================================================

alter table interaction_logs add column updated_at timestamptz not null default now();
alter table interaction_logs add column updated_by uuid references auth.users(id);

-- Backfill existing rows so updated_at/updated_by reflect their original write.
update interaction_logs set updated_at = created_at, updated_by = created_by;

alter table interaction_logs alter column updated_by set not null;

create trigger interaction_logs_updated_at before update on interaction_logs
  for each row execute function update_updated_at();

-- Any authenticated user may edit a note (must stamp themselves as editor);
-- only the original author may delete it.
create policy "auth update logs" on interaction_logs for update to authenticated
  using (true) with check (auth.uid() = updated_by);

create policy "owner delete logs" on interaction_logs for delete to authenticated
  using (auth.uid() = created_by);
