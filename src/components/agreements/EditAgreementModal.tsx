import { useState, useEffect, useRef, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { getSupabaseErrorMessage } from '@/lib/utils'
import { useServiceTypes } from '@/hooks/useServiceTypes'
import { useTeamMembers } from '@/hooks/useTeam'
import { useUrgencyLevels } from '@/hooks/useUrgencyLevels'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'
import { useFormDraft } from '@/hooks/useFormDraft'
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

interface EditAgreementForm {
  selectedServiceTypeIds: string[]
  urgencyLevelId: string
  proposedStartDate: string
  contractStartDate: string
  contractEndDate: string
  contractValue: string
  billingMethod: string
  pcaId: string
  salesRepId: string
  poNumber: string
  boilerplateTemplateId: string
  reason: string
  disclaimer: string
}

function formFromAgreement(a: ServiceAgreement): EditAgreementForm {
  const seededIds = (a.service_type_ids?.length ?? 0) > 0
    ? a.service_type_ids
    : (a.service_type_id ? [a.service_type_id] : [])
  return {
    selectedServiceTypeIds: seededIds,
    urgencyLevelId: a.urgency_level_id ?? '',
    proposedStartDate: a.proposed_start_date ?? '',
    contractStartDate: a.contract_start_date ?? '',
    contractEndDate: a.contract_end_date ?? '',
    contractValue: a.contract_value != null ? String(a.contract_value) : '',
    billingMethod: a.billing_method ?? '',
    pcaId: a.pca_id ?? '',
    salesRepId: a.sales_rep_id ?? '',
    poNumber: a.po_number ?? '',
    boilerplateTemplateId: a.boilerplate_template_id ?? '',
    reason: a.reason ?? '',
    disclaimer: a.disclaimer ?? '',
  }
}

export function EditAgreementModal({ open, agreement, onClose, onSaved }: EditAgreementModalProps) {
  const { serviceTypes } = useServiceTypes()
  const { members } = useTeamMembers()
  const { urgencyLevels } = useUrgencyLevels()

  // Capture initial snapshot once per mount; realtime updates to `agreement`
  // should not flip isDirty or overwrite the user's typing.
  const initialSnapshotRef = useRef<EditAgreementForm | null>(null)
  if (initialSnapshotRef.current === null) {
    initialSnapshotRef.current = formFromAgreement(agreement)
  }
  const initialSnapshot = initialSnapshotRef.current

  const draftKey = `edit_agreement__${agreement.id}`
  const [form, setForm, clearForm] = useFormDraft<EditAgreementForm>(draftKey, initialSnapshot)

  const [draftNotice, setDraftNotice] = useState<boolean>(() => {
    try { return localStorage.getItem(`draft__${draftKey}`) !== null } catch { return false }
  })

  const [boilerplateTemplates, setBoilerplateTemplates] = useState<ProposalBoilerplateTemplate[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)

  const isDirty = JSON.stringify(form) !== JSON.stringify(initialSnapshot)
  useUnsavedChanges(isDirty)

  const poRequired = agreement.client?.po_required ?? false

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

  function update<K extends keyof EditAgreementForm>(key: K, value: EditAgreementForm[K]) {
    setForm({ ...form, [key]: value })
  }

  function handleCancel() {
    if (!isDirty) {
      clearForm()
      setDraftNotice(false)
      onClose()
      return
    }
    setConfirmingDiscard(true)
  }

  function handleDiscard() {
    clearForm()
    setDraftNotice(false)
    setConfirmingDiscard(false)
    onClose()
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (form.selectedServiceTypeIds.length === 0) {
      setError('At least one service type is required.')
      return
    }

    if (poRequired && !form.poNumber.trim()) {
      setError('PO Number is required for this client.')
      return
    }

    setSaving(true)
    setError(null)

    const { error: err } = await supabase
      .from('service_agreements')
      .update({
        service_type_id: form.selectedServiceTypeIds[0],
        service_type_ids: form.selectedServiceTypeIds,
        urgency_level_id: form.urgencyLevelId || null,
        proposed_start_date: form.proposedStartDate || null,
        contract_start_date: form.contractStartDate || null,
        contract_end_date: form.contractEndDate || null,
        contract_value: form.contractValue ? parseFloat(form.contractValue) : null,
        billing_method: form.billingMethod || null,
        pca_id: form.pcaId || null,
        sales_rep_id: form.salesRepId || null,
        po_number: form.poNumber || null,
        boilerplate_template_id: form.boilerplateTemplateId || null,
        reason: form.reason || null,
        disclaimer: form.disclaimer || null,
      })
      .eq('id', agreement.id)

    if (err) {
      setError(getSupabaseErrorMessage(err))
      setSaving(false)
      return
    }

    const datesChanged =
      form.contractStartDate !== (agreement.contract_start_date ?? '') ||
      form.contractEndDate !== (agreement.contract_end_date ?? '')
    if (datesChanged || agreement.agreement_status === 'active') {
      const { data: genData, error: genError } = await supabase.rpc('generate_work_orders_for_agreement', {
        p_agreement_id: agreement.id,
      })
      if (genError) {
        setError(`Agreement saved, but work order generation failed: ${genError.message}. Use the "Regenerate Work Orders" button on the agreement page to retry.`)
        setSaving(false)
        clearForm()
        setDraftNotice(false)
        onSaved()
        return
      }
      if ((genData as { reason?: string } | null)?.reason === 'po_required') {
        setError('Agreement saved. Work orders were not generated because this client requires a PO Number. Add the PO and regenerate.')
        setSaving(false)
        clearForm()
        setDraftNotice(false)
        onSaved()
        return
      }
    }

    setSaving(false)
    clearForm()
    setDraftNotice(false)
    onSaved()
    onClose()
  }

  return (
    <Modal open={open} onClose={handleCancel} title="Edit Agreement">
      {draftNotice && (
        <div className="flex items-center justify-between text-sm text-[var(--color-text-muted)] mb-3">
          <span>Draft restored.</span>
          <button
            type="button"
            onClick={() => { clearForm(); setDraftNotice(false) }}
            className="ml-2 hover:text-[var(--color-text-primary)]"
          >
            &times;
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
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
                    const next = isSelected
                      ? form.selectedServiceTypeIds.filter((id) => id !== st.id)
                      : [...form.selectedServiceTypeIds, st.id]
                    update('selectedServiceTypeIds', next)
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
            <p className="text-xs text-red-500 mt-1">Select at least one service type.</p>
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

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Contract Start"
            type="date"
            value={form.contractStartDate}
            onChange={(e) => update('contractStartDate', e.target.value)}
          />
          <Input
            label="Contract End"
            type="date"
            value={form.contractEndDate}
            onChange={(e) => update('contractEndDate', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Contract Value"
            type="number"
            step="0.01"
            value={form.contractValue}
            onChange={(e) => update('contractValue', e.target.value)}
          />
          <div>
            <label className="block text-sm font-medium mb-1">Billing Method</label>
            <select
              value={form.billingMethod}
              onChange={(e) => update('billingMethod', e.target.value)}
              className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm min-h-[44px]"
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
            className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm min-h-[44px]"
          >
            <option value="">None</option>
            {members.filter((m) => m.role === 'pca').map((m) => (
              <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Sales Rep</label>
          <select
            value={form.salesRepId}
            onChange={(e) => update('salesRepId', e.target.value)}
            className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm min-h-[44px]"
          >
            <option value="">None</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
            ))}
          </select>
        </div>

        <Input
          label={poRequired ? 'PO Number *' : 'PO Number'}
          value={form.poNumber}
          onChange={(e) => update('poNumber', e.target.value)}
          placeholder={poRequired ? 'Required for this client' : 'Optional'}
        />
        {poRequired && !form.poNumber.trim() && (
          <p className="text-xs text-amber-700 -mt-2">
            This client requires a PO Number on every agreement.
          </p>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Agreement Text</label>
          <select
            value={form.boilerplateTemplateId}
            onChange={(e) => update('boilerplateTemplateId', e.target.value)}
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
          {form.boilerplateTemplateId && (() => {
            const selected = boilerplateTemplates.find((t) => t.id === form.boilerplateTemplateId)
            return selected ? (
              <div className="mt-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-gray-600 max-h-32 overflow-y-auto whitespace-pre-wrap">
                {selected.body}
              </div>
            ) : null
          })()}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Reason / Scope</label>
          <textarea
            value={form.reason}
            onChange={(e) => update('reason', e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Disclaimer</label>
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

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        {confirmingDiscard && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 flex items-center justify-between gap-3">
            <span>Discard changes?</span>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setConfirmingDiscard(false)}>Keep</Button>
              <Button type="button" variant="danger" size="sm" onClick={handleDiscard}>Discard</Button>
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="secondary" onClick={handleCancel}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
        </div>
      </form>
    </Modal>
  )
}
