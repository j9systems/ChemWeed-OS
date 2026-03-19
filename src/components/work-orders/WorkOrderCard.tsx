import { Link } from 'react-router'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'
import type { WorkOrder } from '@/types/database'

interface WorkOrderCardProps {
  workOrder: WorkOrder
}

export function WorkOrderCard({ workOrder }: WorkOrderCardProps) {
  return (
    <Link to={`/work-orders/${workOrder.id}`}>
      <Card className="hover:border-brand-green/30 transition-colors">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="font-medium">{workOrder.client?.name ?? 'Unknown Client'}</p>
            <p className="text-sm text-[var(--color-text-muted)]">{workOrder.site?.address_line ?? 'No address'}</p>
            <p className="text-sm text-[var(--color-text-muted)]">{workOrder.service_type?.name}</p>
          </div>
          <Badge status={workOrder.status} />
        </div>
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
          {formatDate(workOrder.proposed_start_date)}
        </p>
      </Card>
    </Link>
  )
}
