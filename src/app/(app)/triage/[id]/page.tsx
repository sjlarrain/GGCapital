import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getStagingEvent, getStagingEventLog } from '@/lib/actions/staging'
import TriageDetail from './TriageDetail'

export const dynamic = 'force-dynamic'

export default async function TriageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'

  const { id } = await params

  let event, log
  try {
    [event, log] = await Promise.all([getStagingEvent(id), getStagingEventLog(id)])
  } catch {
    notFound()
  }
  if (!event) notFound()

  return (
    <TriageDetail
      event={event as Parameters<typeof TriageDetail>[0]['event']}
      log={(log ?? []) as Parameters<typeof TriageDetail>[0]['log']}
      isAdmin={isAdmin}
    />
  )
}
