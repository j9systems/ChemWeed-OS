import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { MaterialsSection, type MaterialRow } from '@/components/work-orders/MaterialsSection'
import { ChargesSection, type ChargeRow } from '@/components/work-orders/ChargesSection'
import { supabase } from '@/lib/supabase'
import { getSupabaseErrorMessage } from '@/lib/utils'
import type { WorkOrderMaterial, WorkOrderCharge, SiteWeedProfile } from '@/types/database'

interface EstimateTabProps {
  workOrderId: string
  materials: WorkOrderMaterial[]
  charges: WorkOrderCharge[]
  weedProfile: SiteWeedProfile[]
  canEdit: boolean
  refetchMaterials: () => void
  refetchCharges: () => void
}

function materialsToRows(materials: WorkOrderMaterial[]): MaterialRow[] {
  return materials.map((m) => ({
    chemical_id: m.chemical_id,
    recommended_amount: m.recommended_amount?.toString() ?? '',
    recommended_unit: m.recommended_unit ?? '',
    chemical: m.chemical,
  }))
}

function chargesToRows(charges: WorkOrderCharge[]): ChargeRow[] {
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
  canEdit: editable,
  refetchMaterials,
  refetchCharges,
}: EstimateTabProps) {
  const [materialRows, setMaterialRows] = useState<MaterialRow[]>(() => materialsToRows(materials))
  const [chargeRows, setChargeRows] = useState<ChargeRow[]>(() => chargesToRows(charges))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  // Sync when parent data changes (e.g. after save)
  useEffect(() => {
    setMaterialRows(materialsToRows(materials))
    setChargeRows(chargesToRows(charges))
    setDirty(false)
  }, [materials, charges])

  function handleMaterialChange(rows: MaterialRow[]) {
    setMaterialRows(rows)
    setDirty(true)
  }

  function handleChargeChange(rows: ChargeRow[]) {
    setChargeRows(rows)
    setDirty(true)
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

    refetchMaterials()
    refetchCharges()
    setDirty(false)
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      {weedProfile.length > 0 && (
        <div className="bg-surface-raised rounded-lg p-3 text-sm text-[var(--color-text-muted)]">
          Known species at this site: {weedProfile.map((w) => w.weed_name).join(', ')}
        </div>
      )}

      <Card>
        <MaterialsSection rows={materialRows} onChange={handleMaterialChange} readOnly={!editable} />
      </Card>

      <Card>
        <ChargesSection rows={chargeRows} onChange={handleChargeChange} readOnly={!editable} />
      </Card>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {editable && dirty && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      )}
    </div>
  )
}
