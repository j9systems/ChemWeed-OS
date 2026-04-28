import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { ServiceType, PricingModel } from '@/types/database'
import { formatCurrency, cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Toast } from '@/components/ui/Toast'

const PRICING_OPTIONS = [
  { value: 'per_acre', label: 'Per Acre' },
  { value: 'per_hour', label: 'Per Hour' },
  { value: 'flat_rate', label: 'Flat Rate' },
  { value: 'per_visit', label: 'Per Visit' },
]

const emptyService: Partial<ServiceType> = {
  name: '',
  description: '',
  pricing_model: 'per_acre',
  base_rate_low: null,
  base_rate_high: null,
  default_scope_template: '',
  internal_notes: '',
  sort_order: null,
  is_active: true,
}

export function ServicesTab() {
  const [services, setServices] = useState<ServiceType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingService, setEditingService] = useState<Partial<ServiceType> | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [deletingService, setDeletingService] = useState<ServiceType | null>(null)
  const [deletingUsageCount, setDeletingUsageCount] = useState<number | null>(null)
  const [deletingConfirmInProgress, setDeletingConfirmInProgress] = useState(false)

  const fetch = useCallback(async () => {
    const { data, error } = await supabase
      .from('service_types')
      .select('*')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name')
    if (error) {
      setToast({ message: error.message, type: 'error' })
    } else {
      setServices(data as ServiceType[])
    }
    setIsLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  useEffect(() => {
    if (!deletingService) { setDeletingUsageCount(null); return }
    let cancelled = false
    setDeletingUsageCount(null)
    supabase
      .from('service_agreements')
      .select('id', { count: 'exact', head: true })
      .eq('service_type_id', deletingService.id)
      .eq('agreement_status', 'active')
      .then(({ count, error }) => {
        if (cancelled) return
        if (error) {
          setToast({ message: error.message, type: 'error' })
          setDeletingUsageCount(0)
        } else {
          setDeletingUsageCount(count ?? 0)
        }
      })
    return () => { cancelled = true }
  }, [deletingService])

  const handleConfirmDelete = async () => {
    if (!deletingService) return
    setDeletingConfirmInProgress(true)
    const { error } = await supabase
      .from('service_types')
      .update({ is_active: false })
      .eq('id', deletingService.id)
    setDeletingConfirmInProgress(false)
    if (error) {
      setToast({ message: error.message, type: 'error' })
    } else {
      setToast({ message: `Service type "${deletingService.name}" deleted`, type: 'success' })
      setDeletingService(null)
      fetch()
    }
  }

  const handleSave = async () => {
    if (!editingService?.name?.trim()) return
    setSaving(true)

    const payload = {
      name: editingService.name.trim(),
      description: editingService.description || null,
      pricing_model: editingService.pricing_model,
      base_rate_low: editingService.base_rate_low,
      base_rate_high: (editingService.pricing_model === 'flat_rate' || editingService.pricing_model === 'per_visit')
        ? editingService.base_rate_low // flat rate and per visit use single value
        : editingService.base_rate_high,
      default_scope_template: editingService.default_scope_template || null,
      internal_notes: editingService.internal_notes || null,
      sort_order: editingService.sort_order ?? null,
      is_active: editingService.is_active ?? true,
    }

    let error
    if (isNew) {
      ({ error } = await supabase.from('service_types').insert(payload))
    } else {
      ({ error } = await supabase.from('service_types').update(payload).eq('id', editingService.id!))
    }

    setSaving(false)
    if (error) {
      setToast({ message: error.message, type: 'error' })
    } else {
      setToast({ message: isNew ? 'Service added' : 'Service updated', type: 'success' })
      setEditingService(null)
      fetch()
    }
  }

  const rateLabel = (model: PricingModel) => {
    if (model === 'per_acre') return '/ acre'
    if (model === 'per_hour') return '/ hour'
    if (model === 'per_visit') return '/ visit'
    return 'flat'
  }

  if (isLoading) return <LoadingSpinner />

  return (
    <>
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Services</h2>
          <Button
            size="sm"
            onClick={() => { setEditingService({ ...emptyService }); setIsNew(true) }}
          >
            <Plus size={16} /> Add Service
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border text-left text-[var(--color-text-muted)]">
                <th className="pb-2 pr-4 font-medium w-10">#</th>
                <th className="pb-2 pr-4 font-medium">Name</th>
                <th className="pb-2 pr-4 font-medium">Pricing Model</th>
                <th className="pb-2 pr-4 font-medium">Rate Low</th>
                <th className="pb-2 pr-4 font-medium">Rate High</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 font-medium w-10"></th>
                <th className="pb-2 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-surface-border/50 hover:bg-surface/50 cursor-pointer"
                  onClick={() => { setEditingService({ ...s }); setIsNew(false) }}
                >
                  <td className="py-3 pr-4 text-[var(--color-text-muted)]">{s.sort_order ?? '—'}</td>
                  <td className="py-3 pr-4 font-medium">{s.name}</td>
                  <td className="py-3 pr-4">
                    {PRICING_OPTIONS.find(o => o.value === s.pricing_model)?.label ?? s.pricing_model}
                  </td>
                  <td className="py-3 pr-4">
                    {s.base_rate_low != null ? `${formatCurrency(s.base_rate_low)} ${rateLabel(s.pricing_model)}` : '—'}
                  </td>
                  <td className="py-3 pr-4">
                    {(s.pricing_model === 'flat_rate' || s.pricing_model === 'per_visit')
                      ? '—'
                      : s.base_rate_high != null
                        ? `${formatCurrency(s.base_rate_high)} ${rateLabel(s.pricing_model)}`
                        : '—'}
                  </td>
                  <td className="py-3 pr-4">
                    <span className={cn(
                      'inline-block px-2 py-0.5 rounded-full text-xs font-medium',
                      s.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600',
                    )}>
                      {s.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3">
                    <Pencil size={14} className="text-[var(--color-text-muted)]" />
                  </td>
                  <td className="py-3 pr-3">
                    {s.is_active && (
                      <button
                        type="button"
                        aria-label={`Delete ${s.name}`}
                        onClick={(e) => { e.stopPropagation(); setDeletingService(s) }}
                        className="text-[var(--color-text-muted)] hover:text-red-600 p-1 rounded transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {services.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-[var(--color-text-muted)]">No services configured</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Edit Modal */}
      <Modal
        open={editingService !== null}
        onClose={() => setEditingService(null)}
        title={isNew ? 'Add Service' : 'Edit Service'}
      >
        {editingService && (
          <div className="space-y-4">
            <Input
              label="Name"
              value={editingService.name ?? ''}
              onChange={(e) => setEditingService({ ...editingService, name: e.target.value })}
            />
            <div className="grid grid-cols-[1fr_80px] gap-3">
              <Input
                label="Description"
                value={editingService.description ?? ''}
                onChange={(e) => setEditingService({ ...editingService, description: e.target.value })}
              />
              <Input
                label="Sort #"
                type="number"
                value={editingService.sort_order ?? ''}
                onChange={(e) => setEditingService({ ...editingService, sort_order: e.target.value ? Number(e.target.value) : null })}
                placeholder="#"
              />
            </div>
            <Select
              label="Pricing Model"
              options={PRICING_OPTIONS}
              value={editingService.pricing_model ?? 'per_acre'}
              onChange={(e) => setEditingService({
                ...editingService,
                pricing_model: e.target.value as PricingModel,
              })}
            />
            {(editingService.pricing_model === 'flat_rate' || editingService.pricing_model === 'per_visit') ? (
              <Input
                label={editingService.pricing_model === 'per_visit' ? 'Rate Per Visit ($)' : 'Flat Rate ($)'}
                type="number"
                step="0.01"
                value={editingService.base_rate_low ?? ''}
                onChange={(e) => setEditingService({
                  ...editingService,
                  base_rate_low: e.target.value ? Number(e.target.value) : null,
                })}
              />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label={`Rate Low (${editingService.pricing_model === 'per_acre' ? '/ acre' : '/ hour'})`}
                  type="number"
                  step="0.01"
                  value={editingService.base_rate_low ?? ''}
                  onChange={(e) => setEditingService({
                    ...editingService,
                    base_rate_low: e.target.value ? Number(e.target.value) : null,
                  })}
                />
                <Input
                  label={`Rate High (${editingService.pricing_model === 'per_acre' ? '/ acre' : '/ hour'})`}
                  type="number"
                  step="0.01"
                  value={editingService.base_rate_high ?? ''}
                  onChange={(e) => setEditingService({
                    ...editingService,
                    base_rate_high: e.target.value ? Number(e.target.value) : null,
                  })}
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Default scope template</label>
              <textarea
                className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm min-h-[72px] focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
                rows={3}
                value={editingService.default_scope_template ?? ''}
                onChange={(e) => setEditingService({ ...editingService, default_scope_template: e.target.value })}
                placeholder="e.g. Mow approximately [X] acres, open field"
              />
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                Pre-fills the first line item when this service is added to an estimate. Art can edit or delete it on the job.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Internal Notes</label>
              <textarea
                className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
                value={editingService.internal_notes ?? ''}
                onChange={(e) => setEditingService({ ...editingService, internal_notes: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="service-active"
                checked={editingService.is_active ?? true}
                onChange={(e) => setEditingService({ ...editingService, is_active: e.target.checked })}
                className="rounded border-surface-border h-4 w-4 accent-brand-green"
              />
              <label htmlFor="service-active" className="text-sm">Active</label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setEditingService(null)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !editingService.name?.trim()}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={deletingService !== null}
        onClose={() => { if (!deletingConfirmInProgress) setDeletingService(null) }}
        title="Delete Service Type"
      >
        {deletingService && (
          <div className="space-y-4">
            <p className="text-sm">
              Delete service type <span className="font-semibold">"{deletingService.name}"</span>?
            </p>
            <p className="text-sm text-[var(--color-text-muted)]">
              {deletingUsageCount === null
                ? 'Checking usage...'
                : `Used by ${deletingUsageCount} active agreement${deletingUsageCount === 1 ? '' : 's'}.`}
            </p>
            {deletingUsageCount !== null && deletingUsageCount > 0 && (
              <p className="text-sm text-[var(--color-text-muted)]">
                Existing agreements will keep their current service type label. New agreements won't be able to select this one.
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2 border-t border-surface-border">
              <Button
                variant="secondary"
                onClick={() => setDeletingService(null)}
                disabled={deletingConfirmInProgress}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleConfirmDelete}
                disabled={deletingConfirmInProgress || deletingUsageCount === null}
              >
                {deletingConfirmInProgress ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  )
}
