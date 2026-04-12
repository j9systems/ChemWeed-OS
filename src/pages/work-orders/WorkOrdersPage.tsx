import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { useWorkOrders, useMyWorkOrders } from '@/hooks/useWorkOrders'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Badge } from '@/components/ui/Badge'
import { WorkOrderCard } from '@/components/work-orders/WorkOrderCard'
import { WORK_ORDER_STATUSES, getServiceColor, formatPeriodLabel } from '@/lib/constants'
import { formatDate, todayPacific } from '@/lib/utils'
import type { WorkOrder, WorkOrderStatus } from '@/types/database'

function DaysSincePill({ days }: { days: number | null }) {
  if (days == null) {
    return <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500">—</span>
  }
  let classes = 'bg-gray-100 text-gray-600'
  if (days > 45) classes = 'bg-red-100 text-red-700'
  else if (days >= 20) classes = 'bg-amber-100 text-amber-700'

  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}>
      {days}d ago
    </span>
  )
}

function WOTableRow({ wo }: { wo: WorkOrder }) {
  const navigate = useNavigate()
  const sc = getServiceColor(wo.service_type?.name)

  return (
    <tr
      onClick={() => navigate(`/work-orders/${wo.id}`)}
      className="border-b border-surface-border last:border-0 hover:bg-surface transition-colors cursor-pointer"
    >
      <td className="py-3 pl-4 pr-2">
        <span className="block w-1 h-6 rounded-full" style={{ backgroundColor: sc.border }} />
      </td>
      <td className="py-3 pr-4">
        <span className="font-medium text-sm">{wo.client?.name ?? 'Unknown'}</span>
        <p className="text-xs text-[var(--color-text-muted)] truncate max-w-[220px]">{wo.site?.name ?? ''}</p>
      </td>
      <td className="py-3 pr-4">
        {wo.service_type?.name ? (
          <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${sc.bg} ${sc.text}`}>
            {wo.service_type.name}
          </span>
        ) : <span className="text-xs text-[var(--color-text-muted)]">—</span>}
      </td>
      <td className="py-3 pr-4 text-sm text-[var(--color-text-muted)] whitespace-nowrap">
        {formatPeriodLabel(wo)}
      </td>
      <td className="py-3 pr-4 text-sm text-[var(--color-text-muted)] whitespace-nowrap">
        {formatDate(wo.scheduled_date)}
      </td>
      <td className="py-3 pr-4">
        <DaysSincePill days={wo.days_since_last_service} />
      </td>
      <td className="py-3 pr-4">
        <Badge status={wo.status} />
      </td>
    </tr>
  )
}

function TechnicianView() {
  const { teamMember } = useAuth()
  const { workOrders, isLoading, error, refetch } = useMyWorkOrders(teamMember?.id)

  const todayStr = todayPacific()

  const sections = useMemo(() => {
    const today: WorkOrder[] = []
    const upcoming: WorkOrder[] = []
    const completed: WorkOrder[] = []

    const fourteenDaysLater = new Date()
    fourteenDaysLater.setDate(fourteenDaysLater.getDate() + 14)
    const fourteenDaysStr = fourteenDaysLater.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const thirtyDaysStr = thirtyDaysAgo.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })

    for (const wo of workOrders) {
      if (
        (wo.status === 'scheduled' || wo.status === 'in_progress') &&
        wo.scheduled_date === todayStr
      ) {
        today.push(wo)
      } else if (
        wo.status === 'scheduled' &&
        wo.scheduled_date &&
        wo.scheduled_date > todayStr &&
        wo.scheduled_date <= fourteenDaysStr
      ) {
        upcoming.push(wo)
      } else if (
        wo.status === 'completed' &&
        wo.completion_date &&
        wo.completion_date >= thirtyDaysStr
      ) {
        completed.push(wo)
      }
    }

    // Sort completed most recent first
    completed.sort((a, b) => (b.completion_date ?? '').localeCompare(a.completion_date ?? ''))

    return { today, upcoming, completed }
  }, [workOrders, todayStr])

  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorMessage message={error} onRetry={refetch} />

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">My Jobs</h1>

      {/* Today */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">
          Today
          {sections.today.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-medium">
              {sections.today.length}
            </span>
          )}
        </h2>
        {sections.today.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] py-4">No jobs scheduled for today.</p>
        ) : (
          <div className="rounded-[20px] bg-surface-raised shadow-card overflow-hidden">
            {sections.today.map((wo) => (
              <WorkOrderCard key={wo.id} wo={wo} variant="tech" />
            ))}
          </div>
        )}
      </div>

      {/* Upcoming */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">
          Upcoming
          {sections.upcoming.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-xs font-medium">
              {sections.upcoming.length}
            </span>
          )}
        </h2>
        {sections.upcoming.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] py-4">No upcoming jobs in the next 14 days.</p>
        ) : (
          <div className="rounded-[20px] bg-surface-raised shadow-card overflow-hidden">
            {sections.upcoming.map((wo) => (
              <WorkOrderCard key={wo.id} wo={wo} variant="tech" />
            ))}
          </div>
        )}
      </div>

      {/* Completed */}
      {sections.completed.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Completed</h2>
          <div className="rounded-[20px] bg-surface-raised shadow-card overflow-hidden">
            {sections.completed.map((wo) => (
              <WorkOrderCard key={wo.id} wo={wo} variant="tech" />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function WorkOrdersPage() {
  const { role } = useAuth()

  // Technicians get their own view
  if (role === 'technician') {
    return <TechnicianView />
  }

  return <AdminView />
}

function AdminView() {
  const [statusFilter, setStatusFilter] = useState<WorkOrderStatus | ''>('')
  const { workOrders, isLoading, error, refetch } = useWorkOrders(
    statusFilter ? { status: statusFilter } : undefined
  )
  // Separate query for unscheduled queue with actionability filter
  const { workOrders: actionableUnscheduled } = useWorkOrders({ status: 'unscheduled', actionableOnly: true })

  const unscheduled = actionableUnscheduled
    .sort((a, b) => {
      const da = a.days_since_last_service ?? -1
      const db = b.days_since_last_service ?? -1
      if (db !== da) return db - da
      return (a.client?.name ?? '').localeCompare(b.client?.name ?? '')
    })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Jobs</h1>
      </div>

      {/* Unscheduled Queue */}
      {!statusFilter && unscheduled.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">
            Unscheduled
            <span className="ml-2 inline-flex items-center justify-center rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-medium">
              {unscheduled.length}
            </span>
          </h2>
          <div className="rounded-[20px] bg-surface-raised shadow-card overflow-hidden">
            <div className="divide-y divide-surface-border">
              {unscheduled.map((wo) => (
                <WorkOrderCard key={wo.id} wo={wo} variant="admin" />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* All Jobs */}
      <div>
        <h2 className="text-lg font-semibold mb-3">All Jobs</h2>
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
            <table className="w-full text-sm hidden md:table">
              <thead>
                <tr className="border-b border-surface-border text-left text-xs text-[var(--color-text-muted)]">
                  <th className="py-3 pl-4 pr-2 w-6" />
                  <th className="py-3 pr-4 font-medium">Client / Site</th>
                  <th className="py-3 pr-4 font-medium">Service</th>
                  <th className="py-3 pr-4 font-medium">Period</th>
                  <th className="py-3 pr-4 font-medium">Scheduled</th>
                  <th className="py-3 pr-4 font-medium">Priority</th>
                  <th className="py-3 pr-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {workOrders.map((wo) => (
                  <WOTableRow key={wo.id} wo={wo} />
                ))}
              </tbody>
            </table>

            <div className="md:hidden divide-y divide-surface-border">
              {workOrders.map((wo) => (
                <WorkOrderCard key={wo.id} wo={wo} variant="admin" />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
