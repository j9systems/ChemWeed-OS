import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Chemical } from '@/types/database'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Toast } from '@/components/ui/Toast'

const UNIT_OPTIONS = [
  { value: 'fl_oz', label: 'fl oz' },
  { value: 'pt', label: 'pt' },
  { value: 'qt', label: 'qt' },
  { value: 'gal', label: 'gal' },
]

const USE_TYPE_OPTIONS = [
  { value: 'pre_emergent', label: 'Pre-Emergent' },
  { value: 'post_emergent', label: 'Post-Emergent' },
  { value: 'bare_ground', label: 'Bare Ground' },
  { value: 'broadleaf', label: 'Broadleaf' },
  { value: 'aquatic', label: 'Aquatic' },
]

const USE_TYPE_COLORS: Record<string, string> = {
  pre_emergent: 'bg-blue-100 text-blue-800',
  post_emergent: 'bg-green-100 text-green-800',
  bare_ground: 'bg-amber-100 text-amber-800',
  broadleaf: 'bg-purple-100 text-purple-800',
  aquatic: 'bg-cyan-100 text-cyan-800',
}

const emptyChemical: Partial<Chemical> = {
  name: '',
  manufacturer: '',
  active_ingredient: '',
  epa_reg_number: '',
  default_unit: 'fl_oz',
  default_rate_per_100gal: null,
  default_rate_unit: null,
  cost_per_unit: null,
  max_rate_per_100gal: null,
  reapplication_interval_days: null,
  use_types: [],
  notes: '',
  is_active: true,
}

