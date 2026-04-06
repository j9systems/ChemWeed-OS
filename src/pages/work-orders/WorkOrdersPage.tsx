import { useState } from 'react'
import { useNavigate } from 'react-router'
import { RefreshCw } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useWorkOrders } from '@/hooks/useWorkOrders'
import { canEdit } from '@/lib/roles'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Badge } from '@/components/ui/Badge'
import { WORK_ORDER_STATUSES, getServiceColor, formatPeriodLabel } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
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

function WOCard({ wo }: { wo: WorkOrder }) {
  const navigate = useNavigate()
  const sc = getServiceColor(wo.service_type?.name)

  return (
    <button
      type="button"
      onClick={() => navigate(`/work-orders/${wo.id}`)}
      className="w-full text-left px-4 py-3 border-b border-surface-border last:border-0 hover:bg-surface transition-colors"
      style={{ borderLeft: `4px solid ${sc.border}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-sm truncate">{wo.client?.name ?? 'Unknown Client'}</p>
        <DaysSincePill days={wo.days_since_last_service} />
      </div>
      <p className="text-xs text-[var(--color-text-muted)] truncate mt-0.5">
        {wo.site?.name ?? 'No site'}
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
        {wo.service_type?.name && (
          <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${sc.bg} ${sc.text}`}>
            {wo.service_type.name}
          </span>
        )}
        <span className="text-xs text-[var(--color-text-muted)]">
          {formatPeriodLabel(wo)}
        </span>
      </div>
    </button>
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

export function WorkOrdersPage() {
  const { role } = useAuth()
  const [statusFilter, setStatusFilter] = useState<WorkOrderStatus | ''>('')
  const { workOrders, isLoading, error, refetch } = useWorkOrders(
    statusFilter ? { status: statusFilter } : undefined
  )
  // Separate query for unscheduled queue with actionability filter
  const { workOrders: actionableUnscheduled, refetch: refetchActionable } = useWorkOrders({ status: 'unscheduled', actionableOnly: true })
  const [generating, setGenerating] = useState(false)
  const [genMessage, setGenMessage] = useState<string | null>(null)

  const unscheduled = actionableUnscheduled
    .sort((a, b) => {
      const da = a.days_since_last_service ?? -1
      const db = b.days_since_last_service ?? -1
      if (db !== da) return db - da
      return (a.client?.name ?? '').localeCompare(b.client?.name ?? '')
    })

  async function handleGenerate() {
    setGenerating(true)
    setGenMessage(null)
    const { data, error } = await supabase.functions.invoke('generate-work-orders')
    if (error) {
      setGenMessage(`Error: ${error.message}`)
    } else {
      const count = data?.work_orders_generated ?? 0
      if (count === 0) {
        setGenMessage('All work orders are up to date.')
      } else {
        setGenMessage(`Generated ${count} new work order(s) across all active agreements.`)
      }
      refetch()
      refetchActionable()
    }
    setGenerating(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Jobs</h1>
        {canEdit(role) && (
          <Button size="md" variant="secondary" onClick={handleGenerate} disabled={generating}>
            <RefreshCw size={16} className={generating ? 'animate-spin' : ''} />
            {generating ? 'Generating...' : 'Generate Jobs'}
          </Button>
        )}
      </div>

      {genMessage && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {genMessage}
        </div>
      )}

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
                <WOCard key={wo.id} wo={wo} />
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
                <WOCard key={wo.id} wo={wo} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
