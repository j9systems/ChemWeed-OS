import { useState, useRef } from 'react'
import { useParams, Link } from 'react-router'
import { ArrowLeft, AlertTriangle, Pencil } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useClient } from '@/hooks/useClients'
import { useSites } from '@/hooks/useSites'
import { useFormDraft } from '@/hooks/useFormDraft'
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

interface EditClientForm {
  name: string
  billingContact: string
  billingPhone: string
  billingEmail: string
  billingAddress: string
  billingCity: string
  billingState: string
  billingZip: string
  poRequired: boolean
  paymentMethod: string
  notes: string
}

function formFromClient(c: EditClientModalProps['client']): EditClientForm {
  return {
    name: c.name,
    billingContact: c.billing_contact ?? '',
    billingPhone: c.billing_phone ?? '',
    billingEmail: c.billing_email ?? '',
    billingAddress: c.billing_address ?? '',
    billingCity: c.billing_city ?? '',
    billingState: c.billing_state ?? 'CA',
    billingZip: c.billing_zip ?? '',
    poRequired: c.po_required,
    paymentMethod: c.payment_method ?? '',
    notes: c.notes ?? '',
  }
}

function EditClientModal({ open, client, onClose, onSaved }: EditClientModalProps) {
  const initialSnapshotRef = useRef<EditClientForm | null>(null)
  if (initialSnapshotRef.current === null) {
    initialSnapshotRef.current = formFromClient(client)
  }
  const initialSnapshot = initialSnapshotRef.current

  const draftKey = `edit_client__${client.id}`
  const [form, setForm, clearForm] = useFormDraft<EditClientForm>(draftKey, initialSnapshot)

  const [draftNotice, setDraftNotice] = useState<boolean>(() => {
    try { return localStorage.getItem(`draft__${draftKey}`) !== null } catch { return false }
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)

  const isDirty = JSON.stringify(form) !== JSON.stringify(initialSnapshot)

  function update<K extends keyof EditClientForm>(key: K, value: EditClientForm[K]) {
    setForm({ ...form, [key]: value })
  }

  function handleCancel() {
    if (!isDirty) {
      clearForm()
      setDraftNotice(false)
      onClose()
      return
    }
    setConfirmingDiscard(true)
  }

  function handleDiscard() {
    clearForm()
    setDraftNotice(false)
    setConfirmingDiscard(false)
    onClose()
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError('Client name is required.')
      return
    }
    setSaving(true)
    setError(null)

    const { error: err } = await supabase
      .from('clients')
      .update({
        name: form.name.trim(),
        billing_contact: form.billingContact || null,
        billing_phone: form.billingPhone || null,
        billing_email: form.billingEmail || null,
        billing_address: form.billingAddress || null,
        billing_city: form.billingCity || null,
        billing_state: form.billingState || 'CA',
        billing_zip: form.billingZip || null,
        po_required: form.poRequired,
        payment_method: form.paymentMethod || null,
        notes: form.notes || null,
      })
      .eq('id', client.id)

    setSaving(false)
    if (err) {
      console.error('Client update error:', err)
      setError(`${getSupabaseErrorMessage(err)} (${err.code ?? 'unknown'})`)
      return
    }
    clearForm()
    setDraftNotice(false)
    onSaved()
  }

  return (
    <Modal open={open} onClose={handleCancel} title="Edit Client">
      <div className="space-y-3">
        {draftNotice && (
          <div className="flex items-center justify-between text-sm text-[var(--color-text-muted)]">
            <span>Draft restored.</span>
            <button
              type="button"
              onClick={() => { clearForm(); setDraftNotice(false) }}
              className="ml-2 hover:text-[var(--color-text-primary)]"
            >
              &times;
            </button>
          </div>
        )}
        <Input label="Client Name *" value={form.name} onChange={(e) => update('name', e.target.value)} autoFocus />
        <Input label="Billing Contact" value={form.billingContact} onChange={(e) => update('billingContact', e.target.value)} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Billing Phone" value={form.billingPhone} onChange={(e) => update('billingPhone', e.target.value)} type="tel" />
          <Input label="Billing Email" value={form.billingEmail} onChange={(e) => update('billingEmail', e.target.value)} type="email" />
        </div>
        <div className="pt-2">
          <p className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Billing Address</p>
          <div className="space-y-3">
            <Input label="Street Address" value={form.billingAddress} onChange={(e) => update('billingAddress', e.target.value)} />
            <div className="grid grid-cols-3 gap-3">
              <Input label="City" value={form.billingCity} onChange={(e) => update('billingCity', e.target.value)} />
              <Input label="State" value={form.billingState} onChange={(e) => update('billingState', e.target.value)} />
              <Input label="ZIP" value={form.billingZip} onChange={(e) => update('billingZip', e.target.value)} />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center gap-2 min-h-[44px]">
            <input
              type="checkbox"
              id="edit-po-required"
              checked={form.poRequired}
              onChange={(e) => update('poRequired', e.target.checked)}
              className="h-4 w-4 rounded border-surface-border text-brand-green focus:ring-brand-green/30"
            />
            <label htmlFor="edit-po-required" className="text-sm font-medium text-[var(--color-text-primary)]">
              PO Required
            </label>
          </div>
          <Input label="Payment Method" value={form.paymentMethod} onChange={(e) => update('paymentMethod', e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {confirmingDiscard && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 flex items-center justify-between gap-3">
            <span>Discard changes?</span>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setConfirmingDiscard(false)}>Keep</Button>
              <Button type="button" variant="danger" size="sm" onClick={handleDiscard}>Discard</Button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={handleCancel}
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
