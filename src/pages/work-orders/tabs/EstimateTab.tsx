import { formatCurrency } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import type { WorkOrderMaterial, WorkOrderCharge, SiteWeedProfile } from '@/types/database'

interface EstimateTabProps {
  materials: WorkOrderMaterial[]
  charges: WorkOrderCharge[]
  weedProfile: SiteWeedProfile[]
}

export function EstimateTab({ materials, charges, weedProfile }: EstimateTabProps) {
  const chargesTotal = charges.reduce((sum, c) => sum + c.amount, 0)

  return (
    <div className="space-y-4">
      {/* Weed Profile context note */}
      {weedProfile.length > 0 && (
        <div className="bg-surface-raised rounded-lg p-3 text-sm text-[var(--color-text-muted)]">
          Known species at this site: {weedProfile.map((w) => w.weed_name).join(', ')}
        </div>
      )}

      {/* Materials */}
      <Card>
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
      </Card>

      {/* Charges */}
      <Card>
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
      </Card>
    </div>
  )
}
