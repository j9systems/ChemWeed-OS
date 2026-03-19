import { useState } from 'react'
import { useParams, Link } from 'react-router'
import { ArrowLeft, Edit, Play, CheckCircle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useWorkOrder } from '@/hooks/useWorkOrders'
import { useWorkOrderMaterials } from '@/hooks/useWorkOrderMaterials'
import { useWorkOrderCharges } from '@/hooks/useWorkOrderCharges'
import { canEdit, canCompleteField } from '@/lib/roles'
import { supabase } from '@/lib/supabase'
import { formatDate, formatCurrency, getSupabaseErrorMessage } from '@/lib/utils'
import { WORK_ORDER_STATUSES } from '@/lib/constants'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'

export function WorkOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const { role } = useAuth()
  const { workOrder, isLoading, error, refetch } = useWorkOrder(id)
  const { materials } = useWorkOrderMaterials(id)
  const { charges } = useWorkOrderCharges(id)
  const [updating, setUpdating] = useState(false)

  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorMessage message={error} onRetry={refetch} />
  if (!workOrder) return <ErrorMessage message="Work order not found." />

  async function updateStatus(newStatus: 'in_progress' | 'completed') {
    if (!workOrder) return
    setUpdating(true)
    const updates: Record<string, unknown> = { status: newStatus }
    if (newStatus === 'completed') {
      updates.completion_date = new Date().toISOString().split('T')[0]
    }
    const { error: err } = await supabase
      .from('work_orders')
      .update(updates)
      .eq('id', workOrder.id)

    if (err) {
      alert(getSupabaseErrorMessage(err))
    } else {
      refetch()
    }
    setUpdating(false)
  }

  const chargesTotal = charges.reduce((sum, c) => sum + c.amount, 0)

  return (
    <div>
      <Link to="/work-orders" className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mb-4">
        <ArrowLeft size={16} />
        Back to Work Orders
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{workOrder.client?.name}</h1>
          <p className="text-[var(--color-text-muted)]">{workOrder.site?.name} — {workOrder.site?.address_line}</p>
        </div>
        <Badge status={workOrder.status} />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 mb-6">
        {canEdit(role) && (
          <Button variant="secondary" size="sm">
            <Edit size={16} />
            Edit
          </Button>
        )}
        {workOrder.status === 'scheduled' && canCompleteField(role) && (
          <Button size="sm" onClick={() => updateStatus('in_progress')} disabled={updating}>
            <Play size={16} />
            Start Job
          </Button>
        )}
        {workOrder.status === 'in_progress' && canCompleteField(role) && (
          <Link to={`/work-orders/${workOrder.id}/complete`}>
            <Button size="sm">
              <CheckCircle size={16} />
              Complete Job
            </Button>
          </Link>
        )}
      </div>

      {/* Details */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <Card>
          <h2 className="text-sm font-semibold mb-3">Details</h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-[var(--color-text-muted)]">Status</dt>
              <dd>{WORK_ORDER_STATUSES[workOrder.status]}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-text-muted)]">Service Type</dt>
              <dd>{workOrder.service_type?.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-text-muted)]">Frequency</dt>
              <dd>{workOrder.frequency_type ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-text-muted)]">Proposed Start</dt>
              <dd>{formatDate(workOrder.proposed_start_date)}</dd>
            </div>
            {workOrder.completion_date && (
              <div>
                <dt className="text-[var(--color-text-muted)]">Completed</dt>
                <dd>{formatDate(workOrder.completion_date)}</dd>
              </div>
            )}
            <div>
              <dt className="text-[var(--color-text-muted)]">PO Number</dt>
              <dd>{workOrder.po_number ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-text-muted)]">PCA</dt>
              <dd>{workOrder.pca ? `${workOrder.pca.first_name} ${workOrder.pca.last_name}` : '—'}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold mb-3">Scope & Comments</h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-[var(--color-text-muted)]">Reason / Scope</dt>
              <dd className="whitespace-pre-wrap">{workOrder.reason ?? '—'}</dd>
            </div>
            {workOrder.notes_client && (
              <div>
                <dt className="text-[var(--color-text-muted)]">Client Comment</dt>
                <dd className="whitespace-pre-wrap">{workOrder.notes_client}</dd>
              </div>
            )}
            {workOrder.notes_internal && (
              <div>
                <dt className="text-[var(--color-text-muted)]">Internal Comment</dt>
                <dd className="whitespace-pre-wrap">{workOrder.notes_internal}</dd>
              </div>
            )}
            {workOrder.notes_technician && (
              <div>
                <dt className="text-[var(--color-text-muted)]">Tech Instructions</dt>
                <dd className="whitespace-pre-wrap">{workOrder.notes_technician}</dd>
              </div>
            )}
          </dl>
        </Card>
      </div>

      {/* Materials Table */}
      <Card className="mb-4">
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
                  <th className="pb-2 pr-4">Recommended</th>
                  <th className="pb-2">Actual Used</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((m) => (
                  <tr key={m.id} className="border-b border-surface-border last:border-0">
                    <td className="py-2 pr-4">{m.chemical?.name ?? '—'}</td>
                    <td className="py-2 pr-4 text-[var(--color-text-muted)]">{m.chemical?.active_ingredient ?? '—'}</td>
                    <td className="py-2 pr-4">{m.recommended_amount ?? '—'} {m.recommended_unit ?? ''}</td>
                    <td className="py-2">
                      {m.actual_amount_used != null ? `${m.actual_amount_used} (${m.tanks_used ?? 0} tanks)` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Charges Table */}
      <Card>
        <h2 className="text-sm font-semibold mb-3">Charges</h2>
        {charges.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No charges.</p>
        ) : (
          <>
            <div className="space-y-1">
              {charges.map((c) => (
                <div key={c.id} className="flex justify-between text-sm py-1">
                  <span>{c.description}</span>
                  <span>{formatCurrency(c.amount)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-end border-t border-surface-border pt-2 mt-2">
              <p className="text-sm font-semibold">Total: {formatCurrency(chargesTotal)}</p>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
