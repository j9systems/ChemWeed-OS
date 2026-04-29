import { useState, useRef, useEffect, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { useClients } from '@/hooks/useClients'
import { useSites } from '@/hooks/useSites'
import { useServiceTypes } from '@/hooks/useServiceTypes'
import { useTeamMembers } from '@/hooks/useTeam'
import { useUrgencyLevels } from '@/hooks/useUrgencyLevels'
import { useFormDraft } from '@/hooks/useFormDraft'
import { canEdit } from '@/lib/roles'
import { supabase } from '@/lib/supabase'
import { getSupabaseErrorMessage } from '@/lib/utils'
import { getUrgencyColors } from '@/lib/constants'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { MaterialsSection, type MaterialRow } from '@/components/work-orders/MaterialsSection'
import { AgreementLineItemsSection, type LineItemRow, rowTotal, emptyCalculatedRow } from '@/components/agreements/AgreementLineItemsSection'
import { NewClientModal } from '@/components/work-orders/NewClientModal'
import { NewSiteModal } from '@/components/work-orders/NewSiteModal'
import type { AgreementStatus } from '@/types/database'

interface AgreementNewForm {
  isExternalImport: boolean
  clientId: string
  siteId: string
  selectedServiceTypeIds: string[]
  proposedStartDate: string
  contractStartDate: string
  contractEndDate: string
  contractValue: string
  billingMethod: string
  pcaId: string
  salesRepId: string
  poNumber: string
  reason: string
  commentClient: string
  commentInternal: string
  commentTech: string
  disclaimer: string
  materials: MaterialRow[]
  lineItems: LineItemRow[]
  urgencyLevelId: string
}

const EMPTY_FORM: AgreementNewForm = {
  isExternalImport: false,
  clientId: '',
  siteId: '',
  selectedServiceTypeIds: [],
  proposedStartDate: '',
  contractStartDate: '',
  contractEndDate: '',
  contractValue: '',
  billingMethod: '',
  pcaId: '',
  salesRepId: '',
  poNumber: '',
  reason: '',
  commentClient: '',
  commentInternal: '',
  commentTech: '',
  disclaimer: '',
  materials: [],
  lineItems: [],
  urgencyLevelId: '',
}

const DRAFT_KEY = 'new_agreement__draft'

// A draft in localStorage is "meaningful" only if the user has entered
// substantive data. Auto-defaulted PCA/urgency don't count — without this
// check, the "Draft restored" notice would appear on every fresh load.
function hasMeaningfulContent(parsed: Partial<AgreementNewForm>): boolean {
  return Boolean(
    parsed.clientId ||
    parsed.siteId ||
    (parsed.selectedServiceTypeIds?.length ?? 0) > 0 ||
    (parsed.lineItems?.length ?? 0) > 0 ||
    (parsed.materials?.length ?? 0) > 0 ||
    parsed.proposedStartDate ||
    parsed.contractStartDate ||
    parsed.contractEndDate ||
    parsed.contractValue ||
    parsed.billingMethod ||
    parsed.poNumber ||
    parsed.reason ||
    parsed.commentClient ||
    parsed.commentInternal ||
    parsed.commentTech ||
    parsed.isExternalImport,
  )
}

export function AgreementNew() {
  const { role, user } = useAuth()
  const navigate = useNavigate()

  const { clients, refetch: refetchClients } = useClients()
  const { serviceTypes } = useServiceTypes()
  const { members } = useTeamMembers()
  const { urgencyLevels, defaultLevel } = useUrgencyLevels()

  const [form, setForm, clearForm] = useFormDraft<AgreementNewForm>(DRAFT_KEY, EMPTY_FORM)

  const [draftNotice, setDraftNotice] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(`draft__${DRAFT_KEY}`)
      if (!raw) return false
      return hasMeaningfulContent(JSON.parse(raw) as Partial<AgreementNewForm>)
    } catch { return false }
  })

  // Pure UI state (not persisted)
  const [clientSearch, setClientSearch] = useState('')
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [showNewClientModal, setShowNewClientModal] = useState(false)
  const [showNewSiteModal, setShowNewSiteModal] = useState(false)
  const clientDropdownRef = useRef<HTMLDivElement>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { sites, refetch: refetchSites } = useSites(form.clientId || undefined)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) {
        setShowClientDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const rickFoell = members.find((m) => m.role === 'pca')
  useEffect(() => {
    if (!rickFoell) return
    setForm((prev) => prev.pcaId ? prev : { ...prev, pcaId: rickFoell.id })
  }, [rickFoell, setForm])

  useEffect(() => {
    if (!defaultLevel) return
    setForm((prev) => prev.urgencyLevelId ? prev : { ...prev, urgencyLevelId: defaultLevel.id })
  }, [defaultLevel, setForm])

  function update<K extends keyof AgreementNewForm>(key: K, value: AgreementNewForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const filteredClients = clientSearch
    ? clients.filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase()))
    : clients

  const selectedClientName = clients.find((c) => c.id === form.clientId)?.name ?? ''

  if (!canEdit(role)) {
    return <Navigate to="/agreements" replace />
  }

  async function handleSubmit(e: FormEvent, status: AgreementStatus) {
    e.preventDefault()
    if (!form.clientId || !form.siteId || form.selectedServiceTypeIds.length === 0) {
      setError('Client, site, and at least one service type are required.')
      return
    }

    if (form.isExternalImport && !form.contractStartDate) {
      setError('Contract Start Date is required for imported signed contracts.')
      return
    }

    setSubmitting(true)
    setError(null)

    // External imports skip the boilerplate template (no proposal will be generated).
    let defaultTemplateId: string | null = null
    if (!form.isExternalImport) {
      const { data: defaultTemplate } = await supabase
        .from('proposal_boilerplate_templates')
        .select('id')
        .eq('is_default', true)
        .eq('is_active', true)
        .maybeSingle()
      defaultTemplateId = defaultTemplate?.id ?? null
    }

    const effectiveStatus: AgreementStatus = form.isExternalImport ? 'active' : status

    const { data: sa, error: saErr } = await supabase
      .from('service_agreements')
      .insert({
        client_id: form.clientId,
        site_id: form.siteId,
        service_type_id: form.selectedServiceTypeIds[0],
        service_type_ids: form.selectedServiceTypeIds,
        agreement_status: effectiveStatus,
        signing_status: form.isExternalImport ? 'externally_signed' : null,
        signing_completed_at: form.isExternalImport ? new Date(form.contractStartDate).toISOString() : null,
        proposed_start_date: form.proposedStartDate || null,
        contract_start_date: form.contractStartDate || null,
        contract_end_date: form.contractEndDate || null,
        contract_value: form.contractValue ? parseFloat(form.contractValue) : null,
        billing_method: form.billingMethod || null,
        pca_id: form.pcaId || null,
        sales_rep_id: form.salesRepId || null,
        po_number: form.poNumber || null,
        boilerplate_template_id: defaultTemplateId,
        reason: form.reason || null,
        urgency_level_id: form.urgencyLevelId || null,
        notes_client: form.commentClient || null,
        notes_internal: form.commentInternal || null,
        notes_technician: form.commentTech || null,
        disclaimer: form.disclaimer || null,
        created_by: user?.id ?? '',
      })
      .select('id')
      .single()

    if (saErr) {
      setError(getSupabaseErrorMessage(saErr))
      setSubmitting(false)
      return
    }

    // Insert materials
    const materialInserts = form.materials
      .filter((m) => m.chemical_id)
      .map((m) => ({
        agreement_id: sa.id,
        chemical_id: m.chemical_id,
        recommended_amount: parseFloat(m.recommended_amount) || null,
        recommended_unit: m.recommended_unit || null,
      }))

    if (materialInserts.length > 0) {
      const { error: matErr } = await supabase.from('service_agreement_materials').insert(materialInserts)
      if (matErr) {
        setError(getSupabaseErrorMessage(matErr))
        setSubmitting(false)
        return
      }
    }

    // Insert line items
    const lineItemInserts = form.lineItems
      .filter((c) => c.is_manual_override ? c.description.trim() : c.service_type_id)
      .map((c, idx) => {
        const base = {
          agreement_id: sa.id,
          sort_order: idx,
          frequency: c.frequency,
          season_start_month: (c.frequency === 'monthly_seasonal' || c.frequency === 'weekly_seasonal') ? c.season_start_month : null,
          season_end_month: (c.frequency === 'monthly_seasonal' || c.frequency === 'weekly_seasonal') ? c.season_end_month : null,
          line_items: c.line_items.filter((li) => li.trim()),
        }
        if (c.is_manual_override) {
          return {
            ...base,
            description: c.description.trim(),
            amount: parseFloat(c.amount) || 0,
            is_manual_override: true,
          }
        }
        return {
          ...base,
          service_type_id: c.service_type_id,
          acreage: c.acreage ? parseFloat(c.acreage) : null,
          hours: c.hours ? parseFloat(c.hours) : null,
          unit_rate: c.unit_rate ? parseFloat(c.unit_rate) : null,
          amount: rowTotal(c),
          is_manual_override: false,
        }
      })

    if (lineItemInserts.length > 0) {
      const { error: liErr } = await supabase.from('service_agreement_line_items').insert(lineItemInserts)
      if (liErr) {
        setError(getSupabaseErrorMessage(liErr))
        setSubmitting(false)
        return
      }
    }

    // Generate all work orders for this agreement upfront
    const { data: genData, error: genError } = await supabase.rpc('generate_work_orders_for_agreement', {
      p_agreement_id: sa.id
    })
    const poGated = !genError && (genData as { reason?: string } | null)?.reason === 'po_required'

    if (form.isExternalImport) {
      await supabase.from('activities').insert({
        agreement_id: sa.id,
        activity_type: 'agreement_signed',
        title: 'External contract imported',
        description: 'Existing signed contract imported from outside ChemWeed-OS.',
        created_by: user?.id ?? null,
      })
    }

    clearForm()
    setDraftNotice(false)
    setSubmitting(false)
    const queryString = genError ? '?wo_gen_failed=1' : poGated ? '?wo_gen_po_required=1' : ''
    navigate(`/agreements/${sa.id}${queryString}`)
  }

  return (
    <div>
      <Link to="/agreements" className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mb-4">
        <ArrowLeft size={16} />
        Back to Agreements
      </Link>

      <h1 className="text-2xl font-bold mb-6">New Agreement</h1>

      {draftNotice && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm text-[var(--color-text-muted)]">
          <span>Draft restored.</span>
          <button
            type="button"
            onClick={() => { clearForm(); setDraftNotice(false) }}
            className="ml-2 hover:text-[var(--color-text-primary)]"
            aria-label="Dismiss and clear draft"
          >
            &times;
          </button>
        </div>
      )}

      <form className="space-y-6" onSubmit={(e) => handleSubmit(e, 'draft')}>
        <Card>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isExternalImport}
              onChange={(e) => update('isExternalImport', e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-surface-border text-brand-green focus:ring-brand-green"
            />
            <span>
              <span className="block text-sm font-medium">This is an existing signed contract (skip proposal + email)</span>
              <span className="block text-xs text-[var(--color-text-muted)] mt-0.5">
                Use this to import contracts that were signed outside ChemWeed-OS. The proposal PDF and eSign flow will not run.
              </span>
            </span>
          </label>
        </Card>

        {/* Client & Site */}
        <Card>
          <div className="space-y-4">
            <div ref={clientDropdownRef}>
              <label className="block text-sm font-medium mb-1">Client *</label>
              <div className="relative">
                <input
                  type="text"
                  value={form.clientId ? selectedClientName : clientSearch}
                  onChange={(e) => {
                    setClientSearch(e.target.value)
                    setShowClientDropdown(true)
                    if (form.clientId) {
                      setForm((prev) => ({ ...prev, clientId: '', siteId: '' }))
                    }
                  }}
                  onFocus={() => setShowClientDropdown(true)}
                  placeholder="Search clients..."
                  className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
                />
                <input type="hidden" value={form.clientId} required />
                {showClientDropdown && (
                  <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-surface-border bg-white shadow-lg">
                    {filteredClients.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setForm((prev) => ({ ...prev, clientId: c.id, siteId: '' }))
                            setClientSearch('')
                            setShowClientDropdown(false)
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-surface-raised"
                        >
                          {c.name}
                        </button>
                      </li>
                    ))}
                    <li className="border-t border-surface-border">
                      <button
                        type="button"
                        onClick={() => {
                          setShowClientDropdown(false)
                          setShowNewClientModal(true)
                        }}
                        className="w-full px-3 py-2 text-left text-sm font-medium text-brand-green hover:bg-surface-raised"
                      >
                        + Add New Client
                      </button>
                    </li>
                  </ul>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Site *</label>
              <select
                value={form.siteId}
                onChange={(e) => update('siteId', e.target.value)}
                className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm min-h-[44px]"
                required
                disabled={!form.clientId}
              >
                <option value="">{form.clientId ? 'Select site...' : 'Select a client first'}</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} — {s.address_line}</option>
                ))}
              </select>
              {form.clientId && (
                <button
                  type="button"
                  onClick={() => setShowNewSiteModal(true)}
                  className="mt-1 text-sm font-medium text-brand-green hover:underline"
                >
                  + Add New Site
                </button>
              )}
            </div>
          </div>
        </Card>

        <NewClientModal
          open={showNewClientModal}
          initialClientName={clientSearch}
          onSuccess={(client, site) => {
            setShowNewClientModal(false)
            setForm((prev) => ({ ...prev, clientId: client.id, siteId: site.id }))
            setClientSearch('')
            refetchClients()
          }}
          onCancel={() => setShowNewClientModal(false)}
        />

        <NewSiteModal
          open={showNewSiteModal}
          clientId={form.clientId}
          clientName={selectedClientName}
          onSuccess={(site) => {
            setShowNewSiteModal(false)
            update('siteId', site.id)
            refetchSites()
          }}
          onCancel={() => setShowNewSiteModal(false)}
        />

        {/* Service Details */}
        <Card>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Service Type(s) *</label>
              <div className="flex gap-2 flex-wrap">
                {serviceTypes.map((st) => {
                  const isSelected = form.selectedServiceTypeIds.includes(st.id)
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setForm((prev) => ({
                            ...prev,
                            selectedServiceTypeIds: prev.selectedServiceTypeIds.filter((id) => id !== st.id),
                          }))
                        } else {
                          const newRow = { ...emptyCalculatedRow(), service_type_id: st.id, service_type: st }
                          if (st.base_rate_low != null && st.base_rate_high != null) {
                            newRow.unit_rate = String(((st.base_rate_low + st.base_rate_high) / 2).toFixed(2))
                          }
                          if (st.default_scope_template) {
                            newRow.line_items = [st.default_scope_template]
                          }
                          setForm((prev) => ({
                            ...prev,
                            selectedServiceTypeIds: [...prev.selectedServiceTypeIds, st.id],
                            lineItems: [...prev.lineItems, newRow],
                          }))
                        }
                      }}
                      className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
                        isSelected
                          ? 'bg-[#2a6b2a]/10 text-[#2a6b2a] border-[#2a6b2a]'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:opacity-80'
                      }`}
                    >
                      {st.name}
                    </button>
                  )
                })}
              </div>
              {form.selectedServiceTypeIds.length === 0 && (
                <p className="text-xs text-[var(--color-text-muted)] mt-1">Select at least one service type.</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Urgency</label>
              <div className="flex gap-2 flex-wrap">
                {urgencyLevels.map((level) => {
                  const colors = getUrgencyColors(level.key)
                  const isSelected = form.urgencyLevelId === level.id
                  return (
                    <button
                      key={level.id}
                      type="button"
                      onClick={() => update('urgencyLevelId', level.id)}
                      className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
                        isSelected
                          ? `${colors.selectedBg} ${colors.selectedText} ${colors.selectedBorder}`
                          : `${colors.bg} ${colors.text} ${colors.border} hover:opacity-80`
                      }`}
                    >
                      {level.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <Input
              label="Proposed Start Date"
              type="date"
              value={form.proposedStartDate}
              onChange={(e) => update('proposedStartDate', e.target.value)}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label={form.isExternalImport ? 'Contract Start Date *' : 'Contract Start Date'}
                type="date"
                value={form.contractStartDate}
                onChange={(e) => update('contractStartDate', e.target.value)}
                required={form.isExternalImport}
              />
              <Input
                label="Contract End Date"
                type="date"
                value={form.contractEndDate}
                onChange={(e) => update('contractEndDate', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Contract Value"
                type="number"
                step="0.01"
                value={form.contractValue}
                onChange={(e) => update('contractValue', e.target.value)}
                placeholder="0.00"
              />
              <div>
                <label className="block text-sm font-medium mb-1">Billing Method</label>
                <select
                  value={form.billingMethod}
                  onChange={(e) => update('billingMethod', e.target.value)}
                  className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm min-h-[44px]"
                >
                  <option value="">Select...</option>
                  <option value="upfront">Upfront</option>
                  <option value="per_visit">Per Visit</option>
                  <option value="net_30">Net 30</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">PCA</label>
              <select
                value={form.pcaId}
                onChange={(e) => update('pcaId', e.target.value)}
                className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm min-h-[44px]"
              >
                <option value="">None</option>
                {members
                  .filter((m) => m.role === 'pca')
                  .map((m) => (
                    <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Sales Rep</label>
              <select
                value={form.salesRepId}
                onChange={(e) => update('salesRepId', e.target.value)}
                className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm min-h-[44px]"
              >
                <option value="">None</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                ))}
              </select>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                Credit for this sale. Defaults to none; used for commission tracking.
              </p>
            </div>

            <Input
              label="PO Number"
              value={form.poNumber}
              onChange={(e) => update('poNumber', e.target.value)}
              placeholder="Optional"
            />

            <div>
              <label className="block text-sm font-medium mb-1">Reason / Scope</label>
              <textarea
                value={form.reason}
                onChange={(e) => update('reason', e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
                placeholder="Describe the reason and scope of work..."
              />
            </div>
          </div>
        </Card>

        {/* Materials */}
        <Card>
          <MaterialsSection rows={form.materials} onChange={(rows) => update('materials', rows)} />
        </Card>

        {/* Line Items */}
        <Card>
          <AgreementLineItemsSection rows={form.lineItems} onChange={(rows) => update('lineItems', rows)} />
        </Card>

        {/* Comments */}
        <Card>
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Comments</h3>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Client-Facing Comment</label>
              <textarea
                value={form.commentClient}
                onChange={(e) => update('commentClient', e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Internal Comment</label>
              <textarea
                value={form.commentInternal}
                onChange={(e) => update('commentInternal', e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Tech Instructions</label>
              <textarea
                value={form.commentTech}
                onChange={(e) => update('commentTech', e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Disclaimer</label>
              <textarea
                value={form.disclaimer}
                onChange={(e) => update('disclaimer', e.target.value)}
                rows={3}
                placeholder="e.g. This is a one-time treatment and does not guarantee long-term weed control..."
                className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
              />
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                Appears on the proposal above the signature block.
              </p>
            </div>
          </div>
        </Card>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          {form.isExternalImport ? (
            <Button
              type="button"
              disabled={submitting}
              onClick={(e) => handleSubmit(e as unknown as FormEvent, 'active')}
            >
              {submitting ? 'Saving...' : 'Save Contract'}
            </Button>
          ) : (
            <>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving...' : 'Save as Draft'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={submitting}
                onClick={(e) => handleSubmit(e as unknown as FormEvent, 'active')}
              >
                Save as Active
              </Button>
            </>
          )}
        </div>
      </form>
    </div>
  )
}