export function ChemicalsTab() {
  const [chemicals, setChemicals] = useState<Chemical[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Chemical> | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const fetch = useCallback(async () => {
    const { data, error } = await supabase.from('chemicals').select('*').order('name')
    if (error) setToast({ message: error.message, type: 'error' })
    else setChemicals(data as Chemical[])
    setIsLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const handleSave = async () => {
    if (!editing?.name?.trim()) return
    setSaving(true)

    const payload = {
      name: editing.name.trim(),
      manufacturer: editing.manufacturer || null,
      active_ingredient: editing.active_ingredient || null,
      epa_reg_number: editing.epa_reg_number || null,
      default_unit: editing.default_unit || null,
      default_rate_per_100gal: editing.default_rate_per_100gal,
      default_rate_unit: editing.default_rate_unit || null,
      cost_per_unit: editing.cost_per_unit ?? null,
      max_rate_per_100gal: editing.max_rate_per_100gal,
      reapplication_interval_days: editing.reapplication_interval_days,
      use_types: editing.use_types ?? [],
      notes: editing.notes || null,
      is_active: editing.is_active ?? true,
    }

    let error
    if (isNew) {
      ({ error } = await supabase.from('chemicals').insert(payload))
    } else {
      ({ error } = await supabase.from('chemicals').update(payload).eq('id', editing.id!))
    }

    setSaving(false)
    if (error) {
      setToast({ message: error.message, type: 'error' })
    } else {
      setToast({ message: isNew ? 'Chemical added' : 'Chemical updated', type: 'success' })
      setEditing(null)
      fetch()
    }
  }

  const toggleUseType = (type: string) => {
    if (!editing) return
    const current = editing.use_types ?? []
    const next = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type]
    setEditing({ ...editing, use_types: next })
  }

  if (isLoading) return <LoadingSpinner />

  return (
    <>
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Chemicals</h2>
          <Button size="sm" onClick={() => { setEditing({ ...emptyChemical }); setIsNew(true) }}>
            <Plus size={16} /> Add Chemical
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border text-left text-[var(--color-text-muted)]">
                <th className="pb-2 pr-4 font-medium">Name</th>
                <th className="pb-2 pr-4 font-medium">Active Ingredient</th>
                <th className="pb-2 pr-4 font-medium">Default Rate</th>
                <th className="pb-2 pr-4 font-medium">Unit</th>
                <th className="pb-2 pr-4 font-medium">Reapply</th>
                <th className="pb-2 pr-4 font-medium">Use Types</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {chemicals.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-surface-border/50 hover:bg-surface/50 cursor-pointer"
                  onClick={() => { setEditing({ ...c }); setIsNew(false) }}
                >
                  <td className="py-3 pr-4 font-medium">{c.name}</td>
                  <td className="py-3 pr-4">{c.active_ingredient ?? '—'}</td>
                  <td className="py-3 pr-4">{c.default_rate_per_100gal != null ? `${c.default_rate_per_100gal} / 100 gal` : '—'}</td>
                  <td className="py-3 pr-4">{c.default_unit ?? '—'}</td>
                  <td className="py-3 pr-4">{c.reapplication_interval_days != null ? `${c.reapplication_interval_days} days` : '—'}</td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap gap-1">
                      {c.use_types?.map((t) => (
                        <span
                          key={t}
                          className={cn('inline-block px-2 py-0.5 rounded-full text-xs font-medium', USE_TYPE_COLORS[t] ?? 'bg-gray-100 text-gray-700')}
                        >
                          {USE_TYPE_OPTIONS.find(o => o.value === t)?.label ?? t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={cn(
                      'inline-block px-2 py-0.5 rounded-full text-xs font-medium',
                      c.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600',
                    )}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3"><Pencil size={14} className="text-[var(--color-text-muted)]" /></td>
                </tr>
              ))}
              {chemicals.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-[var(--color-text-muted)]">No chemicals configured</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={isNew ? 'Add Chemical' : 'Edit Chemical'}
      >
        {editing && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <Input
              label="Name"
              value={editing.name ?? ''}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
            <Input
              label="Manufacturer"
              value={editing.manufacturer ?? ''}
              onChange={(e) => setEditing({ ...editing, manufacturer: e.target.value })}
            />
            <Input
              label="Active Ingredient"
              value={editing.active_ingredient ?? ''}
              onChange={(e) => setEditing({ ...editing, active_ingredient: e.target.value })}
            />
            <Input
              label="EPA Reg Number"
              value={editing.epa_reg_number ?? ''}
              onChange={(e) => setEditing({ ...editing, epa_reg_number: e.target.value })}
            />
            <Select
              label="Default Unit"
              options={UNIT_OPTIONS}
              value={editing.default_unit ?? 'fl_oz'}
              onChange={(e) => setEditing({ ...editing, default_unit: e.target.value })}
            />
            <Input
              label="Default Rate (per 100 gal)"
              type="number"
              step="0.01"
              value={editing.default_rate_per_100gal ?? ''}
              onChange={(e) => setEditing({ ...editing, default_rate_per_100gal: e.target.value ? Number(e.target.value) : null })}
            />
            <Input
              label="Cost per unit (what we pay)"
              type="number"
              step="0.01"
              value={editing.cost_per_unit ?? ''}
              onChange={(e) => setEditing({ ...editing, cost_per_unit: e.target.value ? Number(e.target.value) : null })}
              placeholder="$"
            />
            <Input
              label="Max rate — compliance cap (per 100 gal)"
              type="number"
              step="0.01"
              value={editing.max_rate_per_100gal ?? ''}
              onChange={(e) => setEditing({ ...editing, max_rate_per_100gal: e.target.value ? Number(e.target.value) : null })}
            />
            <Input
              label="Reapplication Interval (days)"
              type="number"
              value={editing.reapplication_interval_days ?? ''}
              onChange={(e) => setEditing({ ...editing, reapplication_interval_days: e.target.value ? Number(e.target.value) : null })}
            />
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">Use Types</label>
              <div className="flex flex-wrap gap-2">
                {USE_TYPE_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={editing.use_types?.includes(opt.value) ?? false}
                      onChange={() => toggleUseType(opt.value)}
                      className="rounded border-surface-border h-4 w-4 accent-brand-green"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Notes</label>
              <textarea
                className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
                value={editing.notes ?? ''}
                onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="chem-active"
                checked={editing.is_active ?? true}
                onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                className="rounded border-surface-border h-4 w-4 accent-brand-green"
              />
              <label htmlFor="chem-active" className="text-sm">Active</label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !editing.name?.trim()}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  )
}
