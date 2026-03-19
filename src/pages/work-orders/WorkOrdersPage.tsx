import { useState } from 'react'
import { Link } from 'react-router'
import { Plus } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useWorkOrders } from '@/hooks/useWorkOrders'
import { canEdit } from '@/lib/roles'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { WorkOrderCard } from '@/components/work-orders/WorkOrderCard'
import { WORK_ORDER_STATUSES } from '@/lib/constants'
import type { WorkOrderStatus } from '@/types/database'

export function WorkOrdersPage() {
  const { role } = useAuth()
  const [statusFilter, setStatusFilter] = useState<WorkOrderStatus | ''>('')
  const { workOrders, isLoading, error, refetch } = useWorkOrders(
    statusFilter ? { status: statusFilter } : undefined
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Work Orders</h1>
        {canEdit(role) && (
          <Link to="/work-orders/new">
            <Button size="md">
              <Plus size={18} />
              New Work Order
            </Button>
          </Link>
        )}
      </div>

      <div className="mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as WorkOrderStatus | '')}
          className="rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm min-h-[44px]"
        >
          <option value="">All Statuses</option>
          {(Object.entries(WORK_ORDER_STATUSES) as [WorkOrderStatus, string][]).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {isLoading && <LoadingSpinner />}
      {error && <ErrorMessage message={error} onRetry={refetch} />}
      {!isLoading && !error && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {workOrders.map((wo) => (
            <WorkOrderCard key={wo.id} workOrder={wo} />
          ))}
          {workOrders.length === 0 && (
            <p className="col-span-full py-8 text-center text-[var(--color-text-muted)]">
              No work orders found.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
