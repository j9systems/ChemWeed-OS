import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router'
import { ArrowLeft, Phone, MessageSquare, Mail, Navigation, Play, CheckCircle, CalendarCheck, Trash2, Undo2, Users, ChevronRight, Send, AlertCircle, Check } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useWorkOrder } from '@/hooks/useWorkOrders'
import { canEdit, canCompleteField, canAssignCrew } from '@/lib/roles'
import { supabase } from '@/lib/supabase'
import { getSupabaseErrorMessage, formatDate, formatDateTime, todayPacific } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Card } from '@/components/ui/Card'
import { TabBar } from './components/TabBar'
import { AssignCrewModal } from '@/components/work-orders/AssignCrewModal'
import { FieldTab } from './tabs/FieldTab'
import { WORK_ORDER_STATUSES, formatPeriodLabel, getUrgencyColors, getServiceColor } from '@/lib/constants'
import { formatCurrency } from '@/lib/utils'
import type { WorkOrder, Role, ServiceAgreementLineItem } from '@/types/database'

const TABS = [
  { key: 'details', label: 'Details' },
  { key: 'field', label: 'Field' },
  { key: 'proposal', label: 'Proposal' },
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

interface VehicleOption {
  id: string
  label: string
}

function VehicleField({ wo }: { wo: WorkOrder }) {
  const [vehicles, setVehicles] = useState<VehicleOption[]>([])
  const [value, setValue] = useState(wo.vehicle_id ?? '')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')

  useEffect(() => {
    setValue(wo.vehicle_id ?? '')
  }, [wo.vehicle_id])

  useEffect(() => {
    supabase
      .from('vehicles')
      .select('id, label')
      .eq('is_active', true)
      .order('label')
      .then(({ data }) => {
        if (data) setVehicles(data as VehicleOption[])
      })
  }, [])

  useEffect(() => {
    if (saveStatus === 'saved') {
      const timer = setTimeout(() => setSaveStatus('idle'), 2000)
      return () => clearTimeout(timer)
    }
  }, [saveStatus])

  async function handleChange(newValue: string) {
    setValue(newValue)
    const { error } = await supabase
      .from('work_orders')
      .update({ vehicle_id: newValue || null })
      .eq('id', wo.id)
    setSaveStatus(error ? 'error' : 'saved')
  }

  return (
    <div className="mt-6 border-t border-surface-border pt-4">
      <label className="block text-sm font-semibold mb-2">Vehicle</label>
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
      >
        <option value="">— Unassigned —</option>
        {vehicles.map((v) => (
          <option key={v.id} value={v.id}>{v.label}</option>
        ))}
      </select>
      {saveStatus === 'saved' && (
        <div className="flex items-center gap-1 mt-1 text-xs text-emerald-600">
          <Check size={14} />
          Saved
        </div>
      )}
      {saveStatus === 'error' && (
        <p className="mt-1 text-xs text-red-600">Failed to save. Please try again.</p>
      )}
    </div>
  )
}

function MileageFields({ wo }: { wo: WorkOrder }) {
  const [startMileage, setStartMileage] = useState(wo.start_mileage?.toString() ?? '')
  const [endMileage, setEndMileage] = useState(wo.end_mileage?.toString() ?? '')
  const [startSaveStatus, setStartSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [endSaveStatus, setEndSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')

  useEffect(() => {
    setStartMileage(wo.start_mileage?.toString() ?? '')
  }, [wo.start_mileage])

  useEffect(() => {
    setEndMileage(wo.end_mileage?.toString() ?? '')
  }, [wo.end_mileage])

  useEffect(() => {
    if (startSaveStatus === 'saved') {
      const timer = setTimeout(() => setStartSaveStatus('idle'), 2000)
      return () => clearTimeout(timer)
    }
  }, [startSaveStatus])

  useEffect(() => {
    if (endSaveStatus === 'saved') {
      const timer = setTimeout(() => setEndSaveStatus('idle'), 2000)
      return () => clearTimeout(timer)
    }
  }, [endSaveStatus])

  const isReadOnly = wo.status === 'completed' || wo.status === 'cancelled'
  const showStart = ['tentative', 'scheduled', 'in_progress'].includes(wo.status)
  const showEnd = ['in_progress', 'partial_complete'].includes(wo.status)

  async function handleStartBlur() {
    const parsed = startMileage.trim() === '' ? null : parseInt(startMileage, 10)
    if (parsed === (wo.start_mileage ?? null)) return
    const { error } = await supabase
      .from('work_orders')
      .update({ start_mileage: isNaN(parsed as number) ? null : parsed })
      .eq('id', wo.id)
    setStartSaveStatus(error ? 'error' : 'saved')
  }

  async function handleEndBlur() {
    const parsed = endMileage.trim() === '' ? null : parseInt(endMileage, 10)
    if (parsed === (wo.end_mileage ?? null)) return
    const { error } = await supabase
      .from('work_orders')
      .update({ end_mileage: isNaN(parsed as number) ? null : parsed })
      .eq('id', wo.id)
    setEndSaveStatus(error ? 'error' : 'saved')
  }

  if (!showStart && !showEnd && !isReadOnly) return null
  // Show read-only values for completed/cancelled if they have data
  if (isReadOnly && wo.start_mileage == null && wo.end_mileage == null) return null

  return (
    <div className="mt-6 border-t border-surface-border pt-4">
      <label className="block text-sm font-semibold mb-2">Mileage</label>
      <div className="flex gap-4">
        {(showStart || (isReadOnly && wo.start_mileage != null)) && (
          <div className="flex-1">
            <label className="block text-xs text-[var(--color-text-muted)] mb-1">Start Mileage</label>
            <input
              type="number"
              value={isReadOnly ? (wo.start_mileage ?? '') : startMileage}
              onChange={(e) => setStartMileage(e.target.value)}
              onBlur={handleStartBlur}
              readOnly={isReadOnly}
              placeholder="Odometer"
              className={`w-full border border-surface-border rounded-lg bg-surface-raised px-3 py-2 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
            />
            {startSaveStatus === 'saved' && (
              <div className="flex items-center gap-1 mt-1 text-xs text-emerald-600">
                <Check size={14} />
                Saved
              </div>
            )}
            {startSaveStatus === 'error' && (
              <p className="mt-1 text-xs text-red-600">Failed to save.</p>
            )}
          </div>
        )}
        {(showEnd || (isReadOnly && wo.end_mileage != null)) && (
          <div className="flex-1">
            <label className="block text-xs text-[var(--color-text-muted)] mb-1">End Mileage</label>
            <input
              type="number"
              value={isReadOnly ? (wo.end_mileage ?? '') : endMileage}
              onChange={(e) => setEndMileage(e.target.value)}
              onBlur={handleEndBlur}
              readOnly={isReadOnly}
              placeholder="Odometer"
              className={`w-full border border-surface-border rounded-lg bg-surface-raised px-3 py-2 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
            />
            {endSaveStatus === 'saved' && (
              <div className="flex items-center gap-1 mt-1 text-xs text-emerald-600">
                <Check size={14} />
                Saved
              </div>
            )}
            {endSaveStatus === 'error' && (
              <p className="mt-1 text-xs text-red-600">Failed to save.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function TechnicianNoteField({ wo }: { wo: WorkOrder }) {
  const [value, setValue] = useState(wo.notes_technician ?? '')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')

  useEffect(() => {
    setValue(wo.notes_technician ?? '')
  }, [wo.notes_technician])

  useEffect(() => {
    if (saveStatus === 'saved') {
      const timer = setTimeout(() => setSaveStatus('idle'), 2000)
      return () => clearTimeout(timer)
    }
  }, [saveStatus])

  async function handleBlur() {
    if (value === (wo.notes_technician ?? '')) return
    const { error } = await supabase
      .from('work_orders')
      .update({ notes_technician: value || null })
      .eq('id', wo.id)
    setSaveStatus(error ? 'error' : 'saved')
  }

  const isReadOnly = wo.status === 'completed'

  return (
    <div className="mt-6 border-t border-surface-border pt-4">
      <label className="block text-sm font-semibold mb-2">Note for Technician</label>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        rows={3}
        readOnly={isReadOnly}
        placeholder={isReadOnly ? '' : 'Add instructions for the field crew...'}
        className={`w-full border border-surface-border rounded-lg bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
      />
      {saveStatus === 'saved' && (
        <div className="flex items-center gap-1 mt-1 text-xs text-emerald-600">
          <Check size={14} />
          Saved
        </div>
      )}
      {saveStatus === 'error' && (
        <p className="mt-1 text-xs text-red-600">Failed to save. Please try again.</p>
      )}
    </div>
  )
}

function DetailsTab({ wo, role, onAssignCrew }: { wo: WorkOrder; role: Role | null; onAssignCrew?: () => void }) {
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

      {canEdit(role) && <VehicleField wo={wo} />}

      <MileageFields wo={wo} />

      {role !== 'technician' && <TechnicianNoteField wo={wo} />}

      <CrewCard wo={wo} onAssign={onAssignCrew} />
    </div>
  )
}

interface SiteHistoryItem {
  id: string
  completion_date: string | null
  service_type_name: string | null
  work_order_crew: { id: string; team_member: { first_name: string; last_name: string } | null }[]
}

interface UpcomingItem {
  id: string
  status: WorkOrder['status']
  scheduled_date: string | null
  period_month: number | null
  period_year: number | null
  period_week: number | null
  service_type_name: string | null
}

function HistoryTab({ wo }: { wo: WorkOrder }) {
  const navigate = useNavigate()
  const [upcoming, setUpcoming] = useState<UpcomingItem[]>([])
  const [history, setHistory] = useState<SiteHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const upcomingQuery = supabase
      .from('work_orders')
      .select('id, status, scheduled_date, period_month, period_year, period_week, service_type:service_types(name)')
      .eq('service_agreement_id', wo.service_agreement_id)
      .in('status', ['unscheduled', 'tentative', 'scheduled'])
      .neq('id', wo.id)
      .order('scheduled_date', { ascending: true, nullsFirst: false })
      .order('period_year', { ascending: true })
      .order('period_month', { ascending: true })
      .limit(10)

    const historyQuery = wo.site_id
      ? supabase
          .from('work_orders')
          .select('id, completion_date, service_type:service_types(name), work_order_crew(id, team_member:team(first_name, last_name))')
          .eq('site_id', wo.site_id)
          .eq('status', 'completed')
          .neq('id', wo.id)
          .order('completion_date', { ascending: false })
          .limit(20)
      : null

    const [upcomingRes, historyRes] = await Promise.all([
      upcomingQuery,
      historyQuery ?? Promise.resolve({ data: null }),
    ])

    if (upcomingRes.data) {
      setUpcoming(upcomingRes.data.map((d: any) => ({
        id: d.id,
        status: d.status,
        scheduled_date: d.scheduled_date,
        period_month: d.period_month,
        period_year: d.period_year,
        period_week: d.period_week,
        service_type_name: d.service_type?.name ?? null,
      })))
    }

    if (historyRes.data) {
      setHistory(historyRes.data.map((d: any) => ({
        id: d.id,
        completion_date: d.completion_date,
        service_type_name: d.service_type?.name ?? null,
        work_order_crew: d.work_order_crew ?? [],
      })))
    }

    setIsLoading(false)
  }, [wo.service_agreement_id, wo.site_id, wo.id])

  useEffect(() => { fetchData() }, [fetchData])

  if (isLoading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold">Related Jobs</h2>

      {/* Upcoming section */}
      <div className="space-y-1">
        <h3 className="text-sm font-semibold mb-3">Upcoming</h3>
        {upcoming.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No upcoming jobs scheduled for this agreement.</p>
        ) : (
          upcoming.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(`/work-orders/${item.id}`)}
              className="w-full flex items-center justify-between py-2.5 px-2 -mx-2 rounded-lg hover:bg-surface-raised transition-colors min-h-[44px]"
            >
              <div className="flex items-center gap-3">
                <Badge status={item.status} />
                <span className="text-sm">{item.service_type_name || '—'}</span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {formatPeriodLabel(item)}
                </span>
                <span className="text-sm text-[var(--color-text-muted)]">
                  {item.scheduled_date ? formatDate(item.scheduled_date) : 'Unscheduled'}
                </span>
              </div>
              <ChevronRight size={16} className="text-[var(--color-text-muted)]" />
            </button>
          ))
        )}
      </div>

      {/* Past Visits section */}
      <div className="space-y-1">
        <h3 className="text-sm font-semibold mb-3">Past Visits</h3>
        {history.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No previous completed jobs for this site.</p>
        ) : (
          history.map((item) => {
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
          })
        )}
      </div>
    </div>
  )
}

function ProposalTab({ wo }: { wo: WorkOrder }) {
  const [lineItems, setLineItems] = useState<ServiceAgreementLineItem[]>([])
  const [agreementNotes, setAgreementNotes] = useState<{ notes_client: string | null; recommendation_notes: string | null; signed_pdf_url: string | null; proposal_pdf_url: string | null } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchProposalData() {
      const [lineItemsRes, agreementRes] = await Promise.all([
        supabase
          .from('service_agreement_line_items')
          .select('*, service_type:service_types(*)')
          .eq('agreement_id', wo.service_agreement_id)
          .order('sort_order', { ascending: true }),
        supabase
          .from('service_agreements')
          .select('notes_client, recommendation_notes, signed_pdf_url, proposal_pdf_url')
          .eq('id', wo.service_agreement_id)
          .single(),
      ])

      if (lineItemsRes.data) setLineItems(lineItemsRes.data as ServiceAgreementLineItem[])
      if (agreementRes.data) setAgreementNotes(agreementRes.data as any)
      setIsLoading(false)
    }
    fetchProposalData()
  }, [wo.service_agreement_id])

  if (isLoading) return <LoadingSpinner />

  const frequencyLabels: Record<string, string> = {
    one_time: 'One-Time',
    annual: 'Annual',
    monthly_seasonal: 'Monthly (Seasonal)',
    weekly_seasonal: 'Weekly (Seasonal)',
  }

  return (
    <div className="space-y-6">
      {/* Line items */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Proposal Line Items</h2>
        {lineItems.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No line items on this agreement.</p>
        ) : (
          <div className="space-y-4">
            {lineItems.map((li, idx) => {
              const sc = getServiceColor(li.service_type?.name)
              return (
                <div key={li.id} className="rounded-lg border border-surface-border p-3" style={{ borderLeft: `3px solid ${sc.border}` }}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="text-xs text-[var(--color-text-muted)] mr-2">#{idx + 1}</span>
                      <span className="text-sm font-semibold">
                        {li.service_type?.name ?? li.description ?? 'Service'}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-brand-green">
                      {formatCurrency(li.amount)}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-text-muted)] mb-2">
                    <span>Frequency: {frequencyLabels[li.frequency] ?? li.frequency}</span>
                    {li.acreage != null && <span>Acreage: {li.acreage}</span>}
                    {li.hours != null && <span>Hours: {li.hours}</span>}
                    {li.unit_rate != null && <span>Rate: {formatCurrency(li.unit_rate)}</span>}
                  </div>

                  {/* Sub-line items */}
                  {Array.isArray(li.line_items) && li.line_items.length > 0 && (
                    <div className="mt-2 pl-4 border-l-2 border-surface-border space-y-1">
                      {li.line_items.map((sub, i) => (
                        <p key={i} className="text-xs text-[var(--color-text-primary)]">
                          <span className="text-[var(--color-text-muted)] mr-1">{String.fromCharCode(65 + i)}.</span>
                          {sub}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Total */}
            <div className="flex justify-end pt-2 border-t border-surface-border">
              <p className="text-sm font-semibold">
                Total: <span className="text-brand-green">{formatCurrency(lineItems.reduce((sum, li) => sum + (li.amount ?? 0), 0))}</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Client notes */}
      {agreementNotes?.notes_client && (
        <div>
          <h2 className="text-sm font-semibold mb-2">Client Notes</h2>
          <p className="text-sm whitespace-pre-wrap">{agreementNotes.notes_client}</p>
        </div>
      )}

      {/* Recommendation notes */}
      {agreementNotes?.recommendation_notes && (
        <div>
          <h2 className="text-sm font-semibold mb-2">Recommendation / Warning</h2>
          <p className="text-sm whitespace-pre-wrap bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-900">
            {agreementNotes.recommendation_notes}
          </p>
        </div>
      )}

      {/* Signed document link */}
      {(agreementNotes?.signed_pdf_url || agreementNotes?.proposal_pdf_url) && (
        <div>
          <h2 className="text-sm font-semibold mb-2">Documents</h2>
          <div className="flex flex-wrap gap-2">
            {agreementNotes.signed_pdf_url && (
              <a
                href={agreementNotes.signed_pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm hover:bg-surface transition-colors text-brand-green"
              >
                <CheckCircle size={14} />
                View Signed Document
              </a>
            )}
            {agreementNotes.proposal_pdf_url && (
              <a
                href={agreementNotes.proposal_pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm hover:bg-surface transition-colors"
              >
                View Proposal PDF
              </a>
            )}
          </div>
        </div>
      )}

      {/* Link to full agreement */}
      <div className="pt-2 border-t border-surface-border">
        <Link
          to={`/agreements/${wo.service_agreement_id}`}
          className="text-sm text-brand-green hover:underline"
        >
          View Full Agreement →
        </Link>
      </div>
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

  function completeJob() {
    if (!workOrder) return
    // Switch to the Field tab — actual completion happens via "Mark Complete" inside the tab
    setActiveTab('field')
    window.scrollTo({ top: 0, behavior: 'smooth' })
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

      {isTechnician && workOrder.notes_technician && workOrder.notes_technician.trim() !== '' && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900">{workOrder.notes_technician}</p>
        </div>
      )}

      <Card padding={false}>
        <TabBar tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
        <div className="p-5">
          {activeTab === 'details' && <DetailsTab wo={workOrder} role={role ?? null} onAssignCrew={() => setShowAssignModal(true)} />}
          {activeTab === 'field' && <FieldTab wo={workOrder} teamMemberId={teamMember?.id ?? null} role={role ?? ''} onComplete={refetch} />}
          {activeTab === 'proposal' && <ProposalTab wo={workOrder} />}
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
