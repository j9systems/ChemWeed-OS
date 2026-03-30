import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { canEdit } from '@/lib/roles'
import { useAuth } from '@/hooks/useAuth'
import { formatCurrency, getSupabaseErrorMessage } from '@/lib/utils'
import { MaterialsSection, type MaterialRow } from '@/components/work-orders/MaterialsSection'
import { ChargesSection, type ChargeRow, rowTotal } from '@/components/work-orders/ChargesSection'
import { Button } from '@/components/ui/Button'
import type { WorkOrderMaterial, WorkOrderCharge, SiteWeedProfile } from '@/types/database'

interface EstimateTabProps {
  materials: WorkOrderMaterial[]
  charges: WorkOrderCharge[]
  weedProfile: SiteWeedProfile[]
  workOrderId: string
  totalAcres?: number | null
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
    is_manual_override: c.is_manual_override,
    service_type_id: c.service_type_id ?? '',
    service_type: c.service_type ?? undefined,
    acreage: c.acreage != null ? String(c.acreage) : '',
    hours: c.hours != null ? String(c.hours) : '',
    unit_rate: c.unit_rate != null ? String(c.unit_rate) : '',
    description: c.description ?? '',
    amount: c.amount != null ? String(c.amount) : '',
    line_items: Array.isArray(c.line_items) ? c.line_items : [],
  }))
}

function chargeDisplayLine(c: WorkOrderCharge): string {
  if (!c.is_manual_override && c.service_type) {
    const name = c.service_type.name
    const isHours = c.service_type.pricing_model === 'per_hour'
    const qty = isHours ? c.hours : c.acreage
    const qtyLabel = isHours ? `${qty} hrs` : `${qty} acres`
    return `${name} — ${qtyLabel} @ ${formatCurrency(c.unit_rate ?? 0)}`
  }
  return c.description ?? '—'
}

function chargeTotal(c: WorkOrderCharge): number {
  if (!c.is_manual_override) {
    const rate = c.unit_rate ?? 0
    const qty = c.service_type?.pricing_model === 'per_hour' ? (c.hours ?? 0) : (c.acreage ?? 0)
    return qty * rate
  }
  return c.amount
}

export function EstimateTab({ materials, charges, weedProfile, workOrderId, totalAcres, refetchMaterials, refetchCharges }: EstimateTabProps) {
  const { role } = useAuth()
  const [editing, setEditing] = useState(false)
  const [materialRows, setMaterialRows] = useState<MaterialRow[]>(() => toMaterialRows(materials))
  const [chargeRows, setChargeRows] = useState<ChargeRow[]>(() => toChargeRows(charges))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [proposalUrl, setProposalUrl] = useState<string | null>(null)

  const chargesTotal = charges.reduce((sum, c) => sum + chargeTotal(c), 0)

  async function handleGenerateProposal() {
    setGenerating(true)
    setGenerateError(null)
    setProposalUrl(null)

    const { data, error } = await supabase.functions.invoke('generate-proposal', {
      body: { work_order_id: workOrderId },
    })

    if (error || !data?.success) {
      setGenerateError(data?.error ?? error?.message ?? 'Failed to generate proposal')
    } else if (data.documentUrl) {
      setProposalUrl(data.documentUrl)
      window.open(data.documentUrl, '_blank')
    }

    setGenerating(false)
  }

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
    const validCharges = chargeRows.filter((r) =>
      r.is_manual_override ? r.description.trim() : r.service_type_id
    )
    if (validCharges.length > 0) {
      const { error: chgErr } = await supabase
        .from('work_order_charges')
        .insert(
          validCharges.map((r) => {
            const total = rowTotal(r)
            const lineItems = r.line_items.filter((li) => li.trim())
            if (r.is_manual_override) {
              return {
                work_order_id: workOrderId,
                description: r.description.trim(),
                amount: parseFloat(r.amount) || 0,
                is_manual_override: true,
                line_items: lineItems,
              }
            }
            return {
              work_order_id: workOrderId,
              service_type_id: r.service_type_id,
              acreage: r.acreage ? parseFloat(r.acreage) : null,
              hours: r.hours ? parseFloat(r.hours) : null,
              unit_rate: r.unit_rate ? parseFloat(r.unit_rate) : null,
              amount: total,
              is_manual_override: false,
              line_items: lineItems,
            }
          })
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

        <MaterialsSection rows={materialRows} onChange={setMaterialRows} totalAcres={totalAcres} />

        <div className="border-t border-surface-border pt-4">
          <ChargesSection rows={chargeRows} onChange={setChargeRows} totalAcres={totalAcres} />
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
                <div key={c.id}>
                  <div className="flex justify-between text-sm py-1">
                    <span>{chargeDisplayLine(c)}</span>
                    <span>{formatCurrency(chargeTotal(c))}</span>
                  </div>
                  {Array.isArray(c.line_items) && c.line_items.length > 0 && (
                    <ul className="ml-4 mb-1">
                      {c.line_items.map((item, j) => (
                        <li key={j} className="text-xs text-[var(--color-text-muted)] leading-snug">• {item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end border-t border-surface-border pt-2 mt-2">
              <p className="text-sm font-semibold">Total: {formatCurrency(chargesTotal)}</p>
            </div>
          </>
        )}
      </div>

      {/* Generate Proposal */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleGenerateProposal}
            disabled={generating || charges.length === 0}
          >
            {generating ? 'Generating...' : 'Generate Proposal'}
          </Button>
          {proposalUrl && (
            <a
              href={proposalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brand-green underline"
            >
              Open PDF
            </a>
          )}
        </div>
        {generateError && (
          <p className="text-sm text-red-600">{generateError}</p>
        )}
      </div>
    </div>
  )
}
