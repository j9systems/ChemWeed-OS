import { useState } from 'react'
import { useParams, Link } from 'react-router'
import { ArrowLeft, AlertTriangle, Pencil } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useClient } from '@/hooks/useClients'
import { useSites } from '@/hooks/useSites'
import { canEdit } from '@/lib/roles'
import { supabase } from '@/lib/supabase'
import { getSupabaseErrorMessage } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const { role } = useAuth()
  const { client, isLoading: clientLoading, error: clientError, refetch } = useClient(id)
  const { sites, isLoading: sitesLoading, error: sitesError } = useSites(id)
  const [editOpen, setEditOpen] = useState(false)

  if (clientLoading) return <LoadingSpinner />
  if (clientError) return <ErrorMessage message={clientError} />
  if (!client) return <ErrorMessage message="Client not found." />

  return (
    <div>
      <Link to="/clients" className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mb-4">
        <ArrowLeft size={16} />
        Back to Clients
      </Link>

      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold">{client.name}</h1>
        {canEdit(role) && (
          <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil size={16} />
            Edit
          </Button>
        )}
      </div>

      {canEdit(role) && (
        <EditClientModal
          open={editOpen}
          client={client}
          onClose={() => setEditOpen(false)}
          onSaved={() => { setEditOpen(false); refetch() }}
        />
      )}

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
          <div className="col-span-full">
            <p className="text-sm text-[var(--color-text-muted)]">Billing Address</p>
            <p>
              {client.billing_address || client.billing_city || client.billing_zip
                ? [
                    client.billing_address,
                    [client.billing_city, client.billing_state, client.billing_zip].filter(Boolean).join(' '),
                  ].filter(Boolean).join(', ')
                : '—'}
            </p>
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
            <Link key={site.id} to={`/sites/${site.id}`} className="block">
              <Card className="hover:bg-surface transition-colors cursor-pointer">
                <p className="font-medium">{site.name}</p>
                <p className="text-sm text-[var(--color-text-muted)]">{site.address_line}, {site.city}, {site.state} {site.zip}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  {site.total_acres != null && (
                    <span className="text-[var(--color-text-muted)]">{site.total_acres} acres</span>
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
            </Link>
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

interface EditClientModalProps {
  open: boolean
  client: NonNullable<ReturnType<typeof useClient>['client']>
  onClose: () => void
  onSaved: () => void
}

function EditClientModal({ open, client, onClose, onSaved }: EditClientModalProps) {
  const [name, setName] = useState(client.name)
  const [billingContact, setBillingContact] = useState(client.billing_contact ?? '')
  const [billingPhone, setBillingPhone] = useState(client.billing_phone ?? '')
  const [billingEmail, setBillingEmail] = useState(client.billing_email ?? '')
  const [billingAddress, setBillingAddress] = useState(client.billing_address ?? '')
  const [billingCity, setBillingCity] = useState(client.billing_city ?? '')
  const [billingState, setBillingState] = useState(client.billing_state ?? 'CA')
  const [billingZip, setBillingZip] = useState(client.billing_zip ?? '')
  const [poRequired, setPoRequired] = useState(client.po_required)
  const [paymentMethod, setPaymentMethod] = useState(client.payment_method ?? '')
  const [notes, setNotes] = useState(client.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when client changes or modal reopens
  const resetForm = () => {
    setName(client.name)
    setBillingContact(client.billing_contact ?? '')
    setBillingPhone(client.billing_phone ?? '')
    setBillingEmail(client.billing_email ?? '')
    setBillingAddress(client.billing_address ?? '')
    setBillingCity(client.billing_city ?? '')
    setBillingState(client.billing_state ?? 'CA')
    setBillingZip(client.billing_zip ?? '')
    setPoRequired(client.po_required)
    setPaymentMethod(client.payment_method ?? '')
    setNotes(client.notes ?? '')
    setError(null)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  async function handleSave() {
    if (!name.trim()) {
      setError('Client name is required.')
      return
    }
    setSaving(true)
    setError(null)

    const { error: err } = await supabase
      .from('clients')
      .update({
        name: name.trim(),
        billing_contact: billingContact || null,
        billing_phone: billingPhone || null,
        billing_email: billingEmail || null,
        billing_address: billingAddress || null,
        billing_city: billingCity || null,
        billing_state: billingState || 'CA',
        billing_zip: billingZip || null,
        po_required: poRequired,
        payment_method: paymentMethod || null,
        notes: notes || null,
      })
      .eq('id', client.id)

    setSaving(false)
    if (err) {
      console.error('Client update error:', err)
      setError(`${getSupabaseErrorMessage(err)} (${err.code ?? 'unknown'})`)
      return
    }
    onSaved()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Edit Client">
      <div className="space-y-3">
        <Input label="Client Name *" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <Input label="Billing Contact" value={billingContact} onChange={(e) => setBillingContact(e.target.value)} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Billing Phone" value={billingPhone} onChange={(e) => setBillingPhone(e.target.value)} type="tel" />
          <Input label="Billing Email" value={billingEmail} onChange={(e) => setBillingEmail(e.target.value)} type="email" />
        </div>
        <div className="pt-2">
          <p className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Billing Address</p>
          <div className="space-y-3">
            <Input label="Street Address" value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} />
            <div className="grid grid-cols-3 gap-3">
              <Input label="City" value={billingCity} onChange={(e) => setBillingCity(e.target.value)} />
              <Input label="State" value={billingState} onChange={(e) => setBillingState(e.target.value)} />
              <Input label="ZIP" value={billingZip} onChange={(e) => setBillingZip(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center gap-2 min-h-[44px]">
            <input
              type="checkbox"
              id="edit-po-required"
              checked={poRequired}
              onChange={(e) => setPoRequired(e.target.checked)}
              className="h-4 w-4 rounded border-surface-border text-brand-green focus:ring-brand-green/30"
            />
            <label htmlFor="edit-po-required" className="text-sm font-medium text-[var(--color-text-primary)]">
              PO Required
            </label>
          </div>
          <Input label="Payment Method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] underline"
          >
            Cancel
          </button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
