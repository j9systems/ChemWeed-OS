import { useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { getSupabaseErrorMessage } from '@/lib/utils'
import { FREQUENCY_TYPES } from '@/lib/constants'
import { useServiceTypes } from '@/hooks/useServiceTypes'
import { useTeamMembers } from '@/hooks/useTeam'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { WorkOrder } from '@/types/database'

interface EditWorkOrderModalProps {
  open: boolean
  workOrder: WorkOrder
  onClose: () => void
  onSaved: () => void
}

export function EditWorkOrderModal({ open, workOrder, onClose, onSaved }: EditWorkOrderModalProps) {
  const { serviceTypes } = useServiceTypes()
  const { members } = useTeamMembers()

  const [serviceTypeId, setServiceTypeId] = useState(workOrder.service_type_id)
  const [frequencyType, setFrequencyType] = useState(workOrder.frequency_type ?? '')
  const [proposedStartDate, setProposedStartDate] = useState(workOrder.proposed_start_date ?? '')
  const [pcaId, setPcaId] = useState(workOrder.pca_id ?? '')
  const [poNumber, setPoNumber] = useState(workOrder.po_number ?? '')
  const [reason, setReason] = useState(workOrder.reason ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!serviceTypeId) {
      setError('Service type is required.')
      return
    }

    setSaving(true)
    setError(null)

    const { error: err } = await supabase
      .from('work_orders')
      .update({
        service_type_id: serviceTypeId,
        frequency_type: frequencyType || null,
        proposed_start_date: proposedStartDate || null,
        pca_id: pcaId || null,
        po_number: poNumber || null,
        reason: reason || null,
      })
      .eq('id', workOrder.id)

    if (err) {
      setError(getSupabaseErrorMessage(err))
      setSaving(false)
      return
    }

    setSaving(false)
    onSaved()
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Work Order">
      <form onSubmit={handleSubmit} className="space-y-4">
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
          <label className="block text-sm font-medium mb-1">Frequency Type</label>
          <select
            value={frequencyType}
            onChange={(e) => setFrequencyType(e.target.value)}
            className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm min-h-[44px]"
          >
            <option value="">None</option>
            {FREQUENCY_TYPES.map((ft) => (
              <option key={ft} value={ft}>{ft}</option>
            ))}
          </select>
        </div>

        <Input
          label="Proposed Start Date"
          type="date"
          value={proposedStartDate}
          onChange={(e) => setProposedStartDate(e.target.value)}
        />

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
            className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
            placeholder="Describe the reason and scope of work..."
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
