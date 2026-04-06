import { useNavigate } from 'react-router'
import { X, MapPin, Clock, Check, Undo2 } from 'lucide-react'
import { getServiceColor, WO_STATUS_COLORS, WORK_ORDER_STATUSES } from '@/lib/constants'
import type { WorkOrder, WorkOrderStatus } from '@/types/database'

// Deterministic color palette for assignees on the map
const ASSIGNEE_COLORS = [
  '#2563eb', '#dc2626', '#059669', '#d97706', '#7c3aed',
  '#db2777', '#0891b2', '#4f46e5', '#ca8a04', '#0d9488',
]

export function getAssigneeColorMap(workOrders: WorkOrder[]): Map<string, string> {
  const map = new Map<string, string>()
  let idx = 0
  for (const wo of workOrders) {
    if (wo.pca_id && !map.has(wo.pca_id)) {
      map.set(wo.pca_id, ASSIGNEE_COLORS[idx % ASSIGNEE_COLORS.length]!)
      idx++
    }
  }
  return map
}

/** Shared job card list used by both the desktop detail panel and mobile combined panel. */
export function DayJobList({
  workOrders,
  assigneeColorMap,
  onConfirmSchedule,
  onUnschedule,
}: {
  workOrders: WorkOrder[]
  assigneeColorMap: Map<string, string>
  onConfirmSchedule?: (woId: string) => void
  onUnschedule?: (woId: string) => void
}) {
  const navigate = useNavigate()

  if (workOrders.length === 0) {
    return <p className="text-sm text-[var(--color-text-muted)] text-center py-8">No jobs scheduled for this day.</p>
  }

  return (
    <>
      {workOrders.map(wo => {
        const sc = getServiceColor(wo.service_type?.name)
        const statusColors = WO_STATUS_COLORS[wo.status as WorkOrderStatus] ?? WO_STATUS_COLORS.unscheduled
        const assigneeColor = wo.pca_id ? assigneeColorMap.get(wo.pca_id) ?? '#6b7280' : '#6b7280'
        const assigneeName = wo.pca
          ? `${wo.pca.first_name} ${wo.pca.last_name}`
          : 'Unassigned'
        const address = wo.site
          ? [wo.site.address_line, wo.site.city].filter(Boolean).join(', ')
          : '—'

        return (
          <div
            key={wo.id}
            onClick={() => navigate(`/work-orders/${wo.id}`)}
            className="rounded-lg border border-surface-border bg-white hover:shadow-md transition-shadow cursor-pointer p-3"
            style={{ borderLeft: `4px solid ${sc.border}` }}
          >
            {/* Client & service */}
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <p className="text-sm font-semibold truncate">{wo.client?.name ?? 'Client'}</p>
              {wo.service_type?.name && (
                <span className={`shrink-0 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${sc.bg} ${sc.text}`}>
                  {wo.service_type.name}
                </span>
              )}
            </div>

            {/* Address */}
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] mb-1.5">
              <MapPin size={12} className="shrink-0" />
              <span className="truncate">{address}</span>
            </div>

            {/* Status & assignee */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColors.bg} ${statusColors.text}`}>
                {WORK_ORDER_STATUSES[wo.status as WorkOrderStatus] ?? wo.status}
              </span>

              <div className="flex items-center gap-1 text-xs">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: assigneeColor }}
                />
                <span className="text-[var(--color-text-muted)]">{assigneeName}</span>
              </div>

              {wo.scheduled_time && (
                <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                  <Clock size={10} />
                  <span>{wo.scheduled_time}</span>
                </div>
              )}
            </div>

            {/* Confirm button for tentative work orders */}
            {wo.status === 'tentative' && onConfirmSchedule && (
              <button
                onClick={(e) => { e.stopPropagation(); onConfirmSchedule(wo.id) }}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 text-white px-3 py-1.5 text-xs font-medium hover:bg-emerald-600 transition-colors"
              >
                <Check size={14} />
                Confirm Schedule
              </button>
            )}

            {/* Unschedule button for jobs on or before today */}
            {(wo.status === 'tentative' || wo.status === 'scheduled') && wo.scheduled_date && wo.scheduled_date! <= new Date().toISOString().split('T')[0] && onUnschedule && (
              <button
                onClick={(e) => { e.stopPropagation(); onUnschedule(wo.id) }}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-gray-100 text-gray-700 px-3 py-1.5 text-xs font-medium hover:bg-gray-200 transition-colors"
              >
                <Undo2 size={14} />
                Unschedule
              </button>
            )}
          </div>
        )
      })}
    </>
  )
}

interface DayDetailPanelProps {
  dateStr: string
  workOrders: WorkOrder[]
  open: boolean
  onClose: () => void
  assigneeColorMap: Map<string, string>
  onConfirmSchedule?: (woId: string) => void
  onUnschedule?: (woId: string) => void
}

/** Desktop-only right slide panel showing scheduled jobs for a day. Hidden on mobile. */
export function DayDetailPanel({ dateStr, workOrders, open, onClose, assigneeColorMap, onConfirmSchedule, onUnschedule }: DayDetailPanelProps) {
  const dateLabel = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div
      className={`hidden sm:flex fixed top-0 right-0 h-full w-[420px] bg-white shadow-2xl z-50 flex-col transition-transform duration-300 ease-in-out ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border bg-surface">
        <div>
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{dateLabel}</h3>
          <p className="text-xs text-[var(--color-text-muted)]">{workOrders.length} job{workOrders.length !== 1 ? 's' : ''} scheduled</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-2 hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <X size={20} />
        </button>
      </div>

      {/* Work order list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <DayJobList workOrders={workOrders} assigneeColorMap={assigneeColorMap} onConfirmSchedule={onConfirmSchedule} onUnschedule={onUnschedule} />
      </div>
    </div>
  )
}
