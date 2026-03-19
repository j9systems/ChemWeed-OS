import { formatCurrency } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import type { WorkOrder, WorkOrderCharge } from '@/types/database'

interface InvoiceTabProps {
  workOrder: WorkOrder
  charges: WorkOrderCharge[]
}

export function InvoiceTab({ workOrder, charges }: InvoiceTabProps) {
  const chargesTotal = charges.reduce((sum, c) => sum + c.amount, 0)

  return (
    <div className="space-y-4">
      {/* Invoice status */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Invoice Status</h2>
        {workOrder.status === 'invoiced' ? (
          <Badge status="invoiced" />
        ) : (
          <span className="text-sm text-[var(--color-text-muted)]">Not yet invoiced</span>
        )}
      </div>

      {/* Charges summary */}
      <div className="border-t border-surface-border pt-4">
        <h2 className="text-sm font-semibold mb-3">Charges Summary</h2>
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

      {/* Placeholder */}
      <div className="border-t border-surface-border pt-4">
        <p className="text-sm text-[var(--color-text-muted)]">Billing actions coming soon.</p>
      </div>
    </div>
  )
}
