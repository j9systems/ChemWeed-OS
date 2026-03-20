import { formatDate } from '@/lib/utils'
import { WORK_ORDER_STATUSES } from '@/lib/constants'
import { Card } from '@/components/ui/Card'
import type { WorkOrder } from '@/types/database'

interface DetailsTabProps {
  workOrder: WorkOrder
}

export function DetailsTab({ workOrder }: DetailsTabProps) {
  return (
    <Card>
      <h2 className="text-sm font-semibold mb-3">Details</h2>
      <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
        <div>
          <dt className="text-[var(--color-text-muted)]">Client</dt>
          <dd>{workOrder.client?.name ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-muted)]">Site</dt>
          <dd>{workOrder.site?.name ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-muted)]">Status</dt>
          <dd>{WORK_ORDER_STATUSES[workOrder.status]}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-muted)]">Service Type</dt>
          <dd>{workOrder.service_type?.name ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-muted)]">Frequency</dt>
          <dd>{workOrder.frequency_type ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-muted)]">Proposed Start</dt>
          <dd>{formatDate(workOrder.proposed_start_date)}</dd>
        </div>
        {workOrder.completion_date && (
          <div>
            <dt className="text-[var(--color-text-muted)]">Completed</dt>
            <dd>{formatDate(workOrder.completion_date)}</dd>
          </div>
        )}
        <div>
          <dt className="text-[var(--color-text-muted)]">PCA</dt>
          <dd>{workOrder.pca ? `${workOrder.pca.first_name} ${workOrder.pca.last_name}` : '—'}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-muted)]">PO Number</dt>
          <dd>{workOrder.po_number ?? '—'}</dd>
        </div>
        <div className="col-span-2 md:col-span-3">
          <dt className="text-[var(--color-text-muted)]">Reason / Scope</dt>
          <dd className="whitespace-pre-wrap">{workOrder.reason ?? '—'}</dd>
        </div>
      </dl>
    </Card>
  )
}
