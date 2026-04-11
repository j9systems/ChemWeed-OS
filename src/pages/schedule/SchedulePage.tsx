import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, ChevronRight, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { useWorkOrders } from '@/hooks/useWorkOrders'
import { supabase } from '@/lib/supabase'
import { getSupabaseErrorMessage } from '@/lib/utils'
import { getServiceColor, formatPeriodLabel, MONTH_NAMES } from '@/lib/constants'
import { DayDetailPanel, getAssigneeColorMap } from './DayDetailPanel'
import { DayMapPanel } from './DayMapPanel'
import type { WorkOrder } from '@/types/database'

function DaysSincePill({ days }: { days: number | null }) {
  if (days == null) return null
  let classes = 'bg-gray-100 text-gray-500'
  if (days > 45) classes = 'bg-red-100 text-red-700'
  else if (days >= 20) classes = 'bg-amber-100 text-amber-700'
  return <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${classes}`}>{days}d</span>
}

interface QueueCardProps {
  wo: WorkOrder
  compact?: boolean
}

function QueueCard({ wo, compact }: QueueCardProps) {
  const navigate = useNavigate()
  const sc = getServiceColor(wo.service_type?.name)

  function onDragStart(e: React.DragEvent) {
    e.dataTransfer.setData('text/plain', wo.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  if (compact) {
    return (
      <div
        draggable
        onDragStart={onDragStart}
        onClick={() => navigate(`/work-orders/${wo.id}`)}
        className="flex-shrink-0 w-[200px] md:w-auto rounded-lg border border-surface-border bg-white p-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
        style={{ borderLeft: `3px solid ${sc.border}` }}
      >
        <p className="text-xs font-semibold truncate">{wo.client?.name ?? 'Client'}</p>
        <p className="text-[10px] text-[var(--color-text-muted)] truncate">{wo.site?.name}</p>
        <div className="flex items-center gap-1 mt-1">
          {wo.service_type?.name && (
            <span className={`inline-block rounded px-1 py-0.5 text-[10px] font-semibold ${sc.bg} ${sc.text}`}>
              {wo.service_type.name}
            </span>
          )}
          <DaysSincePill days={wo.days_since_last_service} />
        </div>
      </div>
    )
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={() => navigate(`/work-orders/${wo.id}`)}
      className="rounded-lg border border-surface-border bg-white p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
      style={{ borderLeft: `3px solid ${sc.border}` }}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="text-sm font-semibold truncate">{wo.client?.name ?? 'Client'}</p>
        <DaysSincePill days={wo.days_since_last_service} />
      </div>
      <p className="text-xs text-[var(--color-text-muted)] truncate">{wo.site?.name}</p>
      <div className="flex items-center gap-1 mt-1">
        {wo.service_type?.name && (
          <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${sc.bg} ${sc.text}`}>
            {wo.service_type.name}
          </span>
        )}
        <span className="text-[10px] text-[var(--color-text-muted)]">{formatPeriodLabel(wo)}</span>
      </div>
    </div>
  )
}

function CalendarChip({ wo, onConfirm }: { wo: WorkOrder; onConfirm: (id: string) => void }) {
  const navigate = useNavigate()
  const sc = getServiceColor(wo.service_type?.name)
  const isTentative = wo.status === 'tentative'
  const clientShort = wo.client?.name?.split(' ')[0] ?? ''

  return (
    <div
      onClick={(e) => { e.stopPropagation(); navigate(`/work-orders/${wo.id}`) }}
      className={`text-[10px] leading-tight rounded px-1 py-0.5 truncate cursor-pointer flex items-center gap-0.5 ${
        isTentative ? 'border border-dashed border-gray-400 bg-gray-50 text-gray-600' : `${sc.bg} ${sc.text}`
      }`}
    >
      <span className="truncate">{clientShort}{wo.service_type?.name ? ` – ${wo.service_type.name}` : ''}</span>
      {isTentative && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onConfirm(wo.id) }}
          className="ml-auto shrink-0 rounded-full bg-emerald-500 text-white p-0.5 hover:bg-emerald-600"
          title="Confirm schedule"
        >
          <Check size={8} />
        </button>
      )}
    </div>
  )
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
  // 0=Sun, we want Mon=0
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1
}

