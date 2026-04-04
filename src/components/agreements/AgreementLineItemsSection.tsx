import { Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useServiceTypes } from '@/hooks/useServiceTypes'
import { formatCurrency } from '@/lib/utils'
import { MONTH_NAMES } from '@/lib/constants'
import type { ServiceType, FrequencyType } from '@/types/database'

export interface LineItemRow {
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
  // Scope line items
  line_items: string[]
  // Frequency
  frequency: FrequencyType
  season_start_month: number
  season_end_month: number
}

export function emptyCalculatedRow(): LineItemRow {
  return {
    is_manual_override: false,
    service_type_id: '',
    acreage: '',
    hours: '',
    unit_rate: '',
    description: '',
    amount: '',
    line_items: [],
    frequency: 'one_time',
    season_start_month: 5,
    season_end_month: 9,
  }
}

export function emptyManualRow(): LineItemRow {
  return {
    is_manual_override: true,
    service_type_id: '',
    acreage: '',
    hours: '',
    unit_rate: '',
    description: '',
    amount: '',
    line_items: [],
    frequency: 'one_time',
    season_start_month: 5,
    season_end_month: 9,
  }
}

/** Compute the total for a single row */
export function rowTotal(row: LineItemRow): number {
  if (row.is_manual_override) return parseFloat(row.amount) || 0
  const rate = parseFloat(row.unit_rate) || 0
  const qty = row.service_type?.pricing_model === 'per_hour'
    ? (parseFloat(row.hours) || 0)
    : (parseFloat(row.acreage) || 0)
  return qty * rate
}

const FREQUENCY_OPTIONS: { value: FrequencyType; label: string }[] = [
  { value: 'one_time', label: 'One-time' },
  { value: 'annual', label: 'Annual' },
  { value: 'monthly_seasonal', label: 'Monthly (seasonal)' },
  { value: 'weekly_seasonal', label: 'Weekly (seasonal)' },
]

interface AgreementLineItemsSectionProps {
  rows: LineItemRow[]
  onChange: (rows: LineItemRow[]) => void
  readOnly?: boolean
  totalAcres?: number | null
}

