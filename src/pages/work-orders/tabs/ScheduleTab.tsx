import { formatDate } from '@/lib/utils'
import type { WorkOrder } from '@/types/database'

interface ScheduleTabProps {
  workOrder: WorkOrder
}

export function ScheduleTab({ workOrder }: ScheduleTabProps) {
  return (
    <div>
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-[var(--color-text-muted)]">Proposed Start Date</dt>
          <dd>{formatDate(workOrder.proposed_start_date)}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-muted)]">Frequency</dt>
          <dd>{workOrder.frequency_type ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-muted)]">Assigned Crew (PCA)</dt>
          <dd>{workOrder.pca ? `${workOrder.pca.first_name} ${workOrder.pca.last_name}` : '—'}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-muted)]">Tech Instructions</dt>
          <dd className="whitespace-pre-wrap">{workOrder.notes_technician ?? '—'}</dd>
        </div>
      </dl>
    </div>
  )
}
