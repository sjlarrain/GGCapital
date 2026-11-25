import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMcpActivity } from '@/lib/actions/mcpActivity'
import McpActivityTable from './McpActivityTable'

export const dynamic = 'force-dynamic'

export default async function McpActivityPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const rows = await getMcpActivity()
  return <McpActivityTable rows={rows as Parameters<typeof McpActivityTable>[0]['rows']} />
}
