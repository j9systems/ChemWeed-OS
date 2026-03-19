import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { canEdit } from '@/lib/roles'
import { useAuth } from '@/hooks/useAuth'
import { formatCurrency, getSupabaseErrorMessage } from '@/lib/utils'
import { MaterialsSection, type MaterialRow } from '@/components/work-orders/MaterialsSection'
import { ChargesSection, type ChargeRow } from '@/components/work-orders/ChargesSection'
import { Button } from '@/components/ui/Button'
import type { WorkOrderMaterial, WorkOrderCharge, SiteWeedProfile } from '@/types/database'

interface EstimateTabProps {
  materials: WorkOrderMaterial[]
  charges: WorkOrderCharge[]
  weedProfile: SiteWeedProfile[]
  workOrderId: string
  refetchMaterials: () => void
  refetchCharges: () => void
}

function toMaterialRows(materials: WorkOrderMaterial[]): MaterialRow[] {
  return materials.map((m) => ({
    chemical_id: m.chemical_id ?? '',
    recommended_amount: m.recommended_amount != null ? String(m.recommended_amount) : '',
    recommended_unit: m.recommended_unit ?? '',
    chemical: m.chemical ?? undefined,
  }))
}

function toChargeRows(charges: WorkOrderCharge[]): ChargeRow[] {
  return charges.map((c) => ({
    description: c.description ?? '',
    amount: c.amount != null ? String(c.amount) : '',
  }))
}

export function EstimateTab({ materials, charges, weedProfile, workOrderId, refetchMaterials, refetchCharges }: EstimateTabProps) {
  const { role } = useAuth()
  const [editing, setEditing] = useState(false)
  const [materialRows, setMaterialRows] = useState<MaterialRow[]>(() => toMaterialRows(materials))
  const [chargeRows, setChargeRows] = useState<ChargeRow[]>(() => toChargeRows(charges))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const chargesTotal = charges.reduce((sum, c) => sum + c.amount, 0)

  function handleEdit() {
    setMaterialRows(toMaterialRows(materials))
    setChargeRows(toChargeRows(charges))
    setEditing(true)
    setError(null)
  }

  function handleCancel() {
    setEditing(false)
    setError(null)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)

    // Delete existing materials and charges, then re-insert
    const { error: delMatErr } = await supabase
      .from('work_order_materials')
      .delete()
      .eq('work_order_id', workOrderId)

    if (delMatErr) {
      setError(getSupabaseErrorMessage(delMatErr))
      setSaving(false)
      return
    }

    const { error: delChgErr } = await supabase
      .from('work_order_charges')
      .delete()
      .eq('work_order_id', workOrderId)

    if (delChgErr) {
      setError(getSupabaseErrorMessage(delChgErr))
      setSaving(false)
      return
    }

    // Insert new materials
    const validMaterials = materialRows.filter((r) => r.chemical_id)
    if (validMaterials.length > 0) {
      const { error: matErr } = await supabase
        .from('work_order_materials')
        .insert(
          validMaterials.map((r) => ({
            work_order_id: workOrderId,
            chemical_id: r.chemical_id,
            recommended_amount: r.recommended_amount ? parseFloat(r.recommended_amount) : null,
            recommended_unit: r.recommended_unit || null,
          }))
        )
      if (matErr) {
        setError(getSupabaseErrorMessage(matErr))
        setSaving(false)
        return
      }
    }

    // Insert new charges
    const validCharges = chargeRows.filter((r) => r.description.trim())
    if (validCharges.length > 0) {
      const { error: chgErr } = await supabase
        .from('work_order_charges')
        .insert(
          validCharges.map((r) => ({
            work_order_id: workOrderId,
            description: r.description.trim(),
            amount: parseFloat(r.amount) || 0,
          }))
        )
      if (chgErr) {
        setError(getSupabaseErrorMessage(chgErr))
        setSaving(false)
        return
      }
    }

    refetchMaterials()
    refetchCharges()
    setEditing(false)
    setSaving(false)
  }

  // Editing mode — use the form components
  if (editing) {
    return (
      <div className="space-y-6">
        {weedProfile.length > 0 && (
          <div className="bg-surface-raised rounded-lg p-3 text-sm text-[var(--color-text-muted)]">
            Known species at this site: {weedProfile.map((w) => w.weed_name).join(', ')}
          </div>
        )}

        <MaterialsSection rows={materialRows} onChange={setMaterialRows} />

        <div className="border-t border-surface-border pt-4">
          <ChargesSection rows={chargeRows} onChange={setChargeRows} />
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <div className="flex gap-2 justify-end">
          <Button variant="secondary" size="sm" onClick={handleCancel} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    )
  }

  // Read-only mode
  return (
    <div className="space-y-4">
      {/* Edit button */}
      {canEdit(role) && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={handleEdit}>
            Edit Estimate
          </Button>
        </div>
      )}

      {/* Weed Profile context note */}
      {weedProfile.length > 0 && (
        <div className="bg-surface-raised rounded-lg p-3 text-sm text-[var(--color-text-muted)]">
          Known species at this site: {weedProfile.map((w) => w.weed_name).join(', ')}
        </div>
      )}

      {/* Materials */}
      <div>
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
                  <th className="pb-2">Recommended</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((m) => (
                  <tr key={m.id} className="border-b border-surface-border last:border-0">
                    <td className="py-2 pr-4">{m.chemical?.name ?? '—'}</td>
                    <td className="py-2 pr-4 text-[var(--color-text-muted)]">{m.chemical?.active_ingredient ?? '—'}</td>
                    <td className="py-2">{m.recommended_amount ?? '—'} {m.recommended_unit ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Charges */}
      <div className="border-t border-surface-border pt-4">
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
      </div>
    </div>
  )
}
