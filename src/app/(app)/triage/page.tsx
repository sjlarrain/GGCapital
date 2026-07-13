import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getStagingEvents } from '@/lib/actions/staging'
import TriageTable from './TriageTable'

export const dynamic = 'force-dynamic'

export default async function TriagePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const events = await getStagingEvents()
  return <TriageTable events={events as Parameters<typeof TriageTable>[0]['events']} />
}
