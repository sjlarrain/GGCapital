import { notFound } from 'next/navigation'
import { getStagingEvent, getStagingEventLog } from '@/lib/actions/staging'
import TriageDetail from './TriageDetail'

export const dynamic = 'force-dynamic'

export default async function TriageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
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
    />
  )
}
