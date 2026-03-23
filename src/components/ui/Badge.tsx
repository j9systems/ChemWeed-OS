import { cn } from '@/lib/utils'
import type { WorkOrderStatus } from '@/types/database'
import { STATUS_COLORS, WORK_ORDER_STATUSES } from '@/lib/constants'

interface BadgeProps {
  status: WorkOrderStatus
  className?: string
}

export function Badge({ status, className }: BadgeProps) {
  const colors = STATUS_COLORS[status]
  const isDraft = status === 'draft'
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        isDraft ? 'bg-gray-100 text-gray-400' : [colors.bg, colors.text],
        className,
      )}
    >
      {WORK_ORDER_STATUSES[status]}
    </span>
  )
}
