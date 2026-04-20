import { useState } from 'react'
import { useNavigate } from 'react-router'
import { X, MapPin, Clock, Check, Undo2, Users } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { canAssignCrew } from '@/lib/roles'
import { getServiceColor, WO_STATUS_COLORS, WORK_ORDER_STATUSES } from '@/lib/constants'
import { AssignCrewModal } from '@/components/work-orders/AssignCrewModal'
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
    const crew = [...(wo.work_order_crew ?? [])].sort((a, b) =>
      a.team_member_id.localeCompare(b.team_member_id)
    )
    for (const c of crew) {
      if (c.team_member_id && !map.has(c.team_member_id)) {
        map.set(c.team_member_id, ASSIGNEE_COLORS[idx % ASSIGNEE_COLORS.length]!)
        idx++
      }
    }
  }
  return map
}

/** Shared job card list used by both the desktop detail panel and mobile combined panel. */
export function DayJobList({
  workOrders,
  assigneeColorMap: _assigneeColorMap,
  onConfirmSchedule,
  onUnschedule,
  onCrewSaved,
}: {
  workOrders: WorkOrder[]
  assigneeColorMap: Map<string, string>
  onConfirmSchedule?: (woId: string) => void
  onUnschedule?: (woId: string) => void
  onCrewSaved?: () => void
}) {
  const navigate = useNavigate()
  const { role } = useAuth()
  const [assignModalWoId, setAssignModalWoId] = useState<string | null>(null)

  if (workOrders.length === 0) {
    return <p className="text-sm text-[var(--color-text-muted)] text-center py-8">No jobs scheduled for this day.</p>
  }

  const assignWo = assignModalWoId ? workOrders.find(wo => wo.id === assignModalWoId) : null

  return (
    <>
      {workOrders.map(wo => {
        const sc = getServiceColor(wo.service_type?.name)
        const statusColors = WO_STATUS_COLORS[wo.status as WorkOrderStatus] ?? WO_STATUS_COLORS.unscheduled
        const crew = wo.work_order_crew ?? []
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

            {/* Status & crew */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColors.bg} ${statusColors.text}`}>
                {WORK_ORDER_STATUSES[wo.status as WorkOrderStatus] ?? wo.status}
              </span>

              {/* Crew initials */}
              {crew.length > 0 ? (
                <div className="flex -space-x-1">
                  {crew.slice(0, 3).map((c) => {
                    const tm = c.team_member
                    const initials = tm ? `${tm.first_name.charAt(0)}${tm.last_name.charAt(0)}` : '??'
                    return (
                      <span
                        key={c.id}
                        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 text-[9px] font-semibold text-gray-700 ring-1 ring-white"
                        title={tm ? `${tm.first_name} ${tm.last_name}` : undefined}
                      >
                        {initials}
                      </span>
                    )
                  })}
                  {crew.length > 3 && (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-[9px] font-medium text-gray-500 ring-1 ring-white">
                      +{crew.length - 3}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-[10px] italic text-[var(--color-text-muted)]">Unassigned</span>
              )}

              {wo.scheduled_time && (
                <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                  <Clock size={10} />
                  <span>{wo.scheduled_time}</span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {/* Confirm button for tentative work orders */}
              {wo.status === 'tentative' && onConfirmSchedule && (
                <button
                  onClick={(e) => { e.stopPropagation(); onConfirmSchedule(wo.id) }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 text-white px-3 py-1.5 text-xs font-medium hover:bg-emerald-600 transition-colors"
                >
                  <Check size={14} />
                  Confirm Schedule
                </button>
              )}

              {/* Unschedule button for tentative/scheduled jobs */}
              {(wo.status === 'tentative' || wo.status === 'scheduled') && onUnschedule && (
                <button
                  onClick={(e) => { e.stopPropagation(); onUnschedule(wo.id) }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 text-gray-700 px-3 py-1.5 text-xs font-medium hover:bg-gray-200 transition-colors"
                >
                  <Undo2 size={14} />
                  Unschedule
                </button>
              )}

              {/* Assign Crew button */}
              {canAssignCrew(role) && (
                <button
                  onClick={(e) => { e.stopPropagation(); setAssignModalWoId(wo.id) }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 text-gray-700 px-3 py-1.5 text-xs font-medium hover:bg-gray-200 transition-colors min-h-[32px]"
                >
                  <Users size={14} />
                  Assign Crew
                </button>
              )}
            </div>
          </div>
        )
      })}

      {/* Assign Crew Modal */}
      {assignWo && (
        <AssignCrewModal
          workOrderId={assignWo.id}
          scheduledDate={assignWo.scheduled_date}
          currentCrew={(assignWo.work_order_crew ?? []).map(c => ({
            id: c.id,
            team_member_id: c.team_member_id,
            role: c.role,
            team_member: c.team_member ? {
              id: c.team_member.id,
              first_name: c.team_member.first_name,
              last_name: c.team_member.last_name,
            } : { id: '', first_name: 'Unknown', last_name: '' },
          }))}
          onClose={() => setAssignModalWoId(null)}
          onSaved={() => {
            setAssignModalWoId(null)
            onCrewSaved?.()
          }}
        />
      )}
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
  onCrewSaved?: () => void
}

/** Desktop-only right slide panel showing scheduled jobs for a day. Hidden on mobile. */
export function DayDetailPanel({ dateStr, workOrders, open, onClose, assigneeColorMap, onConfirmSchedule, onUnschedule, onCrewSaved }: DayDetailPanelProps) {
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
        <DayJobList
          workOrders={workOrders}
          assigneeColorMap={assigneeColorMap}
          onConfirmSchedule={onConfirmSchedule}
          onUnschedule={onUnschedule}
          onCrewSaved={onCrewSaved}
        />
      </div>
    </div>
  )
}
