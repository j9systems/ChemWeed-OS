import { useState, useEffect, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { getSupabaseErrorMessage } from '@/lib/utils'
import { useServiceTypes } from '@/hooks/useServiceTypes'
import { useTeamMembers } from '@/hooks/useTeam'
import { useUrgencyLevels } from '@/hooks/useUrgencyLevels'
import { getUrgencyColors } from '@/lib/constants'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import type { ServiceAgreement, ProposalBoilerplateTemplate } from '@/types/database'

interface EditAgreementModalProps {
  open: boolean
  agreement: ServiceAgreement
  onClose: () => void
  onSaved: () => void
}

export function EditAgreementModal({ open, agreement, onClose, onSaved }: EditAgreementModalProps) {
  const { serviceTypes } = useServiceTypes()
  const { members } = useTeamMembers()
  const { urgencyLevels } = useUrgencyLevels()

  const [selectedServiceTypeIds, setSelectedServiceTypeIds] = useState<string[]>(
    agreement.service_type_id ? [agreement.service_type_id] : []
  )
  const [urgencyLevelId, setUrgencyLevelId] = useState(agreement.urgency_level_id ?? '')
  const [proposedStartDate, setProposedStartDate] = useState(agreement.proposed_start_date ?? '')
  const [contractStartDate, setContractStartDate] = useState(agreement.contract_start_date ?? '')
  const [contractEndDate, setContractEndDate] = useState(agreement.contract_end_date ?? '')
  const [contractValue, setContractValue] = useState(agreement.contract_value != null ? String(agreement.contract_value) : '')
  const [billingMethod, setBillingMethod] = useState(agreement.billing_method ?? '')
  const [pcaId, setPcaId] = useState(agreement.pca_id ?? '')
  const [poNumber, setPoNumber] = useState(agreement.po_number ?? '')
  const [boilerplateTemplateId, setBoilerplateTemplateId] = useState(agreement.boilerplate_template_id ?? '')
  const [boilerplateTemplates, setBoilerplateTemplates] = useState<ProposalBoilerplateTemplate[]>([])
  const [reason, setReason] = useState(agreement.reason ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('proposal_boilerplate_templates')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .order('name')
      .then(({ data }) => {
        if (data) setBoilerplateTemplates(data as ProposalBoilerplateTemplate[])
      })
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (selectedServiceTypeIds.length === 0) {
      setError('At least one service type is required.')
      return
    }

    setSaving(true)
    setError(null)

    const { error: err } = await supabase
      .from('service_agreements')
      .update({
        service_type_id: selectedServiceTypeIds[0],
        // TODO: save all selected service type IDs to service_type_ids uuid[] column if/when it exists
        urgency_level_id: urgencyLevelId || null,
        proposed_start_date: proposedStartDate || null,
        contract_start_date: contractStartDate || null,
        contract_end_date: contractEndDate || null,
        contract_value: contractValue ? parseFloat(contractValue) : null,
        billing_method: billingMethod || null,
        pca_id: pcaId || null,
        po_number: poNumber || null,
        boilerplate_template_id: boilerplateTemplateId || null,
        reason: reason || null,
      })
      .eq('id', agreement.id)

    if (err) {
      setError(getSupabaseErrorMessage(err))
      setSaving(false)
      return
    }

    // Regenerate WOs if contract dates changed or agreement is active
    const datesChanged = contractStartDate !== (agreement.contract_start_date ?? '') ||
      contractEndDate !== (agreement.contract_end_date ?? '')
    if (datesChanged || agreement.agreement_status === 'active') {
      const { error: genError } = await supabase.rpc('generate_work_orders_for_agreement', {
        p_agreement_id: agreement.id
      })
      if (genError) {
        setError(`Agreement saved, but work order generation failed: ${genError.message}. Use the "Regenerate Work Orders" button on the agreement page to retry.`)
        setSaving(false)
        onSaved()
        return
      }
    }

    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Agreement">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Service Type(s) *</label>
          <div className="flex gap-2 flex-wrap">
            {serviceTypes.map((st) => {
              const isSelected = selectedServiceTypeIds.includes(st.id)
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      setSelectedServiceTypeIds((prev) => prev.filter((id) => id !== st.id))
                    } else {
                      setSelectedServiceTypeIds((prev) => [...prev, st.id])
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
          {selectedServiceTypeIds.length === 0 && (
            <p className="text-xs text-red-500 mt-1">Select at least one service type.</p>
          )}
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

        <Input label="Proposed Start Date" type="date" value={proposedStartDate} onChange={(e) => setProposedStartDate(e.target.value)} />

        <div className="grid grid-cols-2 gap-3">
          <Input label="Contract Start" type="date" value={contractStartDate} onChange={(e) => setContractStartDate(e.target.value)} />
          <Input label="Contract End" type="date" value={contractEndDate} onChange={(e) => setContractEndDate(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Contract Value" type="number" step="0.01" value={contractValue} onChange={(e) => setContractValue(e.target.value)} />
          <div>
            <label className="block text-sm font-medium mb-1">Billing Method</label>
            <select value={billingMethod} onChange={(e) => setBillingMethod(e.target.value)} className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm min-h-[44px]">
              <option value="">Select...</option>
              <option value="upfront">Upfront</option>
              <option value="per_visit">Per Visit</option>
              <option value="net_30">Net 30</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">PCA</label>
          <select value={pcaId} onChange={(e) => setPcaId(e.target.value)} className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm min-h-[44px]">
            <option value="">None</option>
            {members.filter((m) => m.role === 'pca').map((m) => (
              <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
            ))}
          </select>
        </div>

        <Input label="PO Number" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="Optional" />

        <div>
          <label className="block text-sm font-medium mb-1">Agreement Text</label>
          <select
            value={boilerplateTemplateId}
            onChange={(e) => setBoilerplateTemplateId(e.target.value)}
            className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm min-h-[44px]"
          >
            <option value="">None</option>
            {boilerplateTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}{t.is_default ? ' (default)' : ''}
              </option>
            ))}
          </select>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Boilerplate paragraph that appears above line items on the proposal PDF.
          </p>
          {boilerplateTemplateId && (() => {
            const selected = boilerplateTemplates.find(t => t.id === boilerplateTemplateId)
            return selected ? (
              <div className="mt-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-gray-600 max-h-32 overflow-y-auto whitespace-pre-wrap">
                {selected.body}
              </div>
            ) : null
          })()}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Reason / Scope</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green" />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
        </div>
      </form>
    </Modal>
  )
}
