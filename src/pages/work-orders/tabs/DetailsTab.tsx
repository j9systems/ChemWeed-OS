import { formatDate } from '@/lib/utils'
import { WORK_ORDER_STATUSES, getUrgencyColors } from '@/lib/constants'
import type { WorkOrder } from '@/types/database'

interface DetailsTabProps {
  workOrder: WorkOrder
}

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-[140px]">
      <dt className="text-xs text-[var(--color-text-muted)]">{label}</dt>
      <dd className="text-sm mt-0.5">{children}</dd>
    </div>
  )
}

export function DetailsTab({ workOrder }: DetailsTabProps) {
  return (
    <div>
      <h2 className="text-sm font-semibold mb-3">Details</h2>
      <dl className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
        <DetailItem label="Client">{workOrder.client?.name ?? '—'}</DetailItem>
        <DetailItem label="Site">{workOrder.site?.name ?? '—'}</DetailItem>
        <DetailItem label="Status">{WORK_ORDER_STATUSES[workOrder.status]}</DetailItem>
        <DetailItem label="Urgency">
          {workOrder.urgency_level ? (
            <span className={`inline-block rounded-full px-3 py-0.5 text-xs font-medium border ${
              (() => {
                const c = getUrgencyColors(workOrder.urgency_level.key)
                return `${c.selectedBg} ${c.selectedText} ${c.selectedBorder}`
              })()
            }`}>
              {workOrder.urgency_level.label}
            </span>
          ) : '—'}
        </DetailItem>
        <DetailItem label="Service Type">{workOrder.service_type?.name ?? '—'}</DetailItem>
        <DetailItem label="Frequency">{workOrder.frequency_type ?? '—'}</DetailItem>
        <DetailItem label="Proposed Start">{formatDate(workOrder.proposed_start_date)}</DetailItem>
        {workOrder.completion_date && (
          <DetailItem label="Completed">{formatDate(workOrder.completion_date)}</DetailItem>
        )}
        <DetailItem label="PCA">
          {workOrder.pca ? `${workOrder.pca.first_name} ${workOrder.pca.last_name}` : '—'}
        </DetailItem>
        <DetailItem label="PO Number">{workOrder.po_number ?? '—'}</DetailItem>
        <div className="w-full">
          <DetailItem label="Reason / Scope">
            <span className="whitespace-pre-wrap">{workOrder.reason ?? '—'}</span>
          </DetailItem>
        </div>
      </dl>
    </div>
  )
}
