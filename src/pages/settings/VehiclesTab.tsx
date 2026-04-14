import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { Vehicle } from '@/types/database'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Toast } from '@/components/ui/Toast'

const emptyVehicle: Partial<Vehicle> = {
  label: '',
  license_plate: '',
  notes: '',
  is_active: true,
}

export function VehiclesTab() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingVehicle, setEditingVehicle] = useState<Partial<Vehicle> | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const fetch = useCallback(async () => {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .order('label')
    if (error) {
      setToast({ message: error.message, type: 'error' })
    } else {
      setVehicles(data as Vehicle[])
    }
    setIsLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const handleSave = async () => {
    if (!editingVehicle?.label?.trim()) return
    setSaving(true)

    const payload = {
      label: editingVehicle.label.trim(),
      license_plate: editingVehicle.license_plate?.trim() || null,
      notes: editingVehicle.notes?.trim() || null,
      is_active: editingVehicle.is_active ?? true,
    }

    let error
    if (isNew) {
      ({ error } = await supabase.from('vehicles').insert(payload))
    } else {
      ({ error } = await supabase.from('vehicles').update(payload).eq('id', editingVehicle.id!))
    }

    setSaving(false)
    if (error) {
      setToast({ message: error.message, type: 'error' })
    } else {
      setToast({ message: isNew ? 'Vehicle added' : 'Vehicle updated', type: 'success' })
      setEditingVehicle(null)
      fetch()
    }
  }

  const toggleActive = async (vehicle: Vehicle) => {
    const { error } = await supabase
      .from('vehicles')
      .update({ is_active: !vehicle.is_active })
      .eq('id', vehicle.id)
    if (error) {
      setToast({ message: error.message, type: 'error' })
    } else {
      fetch()
    }
  }

  if (isLoading) return <LoadingSpinner />

  return (
    <>
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Vehicles</h2>
          <Button
            size="sm"
            onClick={() => { setEditingVehicle({ ...emptyVehicle }); setIsNew(true) }}
          >
            <Plus size={16} /> Add Vehicle
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border text-left text-[var(--color-text-muted)]">
                <th className="pb-2 pr-4 font-medium">Label</th>
                <th className="pb-2 pr-4 font-medium">License Plate</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr
                  key={v.id}
                  className="border-b border-surface-border/50 hover:bg-surface/50"
                >
                  <td className="py-3 pr-4 font-medium">{v.label}</td>
                  <td className="py-3 pr-4">{v.license_plate || '—'}</td>
                  <td className="py-3 pr-4">
                    <button
                      type="button"
                      onClick={() => toggleActive(v)}
                      className={cn(
                        'inline-block px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors',
                        v.is_active ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                      )}
                    >
                      {v.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="py-3">
                    <button
                      type="button"
                      onClick={() => { setEditingVehicle({ ...v }); setIsNew(false) }}
                      className="p-1 rounded hover:bg-surface-raised min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                      <Pencil size={14} className="text-[var(--color-text-muted)]" />
                    </button>
                  </td>
                </tr>
              ))}
              {vehicles.length === 0 && (
                <tr><td colSpan={4} className="py-8 text-center text-[var(--color-text-muted)]">No vehicles configured</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Edit Modal */}
      <Modal
        open={editingVehicle !== null}
        onClose={() => setEditingVehicle(null)}
        title={isNew ? 'Add Vehicle' : 'Edit Vehicle'}
      >
        {editingVehicle && (
          <div className="space-y-4">
            <Input
              label="Label"
              value={editingVehicle.label ?? ''}
              onChange={(e) => setEditingVehicle({ ...editingVehicle, label: e.target.value })}
              placeholder="e.g. Truck 1"
            />
            <Input
              label="License Plate"
              value={editingVehicle.license_plate ?? ''}
              onChange={(e) => setEditingVehicle({ ...editingVehicle, license_plate: e.target.value })}
            />
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Notes</label>
              <textarea
                className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm min-h-[72px] focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
                rows={3}
                value={editingVehicle.notes ?? ''}
                onChange={(e) => setEditingVehicle({ ...editingVehicle, notes: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="vehicle-active"
                checked={editingVehicle.is_active ?? true}
                onChange={(e) => setEditingVehicle({ ...editingVehicle, is_active: e.target.checked })}
                className="rounded border-surface-border h-4 w-4 accent-brand-green"
              />
              <label htmlFor="vehicle-active" className="text-sm">Active</label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setEditingVehicle(null)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !editingVehicle.label?.trim()}>
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
