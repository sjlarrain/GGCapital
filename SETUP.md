# GG Capital CRM — Setup Guide

## Prerequisites
- Node.js 20+
- A [Supabase](https://supabase.com) project (free tier is fine)

## 1. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials:

```bash
cp .env.local.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # needed for admin invite
```

Find these in your Supabase project → Settings → API.

## 2. Database Setup

Run migrations in order in the Supabase SQL Editor:

1. `supabase/migrations/001_schema.sql` — all tables, triggers, functions
2. `supabase/migrations/002_rls.sql` — Row Level Security policies
3. `supabase/migrations/003_seed_tags.sql` — tag catalogs (industries, regions, stages, types, statuses)

## 3. First Admin User

The first user to sign up automatically gets the `admin` role (enforced by the `handle_new_user` trigger in `001_schema.sql`).

Create your admin account:
- Go to Supabase → Authentication → Users → Invite user (or use the app's login once you have credentials)
- Sign in at `/login`

## 4. Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 5. Run Tests

```bash
npm test
```

Integration tests (schema constraints, RLS) require `NEXT_PUBLIC_SUPABASE_*` env vars and are skipped when absent.

## 6. Deploy to Vercel

1. Push this directory to a GitHub repo
2. Import in Vercel → add the three env vars
3. Deploy

## Data Population

Per the project plan:
- **Tag catalogs** are seeded upfront (step 3 above)
- **Companies, contacts, meetings** are populated via the app UI — no bulk import before testing
- Full data import is a later phase (Epic 9 in the backlog)
