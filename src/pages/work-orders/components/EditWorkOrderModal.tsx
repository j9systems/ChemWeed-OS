import { useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useServiceTypes } from '@/hooks/useServiceTypes'
import { useTeamMembers } from '@/hooks/useTeam'
import { FREQUENCY_TYPES, WORK_ORDER_STATUSES } from '@/lib/constants'
import { supabase } from '@/lib/supabase'
import { getSupabaseErrorMessage } from '@/lib/utils'
import type { WorkOrder, WorkOrderStatus } from '@/types/database'

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
  const [status, setStatus] = useState<WorkOrderStatus>(workOrder.status)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
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
        status,
      })
      .eq('id', workOrder.id)

    if (err) {
      setError(getSupabaseErrorMessage(err))
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    onSaved()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Work Order">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as WorkOrderStatus)}
            className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm min-h-[44px]"
          >
            {Object.entries(WORK_ORDER_STATUSES).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Service Type</label>
          <select
            value={serviceTypeId}
            onChange={(e) => setServiceTypeId(e.target.value)}
            className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm min-h-[44px]"
          >
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
            className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
            placeholder="Describe the reason and scope of work..."
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
