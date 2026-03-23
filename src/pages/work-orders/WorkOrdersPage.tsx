import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Plus, Calendar, User } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useWorkOrders } from '@/hooks/useWorkOrders'
import { canEdit } from '@/lib/roles'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Badge } from '@/components/ui/Badge'
import { WORK_ORDER_STATUSES, getServiceColor } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import type { WorkOrder, WorkOrderStatus } from '@/types/database'

/* ------------------------------------------------------------------ */
/*  Mobile list item                                                   */
/* ------------------------------------------------------------------ */
function MobileRow({ wo }: { wo: WorkOrder }) {
  const navigate = useNavigate()
  const sc = getServiceColor(wo.service_type?.name)
  const tech = wo.pca ? `${wo.pca.first_name} ${wo.pca.last_name}` : null

  return (
    <button
      type="button"
      onClick={() => navigate(`/work-orders/${wo.id}`)}
      className="w-full text-left px-4 py-3 border-b border-surface-border last:border-0 hover:bg-surface transition-colors"
      style={{ borderLeft: `4px solid ${sc.border}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-sm truncate">{wo.client?.name ?? 'Unknown Client'}</p>
        <Badge
          status={wo.status}
          className={`shrink-0 ${wo.status === 'draft' ? 'opacity-50' : ''}`}
        />
      </div>

      <p className="text-xs text-[var(--color-text-muted)] truncate mt-0.5">
        {wo.site?.address_line ?? 'No address'}
      </p>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
        {wo.service_type?.name && (
          <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${sc.bg} ${sc.text}`}>
            {wo.service_type.name}
          </span>
        )}

        <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
          <User size={11} />
          {tech ?? <em>Unassigned</em>}
        </span>

        <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
          <Calendar size={11} />
          {formatDate(wo.proposed_start_date)}
        </span>
      </div>
    </button>
  )
}

/* ------------------------------------------------------------------ */
/*  Desktop table row                                                  */
/* ------------------------------------------------------------------ */
function TableRow({ wo }: { wo: WorkOrder }) {
  const navigate = useNavigate()
  const sc = getServiceColor(wo.service_type?.name)
  const tech = wo.pca ? `${wo.pca.first_name} ${wo.pca.last_name}` : null

  return (
    <tr
      onClick={() => navigate(`/work-orders/${wo.id}`)}
      className="border-b border-surface-border last:border-0 hover:bg-surface transition-colors cursor-pointer"
    >
      {/* Service color indicator */}
      <td className="py-3 pl-4 pr-2">
        <span
          className="block w-1 h-6 rounded-full"
          style={{ backgroundColor: sc.border }}
        />
      </td>

      {/* Client */}
      <td className="py-3 pr-4">
        <span className="font-medium text-sm">
          {wo.client?.name ?? 'Unknown Client'}
        </span>
        <p className="text-xs text-[var(--color-text-muted)] truncate max-w-[220px]">
          {wo.site?.address_line ?? 'No address'}
        </p>
      </td>

      {/* Service type */}
      <td className="py-3 pr-4">
        {wo.service_type?.name ? (
          <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${sc.bg} ${sc.text}`}>
            {wo.service_type.name}
          </span>
        ) : (
          <span className="text-xs text-[var(--color-text-muted)]">—</span>
        )}
      </td>

      {/* Assigned tech */}
      <td className="py-3 pr-4 text-sm">
        {tech ?? <span className="text-[var(--color-text-muted)] italic text-xs">Unassigned</span>}
      </td>

      {/* Due date */}
      <td className="py-3 pr-4 text-sm text-[var(--color-text-muted)] whitespace-nowrap">
        {formatDate(wo.proposed_start_date)}
      </td>

      {/* Status */}
      <td className="py-3 pr-4">
        <Badge
          status={wo.status}
          className={wo.status === 'draft' ? 'opacity-50' : undefined}
        />
      </td>
    </tr>
  )
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
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

      {!isLoading && !error && workOrders.length === 0 && (
        <p className="py-8 text-center text-[var(--color-text-muted)]">
          No work orders found.
        </p>
      )}

      {!isLoading && !error && workOrders.length > 0 && (
        <div className="rounded-[20px] bg-surface-raised shadow-card overflow-hidden">
          {/* Desktop table */}
          <table className="w-full text-sm hidden md:table">
            <thead>
              <tr className="border-b border-surface-border text-left text-xs text-[var(--color-text-muted)]">
                <th className="py-3 pl-4 pr-2 w-6" />
                <th className="py-3 pr-4 font-medium">Client / Site</th>
                <th className="py-3 pr-4 font-medium">Service</th>
                <th className="py-3 pr-4 font-medium">Technician</th>
                <th className="py-3 pr-4 font-medium">Due Date</th>
                <th className="py-3 pr-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {workOrders.map((wo) => (
                <TableRow key={wo.id} wo={wo} />
              ))}
            </tbody>
          </table>

          {/* Mobile compact list */}
          <div className="md:hidden divide-y divide-surface-border">
            {workOrders.map((wo) => (
              <MobileRow key={wo.id} wo={wo} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
