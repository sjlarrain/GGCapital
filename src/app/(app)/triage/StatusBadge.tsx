import type { StagingStatus } from '@/lib/schemas/staging'

const STATUS_CLASS: Record<StagingStatus, string> = {
  pending:    'is-light',
  classified: 'is-info is-light',
  needs_info: 'is-warning',
  ready:      'is-success',
  promoted:   'is-link is-light',
  rejected:   'is-danger is-light',
}

const STATUS_LABEL: Record<StagingStatus, string> = {
  pending:    'Pending',
  classified: 'Classified',
  needs_info: 'Needs info',
  ready:      'Ready',
  promoted:   'Promoted',
  rejected:   'Rejected',
}

export default function StatusBadge({ status }: { status: StagingStatus }) {
  return <span className={`tag ${STATUS_CLASS[status] ?? 'is-light'}`}>{STATUS_LABEL[status] ?? status}</span>
}
