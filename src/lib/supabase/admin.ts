import { createClient } from '@supabase/supabase-js'

// Service-role client: bypasses RLS, server-side only.
// NEVER import this in client components or expose SUPABASE_SERVICE_ROLE_KEY.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)
