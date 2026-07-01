-- ============================================================
-- A5 — OAuth 2.1 authorization server (MCP "Connect" flow)
--
-- Lets a non-technical teammate add the GG Capital connector in an
-- MCP client (Claude / Cowork), log in once in the browser via the
-- existing Supabase session, and have the client hold an access token
-- it refreshes silently. This is the human-facing counterpart to the
-- PAT (`ggc_`) path in 010_api_tokens — PATs stay for server-to-server
-- (Track B) callers.
--
-- All three tables are touched only by the server (service-role, which
-- bypasses RLS), exactly like validation of `api_tokens`. RLS is enabled
-- with NO policies so anon/authenticated roles get nothing.
--
-- Public clients + PKCE (S256): no client secret is issued or stored.
-- ============================================================

-- ── Dynamic Client Registration (RFC 7591) ───────────────────────────────────
-- MCP clients self-register their redirect URIs; we mint an opaque client_id.
create table oauth_clients (
  client_id                  text primary key,        -- ggcid_… (opaque, public)
  client_name                text,
  redirect_uris              text[] not null default '{}',
  grant_types                text[] not null default '{authorization_code,refresh_token}',
  token_endpoint_auth_method text   not null default 'none',  -- public client
  created_at                 timestamptz not null default now()
);

-- ── Authorization codes (short-lived, single-use) ─────────────────────────────
-- Only the SHA-256 hash of the code is stored; the raw code lives only in the
-- 302 redirect back to the client. `code_challenge` binds the code to the PKCE
-- verifier the client proves at the token endpoint.
create table oauth_auth_codes (
  code_hash             text primary key,             -- sha256(raw code)
  client_id             text not null references oauth_clients(client_id) on delete cascade,
  user_id               uuid not null references auth.users(id) on delete cascade,
  redirect_uri          text not null,
  scopes                text[] not null default '{}',
  code_challenge        text not null,
  code_challenge_method text not null default 'S256',
  expires_at            timestamptz not null,         -- ~60s from issue
  consumed_at           timestamptz,                  -- set on first exchange (single-use)
  created_at            timestamptz not null default now()
);

create index on oauth_auth_codes (user_id);

-- ── Access + refresh tokens ───────────────────────────────────────────────────
-- Access token raw form is prefixed `ggo_`; only hashes are stored (like PATs).
create table oauth_access_tokens (
  id                 uuid primary key default uuid_generate_v4(),
  token_hash         text not null unique,            -- sha256(ggo_… access token)
  refresh_token_hash text unique,                     -- sha256(ggr_… refresh token)
  user_id            uuid not null references auth.users(id) on delete cascade,
  client_id          text not null references oauth_clients(client_id) on delete cascade,
  scopes             text[] not null default '{}',
  expires_at         timestamptz not null,            -- access-token expiry
  refresh_expires_at timestamptz,                     -- refresh-token expiry
  revoked_at         timestamptz,
  last_used_at       timestamptz,
  created_at         timestamptz not null default now()
);

create index on oauth_access_tokens (user_id);
create index on oauth_access_tokens (token_hash);
create index on oauth_access_tokens (refresh_token_hash);

-- ── RLS: server-only (service-role bypasses; no policies = deny all else) ──────
alter table oauth_clients        enable row level security;
alter table oauth_auth_codes     enable row level security;
alter table oauth_access_tokens  enable row level security;
