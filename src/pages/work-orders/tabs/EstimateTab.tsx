import { useState } from 'react'
import { Edit, Save, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, getSupabaseErrorMessage } from '@/lib/utils'
import { canEdit } from '@/lib/roles'
import { Button } from '@/components/ui/Button'
import { MaterialsSection, type MaterialRow } from '@/components/work-orders/MaterialsSection'
import { ChargesSection, type ChargeRow } from '@/components/work-orders/ChargesSection'
import type { WorkOrderMaterial, WorkOrderCharge, SiteWeedProfile, Role } from '@/types/database'

interface EstimateTabProps {
  workOrderId: string
  materials: WorkOrderMaterial[]
  charges: WorkOrderCharge[]
  weedProfile: SiteWeedProfile[]
  role: Role | null
  refetchMaterials: () => void
  refetchCharges: () => void
}

function toMaterialRows(materials: WorkOrderMaterial[]): MaterialRow[] {
  return materials.map((m) => ({
    chemical_id: m.chemical_id,
    recommended_amount: String(m.recommended_amount ?? ''),
    recommended_unit: m.recommended_unit ?? '',
    chemical: m.chemical,
  }))
}

function toChargeRows(charges: WorkOrderCharge[]): ChargeRow[] {
  return charges.map((c) => ({
    description: c.description,
    amount: String(c.amount),
  }))
}

export function EstimateTab({
  workOrderId,
  materials,
  charges,
  weedProfile,
  role,
  refetchMaterials,
  refetchCharges,
}: EstimateTabProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [materialRows, setMaterialRows] = useState<MaterialRow[]>([])
  const [chargeRows, setChargeRows] = useState<ChargeRow[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const chargesTotal = charges.reduce((sum, c) => sum + c.amount, 0)

  function startEditing() {
    setMaterialRows(toMaterialRows(materials))
    setChargeRows(toChargeRows(charges))
    setError(null)
    setIsEditing(true)
  }

  function cancelEditing() {
    setIsEditing(false)
    setError(null)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)

    // Delete existing materials and re-insert
    const { error: delMatErr } = await supabase
      .from('work_order_materials')
      .delete()
      .eq('work_order_id', workOrderId)

    if (delMatErr) {
      setError(getSupabaseErrorMessage(delMatErr))
      setSaving(false)
      return
    }

    const materialInserts = materialRows
      .filter((m) => m.chemical_id)
      .map((m) => ({
        work_order_id: workOrderId,
        chemical_id: m.chemical_id,
        recommended_amount: parseFloat(m.recommended_amount) || null,
        recommended_unit: m.recommended_unit || null,
      }))

    if (materialInserts.length > 0) {
      const { error: matErr } = await supabase.from('work_order_materials').insert(materialInserts)
      if (matErr) {
        setError(getSupabaseErrorMessage(matErr))
        setSaving(false)
        return
      }
    }

    // Delete existing charges and re-insert
    const { error: delChgErr } = await supabase
      .from('work_order_charges')
      .delete()
      .eq('work_order_id', workOrderId)

    if (delChgErr) {
      setError(getSupabaseErrorMessage(delChgErr))
      setSaving(false)
      return
    }

    const chargeInserts = chargeRows
      .filter((c) => c.description)
      .map((c) => ({
        work_order_id: workOrderId,
        description: c.description,
        amount: parseFloat(c.amount) || 0,
      }))

    if (chargeInserts.length > 0) {
      const { error: chgErr } = await supabase.from('work_order_charges').insert(chargeInserts)
      if (chgErr) {
        setError(getSupabaseErrorMessage(chgErr))
        setSaving(false)
        return
      }
    }

    setSaving(false)
    setIsEditing(false)
    refetchMaterials()
    refetchCharges()
  }

  return (
    <div className="space-y-4">
      {/* Weed Profile context note */}
      {weedProfile.length > 0 && (
        <div className="rounded-lg bg-[#F5F8FE] p-3 text-sm text-[var(--color-text-muted)]">
          Known species at this site: {weedProfile.map((w) => w.weed_name).join(', ')}
        </div>
      )}

      {/* Edit / Save / Cancel toolbar */}
      {canEdit(role) && (
        <div className="flex justify-end gap-2">
          {isEditing ? (
            <>
              <Button variant="secondary" size="sm" onClick={cancelEditing} disabled={saving}>
                <X size={16} />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save size={16} />
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </>
          ) : (
            <Button variant="secondary" size="sm" onClick={startEditing}>
              <Edit size={16} />
              Edit Estimate
            </Button>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {isEditing ? (
        /* Edit mode — reuse form components */
        <>
          <div>
            <MaterialsSection rows={materialRows} onChange={setMaterialRows} />
          </div>
          <div className="border-t border-surface-border pt-4">
            <ChargesSection rows={chargeRows} onChange={setChargeRows} />
          </div>
        </>
      ) : (
        /* Read mode — display tables */
        <>
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
        </>
      )}
    </div>
  )
}
