import { useState, useEffect } from 'react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { getSupabaseErrorMessage } from '@/lib/utils'
import { canEdit } from '@/lib/roles'
import { Card } from '@/components/ui/Card'
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
    recommended_amount: m.recommended_amount?.toString() ?? '',
    recommended_unit: m.recommended_unit ?? '',
    chemical: m.chemical,
  }))
}

function toChargeRows(charges: WorkOrderCharge[]): ChargeRow[] {
  return charges.map((c) => ({
    description: c.description,
    amount: c.amount.toString(),
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
  const editable = canEdit(role)
  const [materialRows, setMaterialRows] = useState<MaterialRow[]>(() => toMaterialRows(materials))
  const [chargeRows, setChargeRows] = useState<ChargeRow[]>(() => toChargeRows(charges))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setMaterialRows(toMaterialRows(materials))
    setChargeRows(toChargeRows(charges))
    setDirty(false)
  }, [materials, charges])

  function handleMaterialsChange(rows: MaterialRow[]) {
    setMaterialRows(rows)
    setDirty(true)
  }

  function handleChargesChange(rows: ChargeRow[]) {
    setChargeRows(rows)
    setDirty(true)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)

    // Delete existing materials and charges
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

    // Insert new charges
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

    refetchMaterials()
    refetchCharges()
    setDirty(false)
    setSaving(false)
  }

  const chargesTotal = chargeRows.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0)

  return (
    <div className="space-y-4">
      {weedProfile.length > 0 && (
        <div className="bg-surface-raised rounded-lg p-3 text-sm text-[var(--color-text-muted)]">
          Known species at this site: {weedProfile.map((w) => w.weed_name).join(', ')}
        </div>
      )}

      <Card>
        <MaterialsSection
          rows={materialRows}
          onChange={handleMaterialsChange}
          readOnly={!editable}
        />
      </Card>

      <Card>
        <ChargesSection
          rows={chargeRows}
          onChange={handleChargesChange}
          readOnly={!editable}
        />
      </Card>

      {editable && (
        <div className="space-y-2">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving || !dirty} size="sm">
              {saving ? 'Saving...' : 'Save Estimate'}
            </Button>
            {chargeRows.length > 0 && (
              <p className="text-sm font-semibold">Estimate Total: {formatCurrency(chargesTotal)}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
