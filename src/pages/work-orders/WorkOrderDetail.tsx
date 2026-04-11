import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router'
import { ArrowLeft, Phone, MessageSquare, Mail, Navigation, Play, CheckCircle, CalendarCheck, Trash2, Undo2, Users, ChevronRight, ClipboardList, Send } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useWorkOrder } from '@/hooks/useWorkOrders'
import { canEdit, canCompleteField, canAssignCrew } from '@/lib/roles'
import { supabase } from '@/lib/supabase'
import { getSupabaseErrorMessage, formatDate, formatDateTime, todayPacific } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Card } from '@/components/ui/Card'
import { TabBar } from './components/TabBar'
import { AssignCrewModal } from '@/components/work-orders/AssignCrewModal'
import { WORK_ORDER_STATUSES, WIND_DIRECTIONS, formatPeriodLabel, getUrgencyColors, getServiceColor } from '@/lib/constants'
import type { WorkOrder } from '@/types/database'

const TABS = [
  { key: 'details', label: 'Details' },
  { key: 'field', label: 'Field' },
  { key: 'history', label: 'History' },
  { key: 'notes', label: 'Notes' },
]

function buildNavigationUrl(wo: WorkOrder) {
  const site = wo.site
  if (!site) return null
  if (site.latitude != null && site.longitude != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${site.latitude},${site.longitude}`
  }
  const addr = [site.address_line, site.city, site.state, site.zip].filter(Boolean).join(', ')
  if (!addr) return null
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`
}

function ActionButton({ href, icon, label }: { href: string | null; icon: React.ReactNode; label: string }) {
  if (!href) {
    return (
      <span className="inline-flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-[var(--color-text-muted)] opacity-40 cursor-not-allowed">
        {icon}
        <span className="text-[10px]">{label}</span>
      </span>
    )
  }
  return (
    <a href={href} className="inline-flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-[var(--color-text-muted)] hover:bg-surface hover:text-[var(--color-text-primary)] transition-colors">
      {icon}
      <span className="text-[10px]">{label}</span>
    </a>
  )
}

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-[140px]">
      <dt className="text-xs text-[var(--color-text-muted)]">{label}</dt>
      <dd className="text-sm mt-0.5">{children}</dd>
    </div>
  )
}

