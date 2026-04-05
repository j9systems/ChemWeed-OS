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
import { canEdit } from '@/lib/roles'
import { supabase } from '@/lib/supabase'
import { getSupabaseErrorMessage } from '@/lib/utils'
import { getUrgencyColors } from '@/lib/constants'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { MaterialsSection, type MaterialRow } from '@/components/work-orders/MaterialsSection'
import { AgreementLineItemsSection, type LineItemRow, rowTotal } from '@/components/agreements/AgreementLineItemsSection'
import { NewClientModal } from '@/components/work-orders/NewClientModal'
import { NewSiteModal } from '@/components/work-orders/NewSiteModal'
import type { AgreementStatus } from '@/types/database'

export function AgreementNew() {
  const { role, user } = useAuth()
  const navigate = useNavigate()

  const { clients, refetch: refetchClients } = useClients()
  const { serviceTypes } = useServiceTypes()
  const { members } = useTeamMembers()
  const { urgencyLevels, defaultLevel } = useUrgencyLevels()

  const [clientId, setClientId] = useState('')
  const [siteId, setSiteId] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [showNewClientModal, setShowNewClientModal] = useState(false)
  const [showNewSiteModal, setShowNewSiteModal] = useState(false)
  const clientDropdownRef = useRef<HTMLDivElement>(null)
  const [serviceTypeId, setServiceTypeId] = useState('')
  const [proposedStartDate, setProposedStartDate] = useState('')
  const [contractStartDate, setContractStartDate] = useState('')
  const [contractEndDate, setContractEndDate] = useState('')
  const [contractValue, setContractValue] = useState('')
  const [billingMethod, setBillingMethod] = useState('')
  const [pcaId, setPcaId] = useState('')
  const [poNumber, setPoNumber] = useState('')
  const [reason, setReason] = useState('')
  const [commentClient, setCommentClient] = useState('')
  const [commentInternal, setCommentInternal] = useState('')
  const [commentTech, setCommentTech] = useState('')
  const [materials, setMaterials] = useState<MaterialRow[]>([])
  const [lineItems, setLineItems] = useState<LineItemRow[]>([])
  const [urgencyLevelId, setUrgencyLevelId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { sites, refetch: refetchSites } = useSites(clientId || undefined)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) {
        setShowClientDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filteredClients = clientSearch
    ? clients.filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase()))
    : clients

  const selectedClientName = clients.find((c) => c.id === clientId)?.name ?? ''

  const rickFoell = members.find((m) => m.role === 'pca')
  if (!pcaId && rickFoell) {
    setPcaId(rickFoell.id)
  }

  if (!urgencyLevelId && defaultLevel) {
    setUrgencyLevelId(defaultLevel.id)
  }

  if (!canEdit(role)) {
    return <Navigate to="/agreements" replace />
  }

  async function handleSubmit(e: FormEvent, status: AgreementStatus) {
    e.preventDefault()
    if (!clientId || !siteId || !serviceTypeId) {
      setError('Client, site, and service type are required.')
      return
    }

    setSubmitting(true)
    setError(null)

    const { data: sa, error: saErr } = await supabase
      .from('service_agreements')
      .insert({
        client_id: clientId,
        site_id: siteId,
        service_type_id: serviceTypeId,
        agreement_status: status,
        proposed_start_date: proposedStartDate || null,
        contract_start_date: contractStartDate || null,
        contract_end_date: contractEndDate || null,
        contract_value: contractValue ? parseFloat(contractValue) : null,
        billing_method: billingMethod || null,
        pca_id: pcaId || null,
        po_number: poNumber || null,
        reason: reason || null,
        urgency_level_id: urgencyLevelId || null,
        notes_client: commentClient || null,
        notes_internal: commentInternal || null,
        notes_technician: commentTech || null,
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
    const materialInserts = materials
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
    const lineItemInserts = lineItems
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
    const { error: genError } = await supabase.rpc('generate_work_orders_for_agreement', {
      p_agreement_id: sa.id
    })
    if (genError) {
      // Non-fatal -- WOs can be generated later via the manual button
      console.warn('WO generation warning:', genError.message)
    }

    setSubmitting(false)
    navigate(`/agreements/${sa.id}`)
  }

  return (
    <div>
      <Link to="/agreements" className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mb-4">
        <ArrowLeft size={16} />
        Back to Agreements
      </Link>

      <h1 className="text-2xl font-bold mb-6">New Agreement</h1>

      <form className="space-y-6" onSubmit={(e) => handleSubmit(e, 'draft')}>
        {/* Client & Site */}
        <Card>
          <div className="space-y-4">
            <div ref={clientDropdownRef}>
              <label className="block text-sm font-medium mb-1">Client *</label>
              <div className="relative">
                <input
                  type="text"
                  value={clientId ? selectedClientName : clientSearch}
                  onChange={(e) => {
                    setClientSearch(e.target.value)
                    setShowClientDropdown(true)
                    if (clientId) {
                      setClientId('')
                      setSiteId('')
                    }
                  }}
                  onFocus={() => setShowClientDropdown(true)}
                  placeholder="Search clients..."
                  className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
                />
                <input type="hidden" value={clientId} required />
                {showClientDropdown && (
                  <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-surface-border bg-white shadow-lg">
                    {filteredClients.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setClientId(c.id)
                            setSiteId('')
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
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm min-h-[44px]"
                required
                disabled={!clientId}
              >
                <option value="">{clientId ? 'Select site...' : 'Select a client first'}</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} — {s.address_line}</option>
                ))}
              </select>
              {clientId && (
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
            setClientId(client.id)
            setSiteId(site.id)
            setClientSearch('')
            refetchClients()
          }}
          onCancel={() => setShowNewClientModal(false)}
        />

        <NewSiteModal
          open={showNewSiteModal}
          clientId={clientId}
          clientName={selectedClientName}
          onSuccess={(site) => {
            setShowNewSiteModal(false)
            setSiteId(site.id)
            refetchSites()
          }}
          onCancel={() => setShowNewSiteModal(false)}
        />

        {/* Service Details */}
        <Card>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Service Type *</label>
              <select
                value={serviceTypeId}
                onChange={(e) => setServiceTypeId(e.target.value)}
                className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm min-h-[44px]"
                required
              >
                <option value="">Select service type...</option>
                {serviceTypes.map((st) => (
                  <option key={st.id} value={st.id}>{st.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Urgency</label>
              <div className="flex gap-2 flex-wrap">
                {urgencyLevels.map((level) => {
                  const colors = getUrgencyColors(level.key)
                  const isSelected = urgencyLevelId === level.id
                  return (
                    <button
                      key={level.id}
                      type="button"
                      onClick={() => setUrgencyLevelId(level.id)}
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
              value={proposedStartDate}
              onChange={(e) => setProposedStartDate(e.target.value)}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Contract Start Date"
                type="date"
                value={contractStartDate}
                onChange={(e) => setContractStartDate(e.target.value)}
              />
              <Input
                label="Contract End Date"
                type="date"
                value={contractEndDate}
                onChange={(e) => setContractEndDate(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Contract Value"
                type="number"
                step="0.01"
                value={contractValue}
                onChange={(e) => setContractValue(e.target.value)}
                placeholder="0.00"
              />
              <div>
                <label className="block text-sm font-medium mb-1">Billing Method</label>
                <select
                  value={billingMethod}
                  onChange={(e) => setBillingMethod(e.target.value)}
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
                value={pcaId}
                onChange={(e) => setPcaId(e.target.value)}
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

            <Input
              label="PO Number"
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              placeholder="Optional"
            />

            <div>
              <label className="block text-sm font-medium mb-1">Reason / Scope</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
                placeholder="Describe the reason and scope of work..."
              />
            </div>
          </div>
        </Card>

        {/* Materials */}
        <Card>
          <MaterialsSection rows={materials} onChange={setMaterials} />
        </Card>

        {/* Line Items */}
        <Card>
          <AgreementLineItemsSection rows={lineItems} onChange={setLineItems} />
        </Card>

        {/* Comments */}
        <Card>
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Comments</h3>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Client-Facing Comment</label>
              <textarea
                value={commentClient}
                onChange={(e) => setCommentClient(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Internal Comment</label>
              <textarea
                value={commentInternal}
                onChange={(e) => setCommentInternal(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Tech Instructions</label>
              <textarea
                value={commentTech}
                onChange={(e) => setCommentTech(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
              />
            </div>
          </div>
        </Card>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3">
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
        </div>
      </form>
    </div>
  )
}
