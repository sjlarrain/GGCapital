-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Helper function: check if current user is admin
create or replace function is_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from user_profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ============================================================
-- TAG CATALOGS — all authenticated users can read/write
-- ============================================================

alter table tag_industries enable row level security;
alter table tag_regions enable row level security;
alter table tag_stages enable row level security;
alter table tag_types enable row level security;
alter table tag_statuses enable row level security;

create policy "auth read industries" on tag_industries for select to authenticated using (true);
create policy "auth write industries" on tag_industries for insert to authenticated with check (true);
create policy "auth update industries" on tag_industries for update to authenticated using (true);

create policy "auth read regions" on tag_regions for select to authenticated using (true);
create policy "auth write regions" on tag_regions for insert to authenticated with check (true);
create policy "auth update regions" on tag_regions for update to authenticated using (true);

create policy "auth read stages" on tag_stages for select to authenticated using (true);
create policy "auth write stages" on tag_stages for insert to authenticated with check (true);
create policy "auth update stages" on tag_stages for update to authenticated using (true);

create policy "auth read types" on tag_types for select to authenticated using (true);
create policy "auth write types" on tag_types for insert to authenticated with check (true);
create policy "auth update types" on tag_types for update to authenticated using (true);

create policy "auth read statuses" on tag_statuses for select to authenticated using (true);
create policy "auth write statuses" on tag_statuses for insert to authenticated with check (true);
create policy "auth update statuses" on tag_statuses for update to authenticated using (true);

-- ============================================================
-- COMPANIES — all authenticated users read/write
-- ============================================================

alter table companies enable row level security;

create policy "auth read companies" on companies for select to authenticated using (true);
create policy "auth insert companies" on companies for insert to authenticated with check (auth.uid() = created_by);
create policy "auth update companies" on companies for update to authenticated using (true) with check (auth.uid() = updated_by);
create policy "auth delete companies" on companies for delete to authenticated using (is_admin());

-- ============================================================
-- CONTACTS — all authenticated users read/write
-- ============================================================

alter table contacts enable row level security;

create policy "auth read contacts" on contacts for select to authenticated using (true);
create policy "auth insert contacts" on contacts for insert to authenticated with check (auth.uid() = created_by);
create policy "auth update contacts" on contacts for update to authenticated using (true) with check (auth.uid() = updated_by);
create policy "auth delete contacts" on contacts for delete to authenticated using (is_admin());

-- ============================================================
-- MEETINGS — all authenticated users read/write
-- ============================================================

alter table meetings enable row level security;

create policy "auth read meetings" on meetings for select to authenticated using (true);
create policy "auth insert meetings" on meetings for insert to authenticated with check (auth.uid() = created_by);
create policy "auth update meetings" on meetings for update to authenticated using (true) with check (auth.uid() = updated_by);
create policy "auth delete meetings" on meetings for delete to authenticated using (is_admin());

-- ============================================================
-- MEETING PARTICIPANTS
-- ============================================================

alter table meeting_participants enable row level security;

create policy "auth read participants" on meeting_participants for select to authenticated using (true);
create policy "auth write participants" on meeting_participants for insert to authenticated with check (true);
create policy "auth delete participants" on meeting_participants for delete to authenticated using (true);

-- ============================================================
-- INTERACTION LOGS
-- ============================================================

alter table interaction_logs enable row level security;

create policy "auth read logs" on interaction_logs for select to authenticated using (true);
create policy "auth write logs" on interaction_logs for insert to authenticated with check (auth.uid() = created_by);

-- ============================================================
-- USER PROFILES
-- ============================================================

alter table user_profiles enable row level security;

create policy "users read own profile" on user_profiles for select to authenticated using (id = auth.uid() or is_admin());
create policy "admin read all profiles" on user_profiles for select to authenticated using (is_admin());

-- ============================================================
-- FEEDBACK — all can submit, only admin can read
-- ============================================================

alter table feedback enable row level security;

create policy "auth submit feedback" on feedback for insert to authenticated with check (auth.uid() = created_by);
create policy "admin read feedback" on feedback for select to authenticated using (is_admin());
