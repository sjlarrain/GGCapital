import { getStagingEvents } from '@/lib/actions/staging'
import TriageTable from './TriageTable'

export const dynamic = 'force-dynamic'

export default async function TriagePage() {
  const events = await getStagingEvents()
  return <TriageTable events={events as Parameters<typeof TriageTable>[0]['events']} />
}
