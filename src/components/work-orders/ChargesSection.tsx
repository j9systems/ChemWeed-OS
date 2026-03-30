import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useServiceTypes } from '@/hooks/useServiceTypes'
import { formatCurrency } from '@/lib/utils'
import type { ServiceType } from '@/types/database'

export interface ChargeRow {
  /** false = calculated (Mode 1), true = manual (Mode 2) */
  is_manual_override: boolean
  // Calculated fields
  service_type_id: string
  service_type?: ServiceType
  acreage: string
  hours: string
  unit_rate: string
  // Manual fields
  description: string
  amount: string
}

export function emptyCalculatedRow(): ChargeRow {
  return {
    is_manual_override: false,
    service_type_id: '',
    acreage: '',
    hours: '',
    unit_rate: '',
    description: '',
    amount: '',
  }
}

export function emptyManualRow(): ChargeRow {
  return {
    is_manual_override: true,
    service_type_id: '',
    acreage: '',
    hours: '',
    unit_rate: '',
    description: '',
    amount: '',
  }
}

/** Compute the total for a single row */
export function rowTotal(row: ChargeRow): number {
  if (row.is_manual_override) return parseFloat(row.amount) || 0
  const rate = parseFloat(row.unit_rate) || 0
  const qty = row.service_type?.pricing_model === 'per_hour'
    ? (parseFloat(row.hours) || 0)
    : (parseFloat(row.acreage) || 0)
  return qty * rate
}

interface ChargesSectionProps {
  rows: ChargeRow[]
  onChange: (rows: ChargeRow[]) => void
  readOnly?: boolean
  totalAcres?: number | null
}

export function ChargesSection({ rows, onChange, readOnly = false, totalAcres }: ChargesSectionProps) {
  const { serviceTypes } = useServiceTypes()

  function addCalculated() {
    onChange([...rows, emptyCalculatedRow()])
  }


  function removeRow(index: number) {
    onChange(rows.filter((_, i) => i !== index))
  }

  function updateRow(index: number, updates: Partial<ChargeRow>) {
    onChange(rows.map((row, i) => {
      if (i !== index) return row
      const newRow = { ...row, ...updates }

      // When a service type is selected, populate defaults
      if (updates.service_type_id && !row.is_manual_override) {
        const st = serviceTypes.find((s) => s.id === updates.service_type_id)
        newRow.service_type = st
        if (st?.base_rate_low != null && st?.base_rate_high != null) {
          newRow.unit_rate = String(((st.base_rate_low + st.base_rate_high) / 2).toFixed(2))
        }
        if (st?.pricing_model !== 'per_hour' && totalAcres != null && totalAcres > 0) {
          newRow.acreage = String(totalAcres)
        }
      }
      return newRow
    }))
  }

  function switchToManual(index: number) {
    updateRow(index, {
      is_manual_override: true,
      service_type_id: '',
      service_type: undefined,
      acreage: '',
      hours: '',
      unit_rate: '',
    })
  }

  function switchToCalculated(index: number) {
    updateRow(index, {
      is_manual_override: false,
      description: '',
      amount: '',
    })
  }

  const total = rows.reduce((sum, r) => sum + rowTotal(r), 0)

  if (readOnly) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Charges</h3>
        {rows.length === 0 && (
          <p className="text-sm text-[var(--color-text-muted)] py-2">No charges added.</p>
        )}
        {rows.length > 0 && (
          <>
            <div className="space-y-1">
              {rows.map((row, i) => (
                <div key={i} className="flex justify-between text-sm py-1">
                  <span>{row.description || '—'}</span>
                  <span>{formatCurrency(rowTotal(row))}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-end border-t border-surface-border pt-2">
              <p className="text-sm font-semibold">Total: {formatCurrency(total)}</p>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Charges</h3>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={addCalculated}>
            <Plus size={16} />
            Add Charge
          </Button>
        </div>
      </div>

      {rows.length === 0 && (
        <p className="text-sm text-[var(--color-text-muted)] py-2">No charges added.</p>
      )}

      {rows.map((row, i) => (
        <div key={i} className="rounded-lg border border-surface-border bg-surface-raised p-3 space-y-2">
          {!row.is_manual_override ? (
            /* ---- Mode 1: Calculated charge ---- */
            <>
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Service Type</label>
                  <select
                    value={row.service_type_id}
                    onChange={(e) => updateRow(i, { service_type_id: e.target.value })}
                    className="w-full rounded-lg border border-surface-border bg-white px-2 py-1.5 text-sm min-h-[44px]"
                  >
                    <option value="">Select service type...</option>
                    {serviceTypes.map((st) => (
                      <option key={st.id} value={st.id}>{st.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="mt-5 rounded-lg p-2 text-red-500 hover:bg-red-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {row.service_type && (
                <div className="grid grid-cols-3 gap-2">
                  {/* Quantity field — acreage or hours depending on pricing_model */}
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
                      {row.service_type.pricing_model === 'per_hour' ? 'Hours' : 'Acreage'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={row.service_type.pricing_model === 'per_hour' ? row.hours : row.acreage}
                      onChange={(e) =>
                        updateRow(i, row.service_type?.pricing_model === 'per_hour'
                          ? { hours: e.target.value }
                          : { acreage: e.target.value }
                        )
                      }
                      placeholder="0"
                      className="w-full rounded-lg border border-surface-border bg-white px-2 py-1.5 text-sm min-h-[44px]"
                    />
                  </div>

                  {/* Rate */}
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
                      Rate / {row.service_type.pricing_model === 'per_hour' ? 'hr' : 'acre'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={row.unit_rate}
                      onChange={(e) => updateRow(i, { unit_rate: e.target.value })}
                      placeholder="0.00"
                      className="w-full rounded-lg border border-surface-border bg-white px-2 py-1.5 text-sm min-h-[44px]"
                    />
                  </div>

                  {/* Calculated total */}
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Total</label>
                    <p className="text-sm font-medium py-1.5">{formatCurrency(rowTotal(row))}</p>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => switchToManual(i)}
                className="text-xs text-[var(--color-text-muted)] underline hover:text-[var(--color-text)]"
              >
                override — enter amount manually
              </button>
            </>
          ) : (
            /* ---- Mode 2: Manual charge ---- */
            <>
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Description</label>
                  <input
                    type="text"
                    value={row.description}
                    onChange={(e) => updateRow(i, { description: e.target.value })}
                    placeholder="Description"
                    className="w-full rounded-lg border border-surface-border bg-white px-2 py-1.5 text-sm min-h-[44px]"
                  />
                </div>
                <div className="w-28">
                  <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={row.amount}
                    onChange={(e) => updateRow(i, { amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-surface-border bg-white px-2 py-1.5 text-sm text-right min-h-[44px]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="mt-5 rounded-lg p-2 text-red-500 hover:bg-red-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <button
                type="button"
                onClick={() => switchToCalculated(i)}
                className="text-xs text-[var(--color-text-muted)] underline hover:text-[var(--color-text)]"
              >
                switch to calculated charge
              </button>
            </>
          )}
        </div>
      ))}

      {rows.length > 0 && (
        <div className="flex justify-end border-t border-surface-border pt-2">
          <p className="text-sm font-semibold">Total: {formatCurrency(total)}</p>
        </div>
      )}
    </div>
  )
}