function CrewCard({ wo, onAssign }: { wo: WorkOrder; onAssign?: () => void }) {
  const { role } = useAuth()
  const crew = wo.work_order_crew ?? []

  return (
    <div className="mt-6 border-t border-surface-border pt-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Crew</h2>
        {canAssignCrew(role) && onAssign && (
          <Button size="sm" variant="secondary" onClick={onAssign}>
            <Users size={14} />
            Assign Crew
          </Button>
        )}
      </div>
      {crew.length === 0 ? (
        <p className="text-sm italic text-[var(--color-text-muted)]">No crew assigned.</p>
      ) : (
        <div className="space-y-2">
          {crew.map((c) => (
            <div key={c.id} className="flex items-center gap-3 py-1">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-200 text-xs font-semibold text-gray-700">
                {c.team_member ? `${c.team_member.first_name.charAt(0)}${c.team_member.last_name.charAt(0)}` : '??'}
              </span>
              <div>
                <p className="text-sm font-medium">
                  {c.team_member ? `${c.team_member.first_name} ${c.team_member.last_name}` : 'Unknown'}
                </p>
                {c.role && (
                  <p className="text-xs text-[var(--color-text-muted)] capitalize">{c.role}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DetailsTab({ wo, onAssignCrew }: { wo: WorkOrder; onAssignCrew?: () => void }) {
  const phone = wo.client?.billing_phone
  const email = wo.client?.billing_email
  const navUrl = buildNavigationUrl(wo)

  return (
    <div>
      <div className="flex items-center gap-1 mb-4 border-b border-surface-border pb-3">
        <ActionButton href={phone ? `tel:${phone}` : null} icon={<Phone size={18} />} label="Call" />
        <ActionButton href={phone ? `sms:${phone}` : null} icon={<MessageSquare size={18} />} label="Text" />
        <ActionButton href={email ? `mailto:${email}` : null} icon={<Mail size={18} />} label="Email" />
        <ActionButton href={navUrl} icon={<Navigation size={18} />} label="Navigate" />
      </div>

      <h2 className="text-sm font-semibold mb-3">Details</h2>
      <dl className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
        <DetailItem label="Agreement">
          <Link to={`/agreements/${wo.service_agreement_id}`} className="text-brand-green hover:underline">
            View Agreement
          </Link>
        </DetailItem>
        <DetailItem label="Line Item">
          {wo.agreement_line_item?.description || wo.agreement_line_item?.service_type?.name || '—'}
        </DetailItem>
        <DetailItem label="Service Type">{wo.service_type?.name ?? '—'}</DetailItem>
        <DetailItem label="Period">{formatPeriodLabel(wo)}</DetailItem>
        <DetailItem label="Status">{WORK_ORDER_STATUSES[wo.status]}</DetailItem>
        <DetailItem label="Scheduled Date">{formatDate(wo.scheduled_date)}</DetailItem>
        <DetailItem label="Urgency">
          {wo.urgency_level ? (
            <span className={`inline-block rounded-full px-3 py-0.5 text-xs font-medium border ${
              (() => {
                const c = getUrgencyColors(wo.urgency_level.key)
                return `${c.selectedBg} ${c.selectedText} ${c.selectedBorder}`
              })()
            }`}>
              {wo.urgency_level.label}
            </span>
          ) : '—'}
        </DetailItem>
        <DetailItem label="PCA">
          {wo.pca ? `${wo.pca.first_name} ${wo.pca.last_name}` : '—'}
        </DetailItem>
        <DetailItem label="PO Number">{wo.po_number ?? '—'}</DetailItem>
        {wo.days_since_last_service != null && (
          <DetailItem label="Days Since Last Service">{wo.days_since_last_service}</DetailItem>
        )}
      </dl>

      <CrewCard wo={wo} onAssign={onAssignCrew} />
    </div>
  )
}

interface FieldCompletionRecord {
  id: string
  submitted_at: string
  temperature_f: number | null
  wind_speed_mph: number | null
  wind_direction: string | null
  notes: string | null
  photo_urls: string[]
  crew_ids: string[]
  completed_by: string
}

function FieldTab({ wo, onUpdate }: { wo: WorkOrder; onUpdate: () => void }) {
  const { role } = useAuth()
  const navigate = useNavigate()
  const isEditable = canCompleteField(role) || canEdit(role)

  const [windSpeed, setWindSpeed] = useState(wo.wind_speed_mph != null ? String(wo.wind_speed_mph) : '')
  const [windDir, setWindDir] = useState(wo.wind_direction ?? '')
  const [airTemp, setAirTemp] = useState(wo.air_temp_f != null ? String(wo.air_temp_f) : '')
  const [tanks, setTanks] = useState(wo.tanks_used != null ? String(wo.tanks_used) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<FieldCompletionRecord[]>([])
  const [logsLoading, setLogsLoading] = useState(true)

  useEffect(() => {
    async function fetchLogs() {
      const { data } = await supabase
        .from('field_completions')
        .select('id, submitted_at, temperature_f, wind_speed_mph, wind_direction, notes, photo_urls, crew_ids, completed_by')
        .eq('work_order_id', wo.id)
        .order('submitted_at', { ascending: false })
      setLogs(data ?? [])
      setLogsLoading(false)
    }
    fetchLogs()
  }, [wo.id])

  async function handleSave() {
    setSaving(true)
    setError(null)
    const { error: err } = await supabase
      .from('work_orders')
      .update({
        wind_speed_mph: windSpeed ? parseFloat(windSpeed) : null,
        wind_direction: windDir || null,
        air_temp_f: airTemp ? parseFloat(airTemp) : null,
        tanks_used: tanks ? parseInt(tanks) : null,
      })
      .eq('id', wo.id)

    if (err) {
      setError(getSupabaseErrorMessage(err))
    } else {
      onUpdate()
    }
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold mb-3">Field Data</h2>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Wind Speed (mph)" type="number" value={windSpeed} onChange={(e) => setWindSpeed(e.target.value)} disabled={!isEditable} />
        <div>
          <label className="block text-sm font-medium mb-1">Wind Direction</label>
          <select value={windDir} onChange={(e) => setWindDir(e.target.value)} disabled={!isEditable} className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm min-h-[44px]">
            <option value="">—</option>
            {WIND_DIRECTIONS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <Input label="Air Temp (°F)" type="number" value={airTemp} onChange={(e) => setAirTemp(e.target.value)} disabled={!isEditable} />
        <Input label="Tanks Used" type="number" value={tanks} onChange={(e) => setTanks(e.target.value)} disabled={!isEditable} />
      </div>
      {wo.actual_start_date && (
        <div className="text-sm text-[var(--color-text-muted)]">
          Started: {formatDate(wo.actual_start_date)} {wo.actual_start_time ?? ''}
        </div>
      )}
      {wo.completion_date && (
        <div className="text-sm text-[var(--color-text-muted)]">
          Completed: {formatDate(wo.completion_date)} {wo.completion_time ?? ''}
        </div>
      )}
      {isEditable && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Field Data'}</Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate(`/work-orders/${wo.id}/complete?mode=log`)}
          >
            <ClipboardList size={16} />
            Log Field Data
          </Button>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      )}

      {/* Field completion logs */}
      <div className="border-t border-surface-border pt-4 mt-4">
        <h2 className="text-sm font-semibold mb-3">Field Logs</h2>
        {logsLoading ? (
          <p className="text-sm text-[var(--color-text-muted)]">Loading...</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No field logs yet.</p>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="rounded-lg border border-surface-border p-3 text-sm">
                <p className="text-xs text-[var(--color-text-muted)] mb-2">
                  {formatDateTime(log.submitted_at)}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {log.temperature_f != null && <span>Temp: {log.temperature_f}°F</span>}
                  {log.wind_speed_mph != null && <span>Wind: {log.wind_speed_mph} mph</span>}
                  {log.wind_direction && <span>Dir: {log.wind_direction}</span>}
                </div>
                {log.notes && (
                  <p className="mt-2 text-sm whitespace-pre-wrap">{log.notes}</p>
                )}
                {log.photo_urls.length > 0 && (
                  <div className="mt-2 flex gap-2 flex-wrap">
                    {log.photo_urls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block w-16 h-16 rounded border border-surface-border overflow-hidden">
                        <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface SiteHistoryItem {
  id: string
  completion_date: string | null
  service_type_name: string | null
  work_order_crew: { id: string; team_member: { first_name: string; last_name: string } | null }[]
}

function HistoryTab({ wo }: { wo: WorkOrder }) {
  const navigate = useNavigate()
  const [history, setHistory] = useState<SiteHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchHistory = useCallback(async () => {
    if (!wo.site_id) {
      setIsLoading(false)
      return
    }
    const { data } = await supabase
      .from('work_orders')
      .select('id, completion_date, service_type:service_types(name), work_order_crew(id, team_member:team(first_name, last_name))')
      .eq('site_id', wo.site_id)
      .eq('status', 'completed')
      .neq('id', wo.id)
      .order('completion_date', { ascending: false })
      .limit(20)

    if (data) {
      setHistory(data.map((d: any) => ({
        id: d.id,
        completion_date: d.completion_date,
        service_type_name: d.service_type?.name ?? null,
        work_order_crew: d.work_order_crew ?? [],
      })))
    }
    setIsLoading(false)
  }, [wo.site_id, wo.id])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  if (isLoading) return <LoadingSpinner />

  if (history.length === 0) {
    return <p className="text-sm text-[var(--color-text-muted)]">No previous completed jobs for this site.</p>
  }

  return (
    <div className="space-y-1">
      <h2 className="text-sm font-semibold mb-3">Site History</h2>
      {history.map((item) => {
        const sc = getServiceColor(item.service_type_name ?? undefined)
        const crewInitials = item.work_order_crew
          .slice(0, 3)
          .map((c) => c.team_member ? `${c.team_member.first_name.charAt(0)}${c.team_member.last_name.charAt(0)}` : '??')

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => navigate(`/work-orders/${item.id}`)}
            className="w-full flex items-center justify-between py-2.5 px-2 -mx-2 rounded-lg hover:bg-surface-raised transition-colors min-h-[44px]"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm text-[var(--color-text-muted)] w-24 shrink-0">
                {formatDate(item.completion_date)}
              </span>
              {item.service_type_name && (
                <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${sc.bg} ${sc.text}`}>
                  {item.service_type_name}
                </span>
              )}
              {crewInitials.length > 0 && (
                <div className="flex -space-x-1">
                  {crewInitials.map((init, i) => (
                    <span key={i} className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 text-[9px] font-semibold text-gray-700 ring-1 ring-white">
                      {init}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <ChevronRight size={16} className="text-[var(--color-text-muted)]" />
          </button>
        )
      })}
    </div>
  )
}

interface WONote {
  id: string
  body: string
  created_at: string
  author: { first_name: string; last_name: string } | null
}

function NotesTab({ wo }: { wo: WorkOrder }) {
  const { teamMember } = useAuth()
  const hasStaticNotes = wo.notes_client || wo.notes_internal || wo.notes_technician

  const [notes, setNotes] = useState<WONote[]>([])
  const [notesLoading, setNotesLoading] = useState(true)
  const [newNote, setNewNote] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchNotes = useCallback(async () => {
    const { data } = await supabase
      .from('work_order_notes')
      .select('id, body, created_at, author:team!work_order_notes_author_id_fkey(first_name, last_name)')
      .eq('work_order_id', wo.id)
      .order('created_at', { ascending: false })
    setNotes(
      (data ?? []).map((n: Record<string, unknown>) => ({
        id: n.id as string,
        body: n.body as string,
        created_at: n.created_at as string,
        author: n.author as { first_name: string; last_name: string } | null,
      }))
    )
    setNotesLoading(false)
  }, [wo.id])

  useEffect(() => { fetchNotes() }, [fetchNotes])

  async function handleAdd() {
    if (!newNote.trim() || !teamMember) return
    setSaving(true)
    const { error } = await supabase.from('work_order_notes').insert({
      work_order_id: wo.id,
      author_id: teamMember.id,
      body: newNote.trim(),
    })
    if (!error) {
      setNewNote('')
      fetchNotes()
    }
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      {/* Static notes from the work order */}
      {hasStaticNotes && (
        <>
          <div>
            <h2 className="text-sm font-semibold mb-2">Client Notes</h2>
            <p className="text-sm whitespace-pre-wrap">{wo.notes_client || <span className="text-[var(--color-text-muted)]">—</span>}</p>
          </div>
          <div className="border-t border-surface-border pt-4">
            <h2 className="text-sm font-semibold mb-2">Internal Notes</h2>
            <p className="text-sm whitespace-pre-wrap">{wo.notes_internal || <span className="text-[var(--color-text-muted)]">—</span>}</p>
          </div>
          <div className="border-t border-surface-border pt-4">
            <h2 className="text-sm font-semibold mb-2">Tech Instructions</h2>
            <p className="text-sm whitespace-pre-wrap">{wo.notes_technician || <span className="text-[var(--color-text-muted)]">—</span>}</p>
          </div>
        </>
      )}

      {/* Add note form */}
      <div className={hasStaticNotes ? 'border-t border-surface-border pt-4' : ''}>
        <h2 className="text-sm font-semibold mb-2">Notes</h2>
        <div className="flex gap-2">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            rows={2}
            placeholder="Add a note..."
            className="flex-1 rounded-lg border border-surface-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
          />
          <Button size="sm" onClick={handleAdd} disabled={saving || !newNote.trim()}>
            <Send size={16} />
          </Button>
        </div>
      </div>

      {/* Notes list */}
      {notesLoading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading...</p>
      ) : notes.length === 0 && !hasStaticNotes ? (
        <p className="text-sm text-[var(--color-text-muted)]">No notes yet.</p>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div key={note.id} className="rounded-lg border border-surface-border p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium">
                  {note.author ? `${note.author.first_name} ${note.author.last_name}` : 'Unknown'}
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {formatDateTime(note.created_at)}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{note.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function WorkOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const { role, teamMember } = useAuth()
  const navigate = useNavigate()
  const { workOrder, isLoading, error, refetch } = useWorkOrder(id)
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [activeTab, setActiveTab] = useState('details')
  const [scheduleDate, setScheduleDate] = useState('')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)

  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorMessage message={error} onRetry={refetch} />
  if (!workOrder) return <ErrorMessage message="Work order not found." />

  const isTechnician = role === 'technician'
  const isAssignedToMe = isTechnician && teamMember && workOrder.work_order_crew?.some(c => c.team_member_id === teamMember.id)

  async function deleteWorkOrder() {
    if (!workOrder) return
    const confirmed = window.confirm('Are you sure you want to delete this work order?')
    if (!confirmed) return
    setDeleting(true)
    const { error: err } = await supabase
      .from('work_orders')
      .delete()
      .eq('id', workOrder.id)
    if (err) {
      alert(getSupabaseErrorMessage(err))
      setDeleting(false)
    } else {
      navigate('/work-orders')
    }
  }

  async function markScheduled() {
    if (!workOrder || !scheduleDate) return
    setUpdating(true)
    const { error: err } = await supabase
      .from('work_orders')
      .update({ status: 'scheduled', scheduled_date: scheduleDate })
      .eq('id', workOrder.id)
    if (err) alert(getSupabaseErrorMessage(err))
    else { refetch(); setShowDatePicker(false) }
    setUpdating(false)
  }

  async function unscheduleJob() {
    if (!workOrder) return
    setUpdating(true)
    const { error: err } = await supabase
      .from('work_orders')
      .update({ status: 'unscheduled', scheduled_date: null })
      .eq('id', workOrder.id)
    if (err) alert(getSupabaseErrorMessage(err))
    else refetch()
    setUpdating(false)
  }

  async function confirmSchedule() {
    if (!workOrder) return
    setUpdating(true)
    const { error: err } = await supabase
      .from('work_orders')
      .update({ status: 'scheduled' })
      .eq('id', workOrder.id)
    if (err) alert(getSupabaseErrorMessage(err))
    else refetch()
    setUpdating(false)
  }

  async function startJob() {
    if (!workOrder) return
    const confirmed = window.confirm('Start this job now?')
    if (!confirmed) return
    setUpdating(true)
    const today = todayPacific()
    const now = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: 'America/Los_Angeles' })
    const { error: err } = await supabase
      .from('work_orders')
      .update({ status: 'in_progress', actual_start_date: today, actual_start_time: now })
      .eq('id', workOrder.id)
    if (err) alert(getSupabaseErrorMessage(err))
    else refetch()
    setUpdating(false)
  }

  async function completeJob() {
    if (!workOrder) return
    // For technicians, navigate to the FieldCompletionForm
    if (isTechnician) {
      navigate(`/work-orders/${workOrder.id}/complete`)
      return
    }
    setUpdating(true)
    const today = todayPacific()

    const { error: err } = await supabase
      .from('work_orders')
      .update({ status: 'completed', completion_date: today, last_serviced_date: today })
      .eq('id', workOrder.id)

    if (err) {
      alert(getSupabaseErrorMessage(err))
      setUpdating(false)
      return
    }

    await supabase
      .from('work_orders')
      .update({ last_serviced_date: today })
      .eq('agreement_line_item_id', workOrder.agreement_line_item_id)
      .in('status', ['unscheduled', 'tentative'])

    refetch()
    setUpdating(false)
  }

  // Determine which action button to show for technician sticky bar
  const techAction = (() => {
    if (!isTechnician || !isAssignedToMe) return null
    if (workOrder.status === 'scheduled') return 'start'
    if (workOrder.status === 'in_progress') return 'complete'
    if (workOrder.status === 'completed') return 'done'
    return null
  })()

  return (
    <div className={techAction && techAction !== 'done' ? 'pb-24 md:pb-0' : ''}>
      <Link to="/work-orders" className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mb-4">
        <ArrowLeft size={16} />
        Back to Jobs
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">
            {workOrder.work_order_number ?? 'Job'}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            {workOrder.client?.name} — {workOrder.site?.name}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <Badge status={workOrder.status} />
            <span className="text-xs text-[var(--color-text-muted)]">{formatPeriodLabel(workOrder)}</span>
          </div>
        </div>

        {/* Admin / Manager action buttons */}
        {!isTechnician && (
          <div className="flex flex-wrap items-center gap-2">
            {workOrder.status === 'unscheduled' && canEdit(role) && (
              <>
                {showDatePicker ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="rounded-lg border border-surface-border bg-white px-2 py-1.5 text-sm min-h-[44px]"
                    />
                    <Button size="sm" onClick={markScheduled} disabled={updating || !scheduleDate}>
                      Confirm
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => setShowDatePicker(true)}>
                    <CalendarCheck size={16} />
                    Schedule
                  </Button>
                )}
              </>
            )}
            {workOrder.status === 'tentative' && canEdit(role) && (
              <Button size="sm" onClick={confirmSchedule} disabled={updating}>
                <CalendarCheck size={16} />
                Confirm Schedule
              </Button>
            )}
            {(workOrder.status === 'tentative' || workOrder.status === 'scheduled') && canEdit(role) && (
              <Button size="sm" variant="secondary" onClick={unscheduleJob} disabled={updating}>
                <Undo2 size={16} />
                Unschedule
              </Button>
            )}
            {(workOrder.status === 'scheduled' || workOrder.status === 'tentative') && canCompleteField(role) && (
              <Button size="sm" onClick={startJob} disabled={updating}>
                <Play size={16} />
                Start Job
              </Button>
            )}
            {workOrder.status === 'in_progress' && canCompleteField(role) && (
              <Button size="sm" onClick={completeJob} disabled={updating}>
                <CheckCircle size={16} />
                Complete Job
              </Button>
            )}
            {canEdit(role) && (
              <Button variant="danger" size="sm" onClick={deleteWorkOrder} disabled={deleting}>
                <Trash2 size={16} />
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
            )}
          </div>
        )}
      </div>

      <Card padding={false}>
        <TabBar tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
        <div className="p-5">
          {activeTab === 'details' && <DetailsTab wo={workOrder} onAssignCrew={() => setShowAssignModal(true)} />}
          {activeTab === 'field' && <FieldTab wo={workOrder} onUpdate={refetch} />}
          {activeTab === 'history' && <HistoryTab wo={workOrder} />}
          {activeTab === 'notes' && <NotesTab wo={workOrder} />}
        </div>
      </Card>

      {/* Technician sticky bottom bar */}
      {techAction === 'start' && (
        <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-30 bg-white border-t border-surface-border p-3 md:hidden">
          <Button size="lg" className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={startJob} disabled={updating}>
            <Play size={18} />
            {updating ? 'Starting...' : 'Start Job'}
          </Button>
        </div>
      )}
      {techAction === 'complete' && (
        <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-30 bg-white border-t border-surface-border p-3 md:hidden">
          <Button size="lg" className="w-full" onClick={completeJob} disabled={updating}>
            <CheckCircle size={18} />
            Complete Job
          </Button>
        </div>
      )}
      {techAction === 'done' && (
        <div className="mt-4">
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-4 py-3">
            <CheckCircle size={16} />
            Completed {formatDate(workOrder.completion_date)}
          </div>
        </div>
      )}

      {/* Assign Crew Modal */}
      {showAssignModal && (
        <AssignCrewModal
          workOrderId={workOrder.id}
          scheduledDate={workOrder.scheduled_date}
          currentCrew={(workOrder.work_order_crew ?? []).map(c => ({
            id: c.id,
            team_member_id: c.team_member_id,
            role: c.role,
            team_member: c.team_member ? {
              id: c.team_member.id,
              first_name: c.team_member.first_name,
              last_name: c.team_member.last_name,
            } : { id: '', first_name: 'Unknown', last_name: '' },
          }))}
          onClose={() => setShowAssignModal(false)}
          onSaved={() => { setShowAssignModal(false); refetch() }}
        />
      )}
    </div>
  )
}
