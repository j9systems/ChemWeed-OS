import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router'
import { ArrowLeft, Phone, MessageSquare, Mail, Navigation, Play, CheckCircle, CalendarCheck, Trash2, Undo2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useWorkOrder } from '@/hooks/useWorkOrders'
import { canEdit, canCompleteField } from '@/lib/roles'
import { supabase } from '@/lib/supabase'
import { getSupabaseErrorMessage, formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Card } from '@/components/ui/Card'
import { TabBar } from './components/TabBar'
import { WORK_ORDER_STATUSES, WIND_DIRECTIONS, formatPeriodLabel, getUrgencyColors } from '@/lib/constants'
import type { WorkOrder } from '@/types/database'

const TABS = [
  { key: 'details', label: 'Details' },
  { key: 'field', label: 'Field' },
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

function DetailsTab({ wo }: { wo: WorkOrder }) {
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
    </div>
  )
}

function FieldTab({ wo, onUpdate }: { wo: WorkOrder; onUpdate: () => void }) {
  const { role } = useAuth()
  const isFieldVisible = wo.status === 'in_progress' || wo.status === 'completed'
  const isEditable = wo.status === 'in_progress' && (canCompleteField(role) || canEdit(role))

  const [windSpeed, setWindSpeed] = useState(wo.wind_speed_mph != null ? String(wo.wind_speed_mph) : '')
  const [windDir, setWindDir] = useState(wo.wind_direction ?? '')
  const [airTemp, setAirTemp] = useState(wo.air_temp_f != null ? String(wo.air_temp_f) : '')
  const [tanks, setTanks] = useState(wo.tanks_used != null ? String(wo.tanks_used) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isFieldVisible) {
    return <p className="text-sm text-[var(--color-text-muted)]">Field data is available once a job is started.</p>
  }

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
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Field Data'}</Button>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      )}
    </div>
  )
}

function NotesTab({ wo }: { wo: WorkOrder }) {
  const hasAny = wo.notes_client || wo.notes_internal || wo.notes_technician

  if (!hasAny) {
    return <p className="text-sm text-[var(--color-text-muted)]">No notes for this work order.</p>
  }

  return (
    <div className="space-y-4">
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
    </div>
  )
}

export function WorkOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const { role } = useAuth()
  const navigate = useNavigate()
  const { workOrder, isLoading, error, refetch } = useWorkOrder(id)
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [activeTab, setActiveTab] = useState('details')
  const [scheduleDate, setScheduleDate] = useState('')
  const [showDatePicker, setShowDatePicker] = useState(false)

  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorMessage message={error} onRetry={refetch} />
  if (!workOrder) return <ErrorMessage message="Work order not found." />

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
    setUpdating(true)
    const today = new Date().toISOString().split('T')[0]
    const { error: err } = await supabase
      .from('work_orders')
      .update({ status: 'in_progress', actual_start_date: today })
      .eq('id', workOrder.id)
    if (err) alert(getSupabaseErrorMessage(err))
    else refetch()
    setUpdating(false)
  }

  async function completeJob() {
    if (!workOrder) return
    setUpdating(true)
    const today = new Date().toISOString().split('T')[0]

    // Complete this WO
    const { error: err } = await supabase
      .from('work_orders')
      .update({ status: 'completed', completion_date: today, last_serviced_date: today })
      .eq('id', workOrder.id)

    if (err) {
      alert(getSupabaseErrorMessage(err))
      setUpdating(false)
      return
    }

    // Update last_serviced_date on sibling WOs for same line item
    await supabase
      .from('work_orders')
      .update({ last_serviced_date: today })
      .eq('agreement_line_item_id', workOrder.agreement_line_item_id)
      .in('status', ['unscheduled', 'tentative'])

    refetch()
    setUpdating(false)
  }

  return (
    <div>
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
      </div>

      <Card padding={false}>
        <TabBar tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
        <div className="p-5">
          {activeTab === 'details' && <DetailsTab wo={workOrder} />}
          {activeTab === 'field' && <FieldTab wo={workOrder} onUpdate={refetch} />}
          {activeTab === 'notes' && <NotesTab wo={workOrder} />}
        </div>
      </Card>
    </div>
  )
}
