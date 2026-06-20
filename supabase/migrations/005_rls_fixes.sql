-- ============================================================
-- 005 — RLS fixes
-- ============================================================

-- Redefine handle_new_user with explicit schema and search_path so it
-- can find public.user_profiles when fired from auth.users context
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, email, role)
  values (
    new.id,
    new.email,
    case when not exists (select 1 from public.user_profiles) then 'admin' else 'user' end
  );
  return new;
end;
$$;

-- user_profiles was missing an INSERT policy
create policy "service insert profiles" on user_profiles
  for insert with check (true);

-- tag_meeting_types was added in 004 without RLS policies
alter table tag_meeting_types enable row level security;

create policy "auth read meeting types" on tag_meeting_types for select to authenticated using (true);
create policy "auth write meeting types" on tag_meeting_types for insert to authenticated with check (true);
create policy "auth update meeting types" on tag_meeting_types for update to authenticated using (true);