export function SchedulePage() {
  const { workOrders: allWorkOrders, refetch: refetchAll } = useWorkOrders()
  const { workOrders: actionableWOs, refetch: refetchActionable } = useWorkOrders({ status: 'unscheduled', actionableOnly: true })

  // Combine: use actionable filter for unscheduled queue, all WOs for calendar
  const workOrders = allWorkOrders
  const refetch = () => { refetchAll(); refetchActionable() }

  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [dragOverDate, setDragOverDate] = useState<string | null>(null)
  const [queueOpen, setQueueOpen] = useState(true)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // Local optimistic state for WOs (to avoid waiting for refetch on drop)
  const [optimisticUpdates, setOptimisticUpdates] = useState<Record<string, { scheduled_date: string; status: string }>>({})

  const unscheduled = actionableWOs
    .filter(wo => {
      const opt = optimisticUpdates[wo.id]
      const status = opt?.status ?? wo.status
      return status === 'unscheduled'
    })
    .sort((a, b) => {
      const da = a.days_since_last_service ?? -1
      const db = b.days_since_last_service ?? -1
      if (db !== da) return db - da
      return (a.client?.name ?? '').localeCompare(b.client?.name ?? '')
    })

  const calendarWOs = workOrders.filter(wo => {
    const opt = optimisticUpdates[wo.id]
    const status = opt?.status ?? wo.status
    const date = opt?.scheduled_date ?? wo.scheduled_date
    return (status === 'tentative' || status === 'scheduled') && date
  })

  function getWOsForDate(dateStr: string): WorkOrder[] {
    return calendarWOs.filter(wo => {
      const opt = optimisticUpdates[wo.id]
      return (opt?.scheduled_date ?? wo.scheduled_date) === dateStr
    })
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3000)
  }

  async function handleDrop(dateStr: string, woId: string) {
    setDragOverDate(null)

    // Optimistic update
    setOptimisticUpdates(prev => ({ ...prev, [woId]: { scheduled_date: dateStr, status: 'tentative' } }))

    const { error } = await supabase
      .from('work_orders')
      .update({ scheduled_date: dateStr, status: 'tentative' })
      .eq('id', woId)

    if (error) {
      // Revert
      setOptimisticUpdates(prev => {
        const next = { ...prev }
        delete next[woId]
        return next
      })
      showToast(`Error: ${getSupabaseErrorMessage(error)}`)
    } else {
      refetch()
    }
  }

  async function confirmSchedule(woId: string) {
    setOptimisticUpdates(prev => ({
      ...prev,
      [woId]: { ...prev[woId]!, status: 'scheduled' },
    }))

    const { error } = await supabase
      .from('work_orders')
      .update({ status: 'scheduled' })
      .eq('id', woId)

    if (error) {
      showToast(`Error: ${getSupabaseErrorMessage(error)}`)
    }
    refetch()
  }

  async function unschedule(woId: string) {
    setOptimisticUpdates(prev => ({ ...prev, [woId]: { scheduled_date: '', status: 'unscheduled' } }))

    const { error } = await supabase
      .from('work_orders')
      .update({ status: 'unscheduled', scheduled_date: null })
      .eq('id', woId)

    if (error) {
      setOptimisticUpdates(prev => {
        const next = { ...prev }
        delete next[woId]
        return next
      })
      showToast(`Error: ${getSupabaseErrorMessage(error)}`)
    } else {
      refetch()
    }
  }

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth)
  const dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  // Build calendar cells
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const todayStr = now.toISOString().split('T')[0]

  const selectedDayWOs = selectedDate ? getWOsForDate(selectedDate) : []
  const assigneeColorMap = getAssigneeColorMap(selectedDayWOs)

  const closeDetailPanels = useCallback(() => setSelectedDate(null), [])

  return (
    <div className="flex flex-col md:flex-row gap-4 min-h-0">
      {/* Left Panel — Unscheduled Queue */}
      <div className="md:w-[320px] shrink-0">
        <button
          type="button"
          onClick={() => setQueueOpen(!queueOpen)}
          className="flex items-center justify-between w-full mb-2 md:cursor-default"
        >
          <h2 className="text-lg font-semibold">
            Unscheduled
            <span className="ml-2 inline-flex items-center justify-center rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-medium">
              {unscheduled.length}
            </span>
          </h2>
          <span className="md:hidden text-[var(--color-text-muted)]">
            {queueOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </span>
        </button>

        {/* Mobile: horizontal scroll, Desktop: vertical list */}
        {queueOpen && (
          <>
            {/* Mobile horizontal */}
            <div className="md:hidden flex gap-2 overflow-x-auto pb-2">
              {unscheduled.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)] py-2">No unscheduled work orders.</p>
              ) : (
                unscheduled.map(wo => <QueueCard key={wo.id} wo={wo} compact />)
              )}
            </div>
            {/* Desktop vertical */}
            <div className="hidden md:block space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto pr-1">
              {unscheduled.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)] py-2">No unscheduled work orders.</p>
              ) : (
                unscheduled.map(wo => <QueueCard key={wo.id} wo={wo} />)
              )}
            </div>
          </>
        )}
      </div>

      {/* Right Panel — Calendar */}
      <div className="flex-1 min-w-0">
        {/* Month nav */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="rounded-lg p-2 hover:bg-surface-raised min-h-[44px] min-w-[44px] flex items-center justify-center">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-lg font-semibold">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </h2>
          <button onClick={nextMonth} className="rounded-lg p-2 hover:bg-surface-raised min-h-[44px] min-w-[44px] flex items-center justify-center">
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-px bg-surface-border rounded-lg overflow-hidden">
          {/* Headers */}
          {dayHeaders.map(d => (
            <div key={d} className="bg-surface-raised text-center text-xs font-medium text-[var(--color-text-muted)] py-2">
              {d}
            </div>
          ))}

          {/* Day cells */}
          {cells.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="bg-white min-h-[80px] md:min-h-[100px]" />
            }

            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const isToday = dateStr === todayStr
            const isOver = dragOverDate === dateStr
            const dayWOs = getWOsForDate(dateStr)

            return (
              <div
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                onDragOver={(e) => { e.preventDefault(); setDragOverDate(dateStr) }}
                onDragLeave={() => setDragOverDate(null)}
                onDrop={(e) => {
                  e.preventDefault()
                  const woId = e.dataTransfer.getData('text/plain')
                  if (woId) handleDrop(dateStr, woId)
                }}
                className={`bg-white min-h-[80px] md:min-h-[100px] p-1 transition-colors cursor-pointer hover:bg-gray-50 ${
                  isOver ? 'bg-emerald-50 ring-2 ring-inset ring-emerald-400' : ''
                } ${selectedDate === dateStr ? 'ring-2 ring-inset ring-brand-green bg-emerald-50/50' : ''}`}
              >
                <div className={`text-xs font-medium mb-0.5 ${isToday ? 'text-white bg-brand-green rounded-full w-5 h-5 flex items-center justify-center' : 'text-[var(--color-text-muted)]'}`}>
                  {day}
                </div>
                <div className="space-y-0.5">
                  {dayWOs.map(wo => (
                    <CalendarChip key={wo.id} wo={wo} onConfirm={confirmSchedule} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] rounded-lg bg-gray-800 text-white px-4 py-2 text-sm shadow-lg">
          {toastMsg}
        </div>
      )}

      {/* Backdrop overlay — click to close panels */}
      {selectedDate && (
        <div
          className="fixed inset-0 bg-black/20 z-40 transition-opacity duration-300"
          onClick={closeDetailPanels}
        />
      )}

      {/* Day detail panel (slides from right) */}
      <DayDetailPanel
        dateStr={selectedDate ?? ''}
        workOrders={selectedDayWOs}
        open={!!selectedDate}
        onClose={closeDetailPanels}
        assigneeColorMap={assigneeColorMap}
        onConfirmSchedule={confirmSchedule}
        onUnschedule={unschedule}
        onCrewSaved={refetch}
      />

      {/* Day map panel (slides from bottom) */}
      <DayMapPanel
        dateStr={selectedDate ?? ''}
        workOrders={selectedDayWOs}
        open={!!selectedDate}
        onClose={closeDetailPanels}
        assigneeColorMap={assigneeColorMap}
        onConfirmSchedule={confirmSchedule}
        onUnschedule={unschedule}
      />
    </div>
  )
}
