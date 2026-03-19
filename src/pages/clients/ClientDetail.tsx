import { useParams, Link } from 'react-router'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { useClient } from '@/hooks/useClients'
import { useSites } from '@/hooks/useSites'
import { Card } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'

export function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const { client, isLoading: clientLoading, error: clientError } = useClient(id)
  const { sites, isLoading: sitesLoading, error: sitesError } = useSites(id)

  if (clientLoading) return <LoadingSpinner />
  if (clientError) return <ErrorMessage message={clientError} />
  if (!client) return <ErrorMessage message="Client not found." />

  return (
    <div>
      <Link to="/clients" className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mb-4">
        <ArrowLeft size={16} />
        Back to Clients
      </Link>

      <h1 className="text-2xl font-bold mb-2">{client.name}</h1>

      <Card className="mb-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-sm text-[var(--color-text-muted)]">Billing Contact</p>
            <p>{client.billing_contact ?? '—'}</p>
          </div>
          <div>
            <p className="text-sm text-[var(--color-text-muted)]">Email</p>
            <p>{client.billing_email ?? '—'}</p>
          </div>
          <div>
            <p className="text-sm text-[var(--color-text-muted)]">Phone</p>
            <p>{client.billing_phone ?? '—'}</p>
          </div>
          <div>
            <p className="text-sm text-[var(--color-text-muted)]">PO Required</p>
            <p>{client.po_required ? 'Yes' : 'No'}</p>
          </div>
          <div>
            <p className="text-sm text-[var(--color-text-muted)]">Payment Method</p>
            <p>{client.payment_method ?? '—'}</p>
          </div>
        </div>
        {client.notes && (
          <div className="mt-3 pt-3 border-t border-surface-border">
            <p className="text-sm text-[var(--color-text-muted)]">Notes</p>
            <p className="text-sm">{client.notes}</p>
          </div>
        )}
      </Card>

      <h2 className="text-lg font-semibold mb-3">Sites</h2>

      {sitesLoading && <LoadingSpinner />}
      {sitesError && <ErrorMessage message={sitesError} />}
      {!sitesLoading && !sitesError && (
        <div className="grid gap-3 sm:grid-cols-2">
          {sites.map((site) => (
            <Card key={site.id}>
              <p className="font-medium">{site.name}</p>
              <p className="text-sm text-[var(--color-text-muted)]">{site.address}, {site.city}, {site.state} {site.zip}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                {site.acreage != null && (
                  <span className="text-[var(--color-text-muted)]">{site.acreage} acres</span>
                )}
                <span className="rounded-full bg-surface-raised border border-surface-border px-2 py-0.5 capitalize">
                  {site.property_type}
                </span>
                {site.county && (
                  <span className="text-[var(--color-text-muted)]">{site.county.name} County</span>
                )}
                {site.county && !site.county.is_licensed && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 font-medium">
                    <AlertTriangle size={12} />
                    Unlicensed County
                  </span>
                )}
              </div>
            </Card>
          ))}
          {sites.length === 0 && (
            <p className="col-span-full py-4 text-center text-[var(--color-text-muted)]">
              No sites for this client.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
