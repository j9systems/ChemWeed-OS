import { Plus, Trash2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useChemicals } from '@/hooks/useChemicals'
import { formatCurrency } from '@/lib/utils'
import type { Chemical } from '@/types/database'

export interface MaterialRow {
  chemical_id: string
  recommended_amount: string
  recommended_unit: string
  chemical?: Chemical
  reapplicationWarning?: boolean
}

interface MaterialsSectionProps {
  rows: MaterialRow[]
  onChange: (rows: MaterialRow[]) => void
  readOnly?: boolean
  totalAcres?: number | null
}

export function MaterialsSection({ rows, onChange, readOnly = false, totalAcres }: MaterialsSectionProps) {
  const { chemicals } = useChemicals()

  function addRow() {
    onChange([...rows, { chemical_id: '', recommended_amount: '', recommended_unit: '' }])
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, i) => i !== index))
  }

  function updateRow(index: number, updates: Partial<MaterialRow>) {
    const updated = rows.map((row, i) => {
      if (i !== index) return row
      const newRow = { ...row, ...updates }
      if (updates.chemical_id) {
        const chem = chemicals.find((c) => c.id === updates.chemical_id)
        newRow.chemical = chem
        newRow.recommended_unit = chem?.default_unit ?? ''
        if (chem?.default_rate_per_acre != null && totalAcres != null) {
          newRow.recommended_amount = String(+(chem.default_rate_per_acre * totalAcres).toFixed(4))
        }
      }
      return newRow
    })
    onChange(updated)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Materials</h3>
        {!readOnly && (
          <Button type="button" variant="ghost" size="sm" onClick={addRow}>
            <Plus size={16} />
            Add Chemical
          </Button>
        )}
      </div>

      {rows.length === 0 && (
        <p className="text-sm text-[var(--color-text-muted)] py-2">No materials added.</p>
      )}

      {rows.map((row, i) => (
        <div key={i} className="rounded-lg border border-surface-border bg-surface-raised p-3 space-y-2">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Chemical</label>
              {readOnly ? (
                <p className="text-sm">{row.chemical?.name ?? '—'}</p>
              ) : (
                <select
                  value={row.chemical_id}
                  onChange={(e) => updateRow(i, { chemical_id: e.target.value })}
                  className="w-full rounded-lg border border-surface-border bg-white px-2 py-1.5 text-sm min-h-[44px]"
                >
                  <option value="">Select chemical...</option>
                  {chemicals.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>
            {!readOnly && (
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="mt-5 rounded-lg p-2 text-red-500 hover:bg-red-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>

          {row.chemical && (
            <div className="text-xs text-[var(--color-text-muted)] space-y-0.5">
              {row.chemical.active_ingredient && <p>Active: {row.chemical.active_ingredient}</p>}
              {row.chemical.default_rate_per_100gal != null && (
                <p>Default rate: {row.chemical.default_rate_per_100gal} per 100 gal</p>
              )}
              {row.chemical.reapplication_interval_days != null && (
                <p>Reapplication interval: {row.chemical.reapplication_interval_days} days</p>
              )}
            </div>
          )}

          {row.reapplicationWarning && (
            <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
              <AlertTriangle size={14} />
              <span>This chemical was applied to this site within the reapplication interval.</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Amount</label>
              {readOnly ? (
                <p className="text-sm">{row.recommended_amount || '—'}</p>
              ) : (
                <input
                  type="number"
                  step="0.01"
                  value={row.recommended_amount}
                  onChange={(e) => updateRow(i, { recommended_amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-surface-border bg-white px-2 py-1.5 text-sm min-h-[44px]"
                />
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Unit</label>
              <p className="text-sm py-1.5">{row.recommended_unit || '—'}</p>
            </div>
          </div>

          {row.recommended_amount && row.chemical?.cost_per_unit != null && (
            <p className="text-xs text-[var(--color-text-muted)]">
              Est. cost: {formatCurrency(parseFloat(row.recommended_amount) * row.chemical.cost_per_unit)}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
