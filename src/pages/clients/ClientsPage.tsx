import { useState } from 'react'
import { Link } from 'react-router'
import { Search, Plus } from 'lucide-react'
import { useClients } from '@/hooks/useClients'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { NewClientModal } from '@/components/work-orders/NewClientModal'

export function ClientsPage() {
  const [showArchived, setShowArchived] = useState(false)
  const { clients, isLoading, error, refetch } = useClients({ includeArchived: showArchived })
  const [search, setSearch] = useState('')
  const [showNewClientModal, setShowNewClientModal] = useState(false)

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.billing_contact ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (c.billing_email ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Clients</h1>
        <button
          onClick={() => setShowNewClientModal(true)}
          className="bg-[#2a6b2a] hover:bg-[#1a4a1a] text-white text-sm font-medium px-4 py-2 rounded-lg min-h-[44px] flex items-center gap-2"
        >
          <Plus size={16} />
          Add New Client
        </button>
      </div>

      <div className="relative mb-4">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search clients..."
          className="w-full rounded-lg border border-surface-border bg-surface-raised pl-10 pr-3 py-2 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
        />
      </div>

      <label className="mb-4 inline-flex items-center gap-2 text-sm text-[var(--color-text-muted)] cursor-pointer">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
          className="h-4 w-4 rounded border-surface-border accent-brand-green"
        />
        Show archived
      </label>

      {isLoading && <LoadingSpinner />}
      {error && <ErrorMessage message={error} onRetry={refetch} />}
      {!isLoading && !error && (
        <>
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-[var(--color-text-muted)]">
              No clients found.
            </p>
          ) : (
            <div className="rounded-[20px] bg-surface-raised shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-border text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                      <th className="px-4 py-3">Client</th>
                      <th className="px-4 py-3 hidden sm:table-cell">Contact</th>
                      <th className="px-4 py-3 hidden md:table-cell">Email</th>
                      <th className="px-4 py-3 hidden md:table-cell">Phone</th>
                      <th className="px-4 py-3 hidden lg:table-cell">City</th>
                      <th className="px-4 py-3 hidden lg:table-cell">Payment</th>
                      <th className="px-4 py-3 text-center">Sites</th>
                      <th className="px-4 py-3 hidden xl:table-cell text-center">PO Req.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {filtered.map((client) => (
                      <tr
                        key={client.id}
                        className={`hover:bg-surface-border/30 transition-colors ${client.is_active ? '' : 'opacity-60'}`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/clients/${client.id}`}
                              className="font-medium text-[var(--color-text-primary)] hover:text-brand-green transition-colors"
                            >
                              {client.name}
                            </Link>
                            {!client.is_active && (
                              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                                Archived
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell text-[var(--color-text-muted)]">
                          {client.billing_contact || '—'}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-[var(--color-text-muted)]">
                          {client.billing_email || '—'}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-[var(--color-text-muted)]">
                          {client.billing_phone || '—'}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-[var(--color-text-muted)]">
                          {client.billing_city || '—'}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-[var(--color-text-muted)]">
                          {client.payment_method || '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center rounded-full bg-brand-green/10 px-2 py-0.5 text-xs font-medium text-brand-green">
                            {client.site_count}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden xl:table-cell text-center">
                          {client.po_required ? (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                              Yes
                            </span>
                          ) : (
                            <span className="text-[var(--color-text-muted)]">No</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <NewClientModal
        open={showNewClientModal}
        onCancel={() => setShowNewClientModal(false)}
        onSuccess={() => { setShowNewClientModal(false); refetch(); }}
        initialClientName=""
      />
    </div>
  )
}
