import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router'
import { ArrowLeft, Edit } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useServiceAgreement } from '@/hooks/useServiceAgreement'
import { useServiceAgreementMaterials } from '@/hooks/useServiceAgreementMaterials'
import { useSiteProfile } from '@/hooks/useSiteProfile'
import { useSitePhotos } from '@/hooks/useSitePhotos'
import { useWorkOrders } from '@/hooks/useWorkOrders'
import { canEdit } from '@/lib/roles'
import { supabase } from '@/lib/supabase'
import { formatDate, formatCurrency, getSupabaseErrorMessage } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Card } from '@/components/ui/Card'
import { TabBar } from '@/pages/work-orders/components/TabBar'
import { SiteInfoCard } from '@/pages/work-orders/components/SiteInfoCard'
import { MaterialsSection, type MaterialRow } from '@/components/work-orders/MaterialsSection'
import { AgreementLineItemsSection, type LineItemRow, rowTotal } from '@/components/agreements/AgreementLineItemsSection'
import { AGREEMENT_STATUSES, getUrgencyColors, formatPeriodLabel, FREQUENCY_LABELS } from '@/lib/constants'
import { EditAgreementModal } from '@/components/agreements/EditAgreementModal'
import type { ServiceAgreement, ServiceAgreementLineItem, ServiceAgreementMaterial, WorkOrder } from '@/types/database'

const TABS = [
  { key: 'details', label: 'Details' },
  { key: 'estimate', label: 'Estimate' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'work_orders', label: 'Work Orders' },
  { key: 'notes', label: 'Notes' },
]

function DetailsSection({ agreement }: { agreement: ServiceAgreement }) {
  return (
    <div>
      <h2 className="text-sm font-semibold mb-3">Details</h2>
      <dl className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
        <DetailItem label="Client">{agreement.client?.name ?? '—'}</DetailItem>
        <DetailItem label="Site">{agreement.site?.name ?? '—'}</DetailItem>
        <DetailItem label="Status">{AGREEMENT_STATUSES[agreement.agreement_status]}</DetailItem>
        <DetailItem label="Urgency">
          {agreement.urgency_level ? (
            <span className={`inline-block rounded-full px-3 py-0.5 text-xs font-medium border ${
              (() => {
                const c = getUrgencyColors(agreement.urgency_level.key)
                return `${c.selectedBg} ${c.selectedText} ${c.selectedBorder}`
              })()
            }`}>
              {agreement.urgency_level.label}
            </span>
          ) : '—'}
        </DetailItem>
        <DetailItem label="Service Type">{agreement.service_type?.name ?? '—'}</DetailItem>
        <DetailItem label="Proposed Start">{formatDate(agreement.proposed_start_date)}</DetailItem>
        {agreement.contract_start_date && (
          <DetailItem label="Contract Start">{formatDate(agreement.contract_start_date)}</DetailItem>
        )}
        {agreement.contract_end_date && (
          <DetailItem label="Contract End">{formatDate(agreement.contract_end_date)}</DetailItem>
        )}
        {agreement.contract_value != null && (
          <DetailItem label="Contract Value">{formatCurrency(agreement.contract_value)}</DetailItem>
        )}
        {agreement.billing_method && (
          <DetailItem label="Billing Method">{agreement.billing_method.replace('_', ' ')}</DetailItem>
        )}
        <DetailItem label="PCA">
          {agreement.pca ? `${agreement.pca.first_name} ${agreement.pca.last_name}` : '—'}
        </DetailItem>
        <DetailItem label="PO Number">{agreement.po_number ?? '—'}</DetailItem>
        <div className="w-full">
          <DetailItem label="Reason / Scope">
            <span className="whitespace-pre-wrap">{agreement.reason ?? '—'}</span>
          </DetailItem>
        </div>
      </dl>
    </div>
  )
}

interface EstimateSectionProps {
  lineItems: ServiceAgreementLineItem[]
  materials: ServiceAgreementMaterial[]
  agreementId: string
  totalAcres?: number | null
  refetchLineItems: () => void
  refetchMaterials: () => void
}

function toMaterialRows(materials: ServiceAgreementMaterial[]): MaterialRow[] {
  return materials.map((m) => ({
    chemical_id: m.chemical_id ?? '',
    recommended_amount: m.recommended_amount != null ? String(m.recommended_amount) : '',
    recommended_unit: m.recommended_unit ?? '',
    chemical: m.chemical ?? undefined,
  }))
}

