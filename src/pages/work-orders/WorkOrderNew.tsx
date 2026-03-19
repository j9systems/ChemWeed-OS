import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { useClients } from '@/hooks/useClients'
import { useSites } from '@/hooks/useSites'
import { useServiceTypes } from '@/hooks/useServiceTypes'
import { useTeamMembers } from '@/hooks/useTeam'
import { canEdit } from '@/lib/roles'
import { supabase } from '@/lib/supabase'
import { getSupabaseErrorMessage } from '@/lib/utils'
import { FREQUENCY_TYPES } from '@/lib/constants'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { MaterialsSection, type MaterialRow } from '@/components/work-orders/MaterialsSection'
import { ChargesSection, type ChargeRow } from '@/components/work-orders/ChargesSection'
import type { WorkOrderStatus } from '@/types/database'

export function WorkOrderNew() {
  const { role, user } = useAuth()
  const navigate = useNavigate()

  const { clients } = useClients()
  const { serviceTypes } = useServiceTypes()
  const { members } = useTeamMembers()

  const [clientId, setClientId] = useState('')
  const [siteId, setSiteId] = useState('')
  const [serviceTypeId, setServiceTypeId] = useState('')
  const [frequencyType, setFrequencyType] = useState('')
  const [proposedStartDate, setProposedStartDate] = useState('')
  const [pcaId, setPcaId] = useState('')
  const [poNumber, setPoNumber] = useState('')
  const [reason, setReason] = useState('')
  const [commentClient, setCommentClient] = useState('')
  const [commentInternal, setCommentInternal] = useState('')
  const [commentTech, setCommentTech] = useState('')
  const [materials, setMaterials] = useState<MaterialRow[]>([])
  const [charges, setCharges] = useState<ChargeRow[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { sites } = useSites(clientId || undefined)

  // Default PCA to Rick Foell if available
  const rickFoell = members.find((m) => m.role === 'pca')
  if (!pcaId && rickFoell) {
    setPcaId(rickFoell.id)
  }

  if (!canEdit(role)) {
    return <Navigate to="/work-orders" replace />
  }

  async function handleSubmit(e: FormEvent, status: WorkOrderStatus) {
    e.preventDefault()
    if (!clientId || !siteId || !serviceTypeId) {
      setError('Client, site, and service type are required.')
      return
    }

    setSubmitting(true)
    setError(null)

    const { data: wo, error: woErr } = await supabase
      .from('work_orders')
      .insert({
        client_id: clientId,
        site_id: siteId,
        service_type_id: serviceTypeId,
        frequency_type: frequencyType || null,
        status,
        proposed_start_date: proposedStartDate || null,
        pca_id: pcaId || null,
        po_number: poNumber || null,
        reason: reason || null,
        comment_client: commentClient || null,
        comment_internal: commentInternal || null,
        comment_tech: commentTech || null,
        created_by: user?.id ?? '',
      })
      .select('id')
      .single()

    if (woErr) {
      setError(getSupabaseErrorMessage(woErr))
      setSubmitting(false)
      return
    }

    // Insert materials
    const materialInserts = materials
      .filter((m) => m.chemical_id)
      .map((m) => ({
        work_order_id: wo.id,
        chemical_id: m.chemical_id,
        recommended_amount: parseFloat(m.recommended_amount) || null,
        recommended_unit: m.recommended_unit || null,
      }))

    if (materialInserts.length > 0) {
      const { error: matErr } = await supabase.from('work_order_materials').insert(materialInserts)
      if (matErr) {
        setError(getSupabaseErrorMessage(matErr))
        setSubmitting(false)
        return
      }
    }

    // Insert charges
    const chargeInserts = charges
      .filter((c) => c.description)
      .map((c) => ({
        work_order_id: wo.id,
        description: c.description,
        amount: parseFloat(c.amount) || 0,
      }))

    if (chargeInserts.length > 0) {
      const { error: chgErr } = await supabase.from('work_order_charges').insert(chargeInserts)
      if (chgErr) {
        setError(getSupabaseErrorMessage(chgErr))
        setSubmitting(false)
        return
      }
    }

    setSubmitting(false)
    navigate(`/work-orders/${wo.id}`)
  }

  return (
    <div>
      <Link to="/work-orders" className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mb-4">
        <ArrowLeft size={16} />
        Back to Work Orders
      </Link>

      <h1 className="text-2xl font-bold mb-6">New Work Order</h1>

      <form className="space-y-6" onSubmit={(e) => handleSubmit(e, 'draft')}>
        {/* Client & Site */}
        <Card>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Client *</label>
              <select
                value={clientId}
                onChange={(e) => { setClientId(e.target.value); setSiteId('') }}
                className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm min-h-[44px]"
                required
              >
                <option value="">Select client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
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
                  <option key={s.id} value={s.id}>{s.name} — {s.address}</option>
                ))}
              </select>
            </div>
          </div>
        </Card>

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
          </div>
        </Card>

        {/* Materials */}
        <Card>
          <MaterialsSection rows={materials} onChange={setMaterials} />
        </Card>

        {/* Charges */}
        <Card>
          <ChargesSection rows={charges} onChange={setCharges} />
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
            onClick={(e) => handleSubmit(e as unknown as FormEvent, 'scheduled')}
          >
            Submit as Scheduled
          </Button>
        </div>
      </form>
    </div>
  )
}
