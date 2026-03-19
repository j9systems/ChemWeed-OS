import { Link } from 'react-router'
import { Calendar } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn, formatDate } from '@/lib/utils'
import { STATUS_BORDER_COLORS } from '@/lib/constants'
import type { WorkOrder } from '@/types/database'

interface WorkOrderCardProps {
  workOrder: WorkOrder
}

export function WorkOrderCard({ workOrder }: WorkOrderCardProps) {
  const borderColor = STATUS_BORDER_COLORS[workOrder.status]

  return (
    <Link to={`/work-orders/${workOrder.id}`}>
      <Card
        className={cn(
          'border-l-4 shadow-sm hover:shadow-md transition-all',
          borderColor,
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center rounded-md bg-brand-green/10 px-2 py-0.5 text-xs font-semibold text-brand-green truncate max-w-[60%]">
            {workOrder.service_type?.name ?? 'General'}
          </span>
          <Badge status={workOrder.status} />
        </div>

        <p className="mt-2 font-medium leading-tight">
          {workOrder.client?.name ?? 'Unknown Client'}
        </p>
        <p className="mt-0.5 text-sm leading-tight text-[var(--color-text-muted)]">
          {workOrder.site?.address_line ?? 'No address'}
        </p>

        <div className="mt-2 flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
          <Calendar className="h-3 w-3" />
          <span>{formatDate(workOrder.proposed_start_date)}</span>
        </div>
      </Card>
    </Link>
  )
}
