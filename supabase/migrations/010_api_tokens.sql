-- API token table for user-managed Personal Access Tokens (PATs)
create table api_tokens (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,                  -- e.g. "Cowork – read/write"
  token_hash   text not null unique,           -- sha256(raw); raw (prefix ggc_) shown ONCE
  scopes       text[] not null default '{}',   -- crm:read crm:write staging:read staging:write staging:promote
  last_used_at timestamptz,
  expires_at   timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index on api_tokens (user_id);
create index on api_tokens (token_hash);

alter table api_tokens enable row level security;

create policy "owner reads tokens"   on api_tokens for select   to authenticated using  (user_id = auth.uid() or is_admin());
create policy "owner writes tokens"  on api_tokens for insert   to authenticated with check (user_id = auth.uid());
create policy "owner revokes tokens" on api_tokens for update   to authenticated using  (user_id = auth.uid() or is_admin());