export function AgreementLineItemsSection({ rows, onChange, readOnly = false, totalAcres }: AgreementLineItemsSectionProps) {
  const { serviceTypes } = useServiceTypes()

  function addCalculated() {
    onChange([...rows, emptyCalculatedRow()])
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, i) => i !== index))
  }

  function updateRow(index: number, updates: Partial<LineItemRow>) {
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
        if (st?.default_scope_template) {
          newRow.line_items = [st.default_scope_template]
        } else {
          newRow.line_items = []
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

  function updateLineItem(rowIndex: number, itemIndex: number, value: string) {
    const items = rows[rowIndex]?.line_items ?? []
    const newItems = [...items]
    newItems[itemIndex] = value
    updateRow(rowIndex, { line_items: newItems })
  }

  function removeLineItem(rowIndex: number, itemIndex: number) {
    const items = rows[rowIndex]?.line_items ?? []
    updateRow(rowIndex, { line_items: items.filter((_, j) => j !== itemIndex) })
  }

  function addLineItem(rowIndex: number) {
    const items = rows[rowIndex]?.line_items ?? []
    updateRow(rowIndex, { line_items: [...items, ''] })
  }

  const total = rows.reduce((sum, r) => sum + rowTotal(r), 0)

  const showSeason = (freq: FrequencyType) => freq === 'monthly_seasonal' || freq === 'weekly_seasonal'

  if (readOnly) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Line Items</h3>
        {rows.length === 0 && (
          <p className="text-sm text-[var(--color-text-muted)] py-2">No line items added.</p>
        )}
        {rows.length > 0 && (
          <>
            <div className="space-y-1">
              {rows.map((row, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm py-1">
                    <span>{row.is_manual_override ? (row.description || '—') : (row.service_type?.name || '—')}</span>
                    <span>{formatCurrency(rowTotal(row))}</span>
                  </div>
                  {row.line_items.length > 0 && (
                    <ul className="ml-4 mb-1">
                      {row.line_items.map((item, j) => (
                        <li key={j} className="text-xs text-[var(--color-text-muted)] leading-snug">• {item}</li>
                      ))}
                    </ul>
                  )}
                  {row.frequency !== 'one_time' && (
                    <p className="text-xs text-[var(--color-text-muted)] ml-4">
                      Frequency: {FREQUENCY_OPTIONS.find(f => f.value === row.frequency)?.label}
                      {showSeason(row.frequency) && ` (${MONTH_NAMES[row.season_start_month - 1]}–${MONTH_NAMES[row.season_end_month - 1]})`}
                    </p>
                  )}
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
        <h3 className="text-sm font-semibold">Line Items</h3>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={addCalculated}>
            <Plus size={16} />
            Add Line Item
          </Button>
        </div>
      </div>

      {rows.length === 0 && (
        <p className="text-sm text-[var(--color-text-muted)] py-2">No line items added.</p>
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
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Total</label>
                    <p className="text-sm font-medium py-1.5">{formatCurrency(rowTotal(row))}</p>
                  </div>
                </div>
              )}

              {/* Line items */}
              <div className="space-y-1">
                {row.line_items.map((item, j) => (
                  <div key={j} className="flex items-center gap-1">
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => updateLineItem(i, j, e.target.value)}
                      placeholder="Line item description"
                      className="flex-1 rounded border border-surface-border bg-white px-2 py-1 text-xs min-h-[32px]"
                    />
                    <button
                      type="button"
                      onClick={() => removeLineItem(i, j)}
                      className="text-[var(--color-text-muted)] hover:text-red-500 p-0.5"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addLineItem(i)}
                  className="text-xs text-brand-green hover:underline"
                >
                  + Add line item
                </button>
              </div>

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

              {/* Line items */}
              <div className="space-y-1">
                {row.line_items.map((item, j) => (
                  <div key={j} className="flex items-center gap-1">
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => updateLineItem(i, j, e.target.value)}
                      placeholder="Line item description"
                      className="flex-1 rounded border border-surface-border bg-white px-2 py-1 text-xs min-h-[32px]"
                    />
                    <button
                      type="button"
                      onClick={() => removeLineItem(i, j)}
                      className="text-[var(--color-text-muted)] hover:text-red-500 p-0.5"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addLineItem(i)}
                  className="text-xs text-brand-green hover:underline"
                >
                  + Add line item
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

          {/* ---- Frequency Section ---- */}
          <div className="border-t border-surface-border pt-2 mt-2">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Frequency</label>
                <select
                  value={row.frequency}
                  onChange={(e) => updateRow(i, { frequency: e.target.value as FrequencyType })}
                  className="rounded-lg border border-surface-border bg-white px-2 py-1.5 text-sm min-h-[44px]"
                >
                  {FREQUENCY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {showSeason(row.frequency) && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Season Start</label>
                    <select
                      value={row.season_start_month}
                      onChange={(e) => updateRow(i, { season_start_month: parseInt(e.target.value) })}
                      className="rounded-lg border border-surface-border bg-white px-2 py-1.5 text-sm min-h-[44px]"
                    >
                      {MONTH_NAMES.map((name, idx) => (
                        <option key={idx} value={idx + 1}>{name}</option>
                      ))}
                    </select>
                  </div>
                  <span className="text-sm text-[var(--color-text-muted)] pb-2">through</span>
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Season End</label>
                    <select
                      value={row.season_end_month}
                      onChange={(e) => updateRow(i, { season_end_month: parseInt(e.target.value) })}
                      className="rounded-lg border border-surface-border bg-white px-2 py-1.5 text-sm min-h-[44px]"
                    >
                      {MONTH_NAMES.map((name, idx) => (
                        <option key={idx} value={idx + 1}>{name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>
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