function toLineItemRows(items: ServiceAgreementLineItem[]): LineItemRow[] {
  return items.map((c) => ({
    is_manual_override: c.is_manual_override,
    service_type_id: c.service_type_id ?? '',
    service_type: c.service_type ?? undefined,
    acreage: c.acreage != null ? String(c.acreage) : '',
    hours: c.hours != null ? String(c.hours) : '',
    unit_rate: c.unit_rate != null ? String(c.unit_rate) : '',
    description: c.description ?? '',
    amount: c.amount != null ? String(c.amount) : '',
    line_items: Array.isArray(c.line_items) ? c.line_items : [],
    frequency: c.frequency ?? 'one_time',
    season_start_month: c.season_start_month ?? 5,
    season_end_month: c.season_end_month ?? 9,
  }))
}

function EstimateSection({ lineItems, materials, agreementId, totalAcres, refetchLineItems, refetchMaterials }: EstimateSectionProps) {
  const { role } = useAuth()
  const [editing, setEditing] = useState(false)
  const [materialRows, setMaterialRows] = useState<MaterialRow[]>(() => toMaterialRows(materials))
  const [liRows, setLiRows] = useState<LineItemRow[]>(() => toLineItemRows(lineItems))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const total = lineItems.reduce((sum, li) => sum + (li.amount ?? 0), 0)

  function handleEdit() {
    setMaterialRows(toMaterialRows(materials))
    setLiRows(toLineItemRows(lineItems))
    setEditing(true)
    setError(null)
  }

  function handleCancel() {
    setEditing(false)
    setError(null)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)

    // Delete existing materials and line items, then re-insert
    const { error: delMatErr } = await supabase
      .from('service_agreement_materials')
      .delete()
      .eq('agreement_id', agreementId)
    if (delMatErr) { setError(getSupabaseErrorMessage(delMatErr)); setSaving(false); return }

    const { error: delLiErr } = await supabase
      .from('service_agreement_line_items')
      .delete()
      .eq('agreement_id', agreementId)
    if (delLiErr) { setError(getSupabaseErrorMessage(delLiErr)); setSaving(false); return }

    // Insert materials
    const validMats = materialRows.filter((r) => r.chemical_id)
    if (validMats.length > 0) {
      const { error: matErr } = await supabase
        .from('service_agreement_materials')
        .insert(validMats.map((r) => ({
          agreement_id: agreementId,
          chemical_id: r.chemical_id,
          recommended_amount: r.recommended_amount ? parseFloat(r.recommended_amount) : null,
          recommended_unit: r.recommended_unit || null,
        })))
      if (matErr) { setError(getSupabaseErrorMessage(matErr)); setSaving(false); return }
    }

    // Insert line items
    const validLIs = liRows.filter((r) => r.is_manual_override ? r.description.trim() : r.service_type_id)
    if (validLIs.length > 0) {
      const { error: liErr } = await supabase
        .from('service_agreement_line_items')
        .insert(validLIs.map((r, idx) => {
          const lineItemsList = r.line_items.filter((li) => li.trim())
          const base = {
            agreement_id: agreementId,
            sort_order: idx,
            frequency: r.frequency,
            season_start_month: (r.frequency === 'monthly_seasonal' || r.frequency === 'weekly_seasonal') ? r.season_start_month : null,
            season_end_month: (r.frequency === 'monthly_seasonal' || r.frequency === 'weekly_seasonal') ? r.season_end_month : null,
            line_items: lineItemsList,
          }
          if (r.is_manual_override) {
            return { ...base, description: r.description.trim(), amount: parseFloat(r.amount) || 0, is_manual_override: true }
          }
          return {
            ...base,
            service_type_id: r.service_type_id,
            acreage: r.acreage ? parseFloat(r.acreage) : null,
            hours: r.hours ? parseFloat(r.hours) : null,
            unit_rate: r.unit_rate ? parseFloat(r.unit_rate) : null,
            amount: rowTotal(r),
            is_manual_override: false,
          }
        }))
      if (liErr) { setError(getSupabaseErrorMessage(liErr)); setSaving(false); return }
    }

    refetchMaterials()
    refetchLineItems()
    setEditing(false)
    setSaving(false)
  }

  // Editing mode
  if (editing) {
    return (
      <div className="space-y-6">
        <MaterialsSection rows={materialRows} onChange={setMaterialRows} totalAcres={totalAcres} />
        <div className="border-t border-surface-border pt-4">
          <AgreementLineItemsSection rows={liRows} onChange={setLiRows} totalAcres={totalAcres} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" size="sm" onClick={handleCancel} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </div>
      </div>
    )
  }

  // Read-only mode
  return (
    <div className="space-y-4">
      {canEdit(role) && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={handleEdit}>Edit Estimate</Button>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold mb-3">Materials</h2>
        {materials.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No materials.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border text-left text-[var(--color-text-muted)]">
                  <th className="pb-2 pr-4">Chemical</th>
                  <th className="pb-2 pr-4">Active Ingredient</th>
                  <th className="pb-2">Recommended</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((m) => (
                  <tr key={m.id} className="border-b border-surface-border last:border-0">
                    <td className="py-2 pr-4">{m.chemical?.name ?? '—'}</td>
                    <td className="py-2 pr-4 text-[var(--color-text-muted)]">{m.chemical?.active_ingredient ?? '—'}</td>
                    <td className="py-2">{m.recommended_amount ?? '—'} {m.recommended_unit ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="border-t border-surface-border pt-4">
        <h2 className="text-sm font-semibold mb-3">Line Items</h2>
        {lineItems.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No line items.</p>
        ) : (
          <>
            <div className="space-y-1">
              {lineItems.map((li) => (
                <div key={li.id}>
                  <div className="flex justify-between text-sm py-1">
                    <span>{li.is_manual_override ? (li.description || '—') : (li.service_type?.name || '—')}</span>
                    <span>{formatCurrency(li.amount)}</span>
                  </div>
                  {Array.isArray(li.line_items) && li.line_items.length > 0 && (
                    <ul className="ml-4 mb-1">
                      {li.line_items.map((item, j) => (
                        <li key={j} className="text-xs text-[var(--color-text-muted)] leading-snug">• {item}</li>
                      ))}
                    </ul>
                  )}
                  {li.frequency !== 'one_time' && (
                    <p className="text-xs text-[var(--color-text-muted)] ml-4">
                      {FREQUENCY_LABELS[li.frequency]}
                      {(li.frequency === 'monthly_seasonal' || li.frequency === 'weekly_seasonal') && li.season_start_month && li.season_end_month && (
                        <> ({['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][li.season_start_month - 1]}–{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][li.season_end_month - 1]})</>
                      )}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end border-t border-surface-border pt-2 mt-2">
              <p className="text-sm font-semibold">Total: {formatCurrency(total)}</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ScheduleSection({ agreement }: { agreement: ServiceAgreement }) {
  return (
    <div>
      <h2 className="text-sm font-semibold mb-3">Schedule</h2>
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-[var(--color-text-muted)]">Proposed Start Date</dt>
          <dd>{formatDate(agreement.proposed_start_date)}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-muted)]">Contract Start</dt>
          <dd>{formatDate(agreement.contract_start_date)}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-muted)]">Contract End</dt>
          <dd>{formatDate(agreement.contract_end_date)}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-muted)]">Assigned PCA</dt>
          <dd>{agreement.pca ? `${agreement.pca.first_name} ${agreement.pca.last_name}` : '—'}</dd>
        </div>
      </dl>
    </div>
  )
}

function WorkOrdersSection({ workOrders, lineItems }: { workOrders: WorkOrder[]; lineItems: ServiceAgreementLineItem[] }) {
  const navigate = useNavigate()

  if (workOrders.length === 0) {
    return <p className="text-sm text-[var(--color-text-muted)]">No work orders generated yet.</p>
  }

  // Group by line item
  const grouped = lineItems.map(li => ({
    lineItem: li,
    wos: workOrders.filter(wo => wo.agreement_line_item_id === li.id),
  })).filter(g => g.wos.length > 0)

  // Also show WOs not matched (shouldn't happen, but just in case)
  const matchedIds = new Set(grouped.flatMap(g => g.wos.map(wo => wo.id)))
  const unmatched = workOrders.filter(wo => !matchedIds.has(wo.id))

  return (
    <div className="space-y-4">
      {grouped.map(({ lineItem, wos }) => (
        <div key={lineItem.id}>
          <h3 className="text-sm font-semibold mb-2">
            {lineItem.is_manual_override ? lineItem.description : lineItem.service_type?.name ?? 'Line Item'}
            <span className="text-xs font-normal text-[var(--color-text-muted)] ml-2">
              ({FREQUENCY_LABELS[lineItem.frequency]})
            </span>
          </h3>
          <div className="space-y-1">
            {wos.map(wo => (
              <button
                key={wo.id}
                type="button"
                onClick={() => navigate(`/work-orders/${wo.id}`)}
                className="w-full flex items-center justify-between text-sm py-2 px-3 rounded-lg hover:bg-surface transition-colors text-left"
              >
                <span>{formatPeriodLabel(wo)}</span>
                <div className="flex items-center gap-2">
                  {wo.scheduled_date && (
                    <span className="text-xs text-[var(--color-text-muted)]">{formatDate(wo.scheduled_date)}</span>
                  )}
                  <Badge status={wo.status} />
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
      {unmatched.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Other</h3>
          {unmatched.map(wo => (
            <button
              key={wo.id}
              type="button"
              onClick={() => navigate(`/work-orders/${wo.id}`)}
              className="w-full flex items-center justify-between text-sm py-2 px-3 rounded-lg hover:bg-surface transition-colors text-left"
            >
              <span>{formatPeriodLabel(wo)}</span>
              <Badge status={wo.status} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function NotesSection({ agreement }: { agreement: ServiceAgreement }) {
  const hasAny = agreement.notes_client || agreement.notes_internal || agreement.notes_technician

  if (!hasAny) {
    return <p className="text-sm text-[var(--color-text-muted)]">No notes for this agreement.</p>
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold mb-2">Client Notes</h2>
        <p className="text-sm whitespace-pre-wrap">{agreement.notes_client || <span className="text-[var(--color-text-muted)]">—</span>}</p>
      </div>
      <div className="border-t border-surface-border pt-4">
        <h2 className="text-sm font-semibold mb-2">Internal Notes</h2>
        <p className="text-sm whitespace-pre-wrap">{agreement.notes_internal || <span className="text-[var(--color-text-muted)]">—</span>}</p>
      </div>
      <div className="border-t border-surface-border pt-4">
        <h2 className="text-sm font-semibold mb-2">Tech Instructions</h2>
        <p className="text-sm whitespace-pre-wrap">{agreement.notes_technician || <span className="text-[var(--color-text-muted)]">—</span>}</p>
      </div>
    </div>
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

export function AgreementDetail() {
  const { id } = useParams<{ id: string }>()
  const { role, user } = useAuth()
  const { agreement, lineItems, isLoading, error, refetch } = useServiceAgreement(id)
  const { materials, refetch: refetchMaterials } = useServiceAgreementMaterials(id)
  const { weedProfile, observationLogs, refetch: refetchSiteProfile } = useSiteProfile(agreement?.site_id)
  const { photos: sitePhotos, refetch: refetchPhotos } = useSitePhotos(agreement?.site_id)
  const { workOrders } = useWorkOrders()
  const [activeTab, setActiveTab] = useState('details')
  const [siteInfoOpen, setSiteInfoOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)

  // Filter WOs for this agreement
  const agreementWOs = workOrders.filter(wo => wo.service_agreement_id === id)

  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorMessage message={error} onRetry={refetch} />
  if (!agreement) return <ErrorMessage message="Agreement not found." />

  return (
    <div>
      <Link to="/agreements" className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mb-4">
        <ArrowLeft size={16} />
        Back to Agreements
      </Link>

      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">{agreement.client?.name} — {agreement.site?.name}</h1>
          <div className="mt-1">
            <Badge agreementStatus={agreement.agreement_status} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit(role) && (
            <Button variant="secondary" size="sm" onClick={() => setEditModalOpen(true)}>
              <Edit size={16} />
              Edit
            </Button>
          )}
        </div>
      </div>

      {agreement.site && (
        <SiteInfoCard
          site={agreement.site}
          weedProfile={weedProfile}
          observationLogs={observationLogs}
          sitePhotos={sitePhotos}
          isOpen={siteInfoOpen}
          onToggle={() => setSiteInfoOpen(!siteInfoOpen)}
          role={role}
          userId={user?.id}
          refetchSiteProfile={refetchSiteProfile}
          refetchPhotos={refetchPhotos}
        />
      )}

      <Card padding={false}>
        <TabBar tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
        <div className="p-5">
          {activeTab === 'details' && <DetailsSection agreement={agreement} />}
          {activeTab === 'estimate' && <EstimateSection lineItems={lineItems} materials={materials} agreementId={agreement.id} totalAcres={agreement.site?.total_acres} refetchLineItems={refetch} refetchMaterials={refetchMaterials} />}
          {activeTab === 'schedule' && <ScheduleSection agreement={agreement} />}
          {activeTab === 'work_orders' && <WorkOrdersSection workOrders={agreementWOs} lineItems={lineItems} />}
          {activeTab === 'notes' && <NotesSection agreement={agreement} />}
        </div>
      </Card>

      {editModalOpen && (
        <EditAgreementModal
          open={editModalOpen}
          agreement={agreement}
          onClose={() => setEditModalOpen(false)}
          onSaved={refetch}
        />
      )}
    </div>
  )
}
