import { cn } from '@/lib/utils'
import type { AgreementStatus, WorkOrderStatus } from '@/types/database'
import { AGREEMENT_STATUS_COLORS, AGREEMENT_STATUSES, WO_STATUS_COLORS, WORK_ORDER_STATUSES } from '@/lib/constants'

interface AgreementBadgeProps {
  agreementStatus: AgreementStatus
  className?: string
}

interface WorkOrderBadgeProps {
  status: WorkOrderStatus
  className?: string
}

type BadgeProps = AgreementBadgeProps | WorkOrderBadgeProps

function isAgreementBadge(props: BadgeProps): props is AgreementBadgeProps {
  return 'agreementStatus' in props
}

export function Badge(props: BadgeProps) {
  if (isAgreementBadge(props)) {
    const { agreementStatus, className } = props
    const colors = AGREEMENT_STATUS_COLORS[agreementStatus]
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
          `${colors.bg} ${colors.text}`,
          className,
        )}
      >
        {AGREEMENT_STATUSES[agreementStatus]}
      </span>
    )
  }

  const { status, className } = props
  const colors = WO_STATUS_COLORS[status]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        `${colors.bg} ${colors.text}`,
        className,
      )}
    >
      {WORK_ORDER_STATUSES[status]}
    </span>
  )
}
