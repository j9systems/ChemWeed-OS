import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils'

export interface ChargeRow {
  description: string
  amount: string
}

interface ChargesSectionProps {
  rows: ChargeRow[]
  onChange: (rows: ChargeRow[]) => void
  readOnly?: boolean
}

export function ChargesSection({ rows, onChange, readOnly = false }: ChargesSectionProps) {
  function addRow() {
    onChange([...rows, { description: '', amount: '' }])
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, i) => i !== index))
  }

  function updateRow(index: number, updates: Partial<ChargeRow>) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...updates } : row)))
  }

  const total = rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Charges</h3>
        {!readOnly && (
          <Button type="button" variant="ghost" size="sm" onClick={addRow}>
            <Plus size={16} />
            Add Charge
          </Button>
        )}
      </div>

      {rows.length === 0 && (
        <p className="text-sm text-[var(--color-text-muted)] py-2">No charges added.</p>
      )}

      {rows.map((row, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="flex-1">
            {readOnly ? (
              <p className="text-sm">{row.description}</p>
            ) : (
              <input
                type="text"
                value={row.description}
                onChange={(e) => updateRow(i, { description: e.target.value })}
                placeholder="Description"
                className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm min-h-[44px]"
              />
            )}
          </div>
          <div className="w-28">
            {readOnly ? (
              <p className="text-sm text-right">{formatCurrency(parseFloat(row.amount) || 0)}</p>
            ) : (
              <input
                type="number"
                step="0.01"
                value={row.amount}
                onChange={(e) => updateRow(i, { amount: e.target.value })}
                placeholder="0.00"
                className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm text-right min-h-[44px]"
              />
            )}
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="rounded-lg p-2 text-red-500 hover:bg-red-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <Trash2 size={16} />
            </button>
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
