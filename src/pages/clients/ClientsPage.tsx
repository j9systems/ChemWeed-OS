import { useState } from 'react'
import { Link } from 'react-router'
import { Search } from 'lucide-react'
import { useClients } from '@/hooks/useClients'
import { Card } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'

export function ClientsPage() {
  const { clients, isLoading, error, refetch } = useClients()
  const [search, setSearch] = useState('')

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.billing_contact ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Clients</h1>

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

      {isLoading && <LoadingSpinner />}
      {error && <ErrorMessage message={error} onRetry={refetch} />}
      {!isLoading && !error && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((client) => (
            <Link key={client.id} to={`/clients/${client.id}`}>
              <Card className="hover:border-brand-green/30 transition-colors">
                <p className="font-medium">{client.name}</p>
                {client.billing_contact && (
                  <p className="text-sm text-[var(--color-text-muted)]">{client.billing_contact}</p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-brand-green/10 px-2 py-0.5 text-xs font-medium text-brand-green">
                    {client.site_count} site{client.site_count !== 1 ? 's' : ''}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full py-8 text-center text-[var(--color-text-muted)]">
              No clients found.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
