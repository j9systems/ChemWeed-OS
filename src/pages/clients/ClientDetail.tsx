import { useState, useRef, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router'
import { ArrowLeft, AlertTriangle, Pencil, Plus, MoreVertical, Archive, RotateCcw } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useClient } from '@/hooks/useClients'
import { useSites } from '@/hooks/useSites'
import { useClientContacts } from '@/hooks/useClientContacts'
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
import { NewSiteModal } from '@/components/work-orders/NewSiteModal'
import { ContactsManager } from '@/components/clients/ContactsManager'
import type { Client } from '@/types/database'

export function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { role, user } = useAuth()
  const { client, isLoading: clientLoading, error: clientError, refetch } = useClient(id)
  const { sites, isLoading: sitesLoading, error: sitesError, refetch: refetchSites } = useSites(id)
  const { contacts, refetch: refetchContacts } = useClientContacts(id)
  const [editOpen, setEditOpen] = useState(false)
  const [newSiteOpen, setNewSiteOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [archiveModalOpen, setArchiveModalOpen] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  async function handleRestore() {
    if (!client) return
    setRestoring(true)
    const { error } = await supabase
      .from('clients')
      .update({ is_active: true, archived_at: null })
      .eq('id', client.id)
    if (!error) {
      await supabase.from('activities').insert({
        activity_type: 'client_restored',
        title: 'Client restored',
        description: client.name,
        metadata: { client_id: client.id, client_name: client.name },
        created_by: user?.id ?? null,
      })
      refetch()
    }
    setRestoring(false)
    setMenuOpen(false)
  }

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
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{client.name}</h1>
          {!client.is_active && (
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              Archived
            </span>
          )}
        </div>
        {canEdit(role) && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil size={16} />
              Edit
            </Button>
            <div ref={menuRef} className="relative">
              <button
                type="button"
                aria-label="More actions"
                onClick={() => setMenuOpen((v) => !v)}
                className="rounded-lg p-2 hover:bg-surface-raised text-[var(--color-text-muted)] min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                <MoreVertical size={18} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-1 w-44 rounded-lg border border-surface-border bg-white shadow-lg z-20 overflow-hidden">
                  {client.is_active ? (
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); setArchiveModalOpen(true) }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-surface-raised flex items-center gap-2 text-[var(--color-text-primary)]"
                    >
                      <Archive size={14} />
                      Archive Client
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRestore}
                      disabled={restoring}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-surface-raised flex items-center gap-2 text-[var(--color-text-primary)] disabled:opacity-50"
                    >
                      <RotateCcw size={14} />
                      {restoring ? 'Restoring...' : 'Restore Client'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
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

      {canEdit(role) && archiveModalOpen && (
        <ArchiveClientModal
          client={client}
          onClose={() => setArchiveModalOpen(false)}
          onArchived={() => { setArchiveModalOpen(false); navigate('/clients') }}
          userId={user?.id ?? null}
        />
      )}

      <Card className="mb-6">
        <div className="grid gap-3 sm:grid-cols-2">
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

      <div className="mb-6">
        <ContactsManager
          clientId={client.id}
          contacts={contacts}
          canEdit={canEdit(role)}
          onChanged={() => { refetchContacts(); refetch() }}
        />
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Sites</h2>
        {canEdit(role) && (
          <Button size="sm" onClick={() => setNewSiteOpen(true)}>
            <Plus size={16} />
            Add Site
          </Button>
        )}
      </div>

      <NewSiteModal
        open={newSiteOpen}
        clientId={client.id}
        clientName={client.name}
        onSuccess={() => {
          setNewSiteOpen(false)
          refetchSites()
        }}
        onCancel={() => setNewSiteOpen(false)}
      />

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

interface ArchiveBlockingAgreement {
  id: string
  agreement_number: string | null
  agreement_status: string
}

interface ArchiveBlockingWorkOrder {
  id: string
  work_order_number: string | null
  status: string
}

function ArchiveClientModal({
  client,
  onClose,
  onArchived,
  userId,
}: {
  client: Client
  onClose: () => void
  onArchived: () => void
  userId: string | null
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [siteCount, setSiteCount] = useState(0)
  const [agreementCount, setAgreementCount] = useState(0)
  const [completedWoCount, setCompletedWoCount] = useState(0)
  const [blockingAgreements, setBlockingAgreements] = useState<ArchiveBlockingAgreement[]>([])
  const [blockingWorkOrders, setBlockingWorkOrders] = useState<ArchiveBlockingWorkOrder[]>([])
  const [confirmName, setConfirmName] = useState('')
  const [archiving, setArchiving] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [
        sitesRes,
        agreementsRes,
        completedWoRes,
        blockingAgRes,
        blockingWoRes,
      ] = await Promise.all([
        supabase.from('sites').select('id', { count: 'exact', head: true }).eq('client_id', client.id),
        supabase.from('service_agreements').select('id', { count: 'exact', head: true }).eq('client_id', client.id),
        supabase.from('work_orders').select('id', { count: 'exact', head: true }).eq('client_id', client.id).eq('status', 'completed'),
        supabase.from('service_agreements').select('id, agreement_number, agreement_status').eq('client_id', client.id).eq('agreement_status', 'active'),
        supabase.from('work_orders').select('id, work_order_number, status').eq('client_id', client.id).in('status', ['scheduled', 'in_progress']),
      ])

      if (cancelled) return
      const firstErr = sitesRes.error || agreementsRes.error || completedWoRes.error || blockingAgRes.error || blockingWoRes.error
      if (firstErr) {
        setError(firstErr.message)
      } else {
        setSiteCount(sitesRes.count ?? 0)
        setAgreementCount(agreementsRes.count ?? 0)
        setCompletedWoCount(completedWoRes.count ?? 0)
        setBlockingAgreements((blockingAgRes.data ?? []) as ArchiveBlockingAgreement[])
        setBlockingWorkOrders((blockingWoRes.data ?? []) as ArchiveBlockingWorkOrder[])
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [client.id])

  const isBlocked = blockingAgreements.length > 0 || blockingWorkOrders.length > 0
  const confirmMatches = confirmName.trim() === client.name

  async function handleArchive() {
    if (!confirmMatches) return
    setArchiving(true)
    setError(null)
    const { error: updateErr } = await supabase
      .from('clients')
      .update({ is_active: false, archived_at: new Date().toISOString() })
      .eq('id', client.id)
    if (updateErr) {
      setError(getSupabaseErrorMessage(updateErr))
      setArchiving(false)
      return
    }
    await supabase.from('activities').insert({
      activity_type: 'client_archived',
      title: 'Client archived',
      description: client.name,
      metadata: { client_id: client.id, client_name: client.name },
      created_by: userId,
    })
    setArchiving(false)
    onArchived()
  }

  return (
    <Modal open onClose={onClose} title="Archive Client">
      <div className="space-y-4">
        {loading ? (
          <p className="text-sm text-[var(--color-text-muted)]">Checking client status...</p>
        ) : isBlocked ? (
          <>
            <p className="text-sm">
              <span className="font-semibold">"{client.name}"</span> can't be archived yet — there's still active work for this client.
            </p>
            {blockingAgreements.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-1">Active agreements</p>
                <ul className="text-sm space-y-1">
                  {blockingAgreements.map((a) => (
                    <li key={a.id}>
                      <Link
                        to={`/agreements/${a.id}`}
                        onClick={onClose}
                        className="text-brand-green hover:underline"
                      >
                        {a.agreement_number ?? `Agreement ${a.id.slice(0, 8)}`}
                      </Link>
                      <span className="text-[var(--color-text-muted)] ml-2 text-xs">{a.agreement_status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {blockingWorkOrders.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-1">Active work orders</p>
                <ul className="text-sm space-y-1">
                  {blockingWorkOrders.map((w) => (
                    <li key={w.id}>
                      <Link
                        to={`/work-orders/${w.id}`}
                        onClick={onClose}
                        className="text-brand-green hover:underline"
                      >
                        {w.work_order_number ?? `Work Order ${w.id.slice(0, 8)}`}
                      </Link>
                      <span className="text-[var(--color-text-muted)] ml-2 text-xs">{w.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end pt-2 border-t border-surface-border">
              <Button variant="secondary" onClick={onClose}>Close</Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm">
              Archive client <span className="font-semibold">"{client.name}"</span>?
            </p>
            <p className="text-sm text-[var(--color-text-muted)]">
              {siteCount} site{siteCount === 1 ? '' : 's'}, {agreementCount} past agreement{agreementCount === 1 ? '' : 's'}, {completedWoCount} completed work order{completedWoCount === 1 ? '' : 's'}.
            </p>
            <p className="text-sm text-[var(--color-text-muted)]">
              This client will be hidden from active lists. Historical records remain intact.
            </p>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
                Type the client name to confirm
              </label>
              <Input
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={client.name}
                autoFocus
              />
            </div>
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2 border-t border-surface-border">
              <Button variant="secondary" onClick={onClose} disabled={archiving}>Cancel</Button>
              <Button
                variant="danger"
                onClick={handleArchive}
                disabled={!confirmMatches || archiving}
              >
                {archiving ? 'Archiving...' : 'Archive'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
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

    const billingContactName = form.billingContact.trim() || null
    const billingEmail = form.billingEmail || null
    const billingPhone = form.billingPhone || null

    const { error: err } = await supabase
      .from('clients')
      .update({
        name: form.name.trim(),
        billing_contact: billingContactName,
        billing_phone: billingPhone,
        billing_email: billingEmail,
        billing_address: form.billingAddress || null,
        billing_city: form.billingCity || null,
        billing_state: form.billingState || 'CA',
        billing_zip: form.billingZip || null,
        po_required: form.poRequired,
        payment_method: form.paymentMethod || null,
        notes: form.notes || null,
      })
      .eq('id', client.id)

    if (err) {
      setSaving(false)
      console.error('Client update error:', err)
      setError(`${getSupabaseErrorMessage(err)} (${err.code ?? 'unknown'})`)
      return
    }

    // Keep the contacts table in sync with the billing fields the user just
    // edited. Update the existing billing contact, or create one if none
    // exists yet (e.g. clients created before client_contacts existed and
    // somehow lost their backfilled row).
    const billingHasValues = billingContactName || billingEmail || billingPhone
    if (billingHasValues) {
      const { data: existing } = await supabase
        .from('client_contacts')
        .select('id')
        .eq('client_id', client.id)
        .eq('is_billing', true)
        .maybeSingle()

      if (existing?.id) {
        await supabase
          .from('client_contacts')
          .update({
            name: billingContactName ?? client.name,
            email: billingEmail,
            phone: billingPhone,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
      } else {
        await supabase.from('client_contacts').insert({
          client_id: client.id,
          name: billingContactName ?? client.name,
          email: billingEmail,
          phone: billingPhone,
          role: 'Billing',
          is_primary: true,
          is_billing: true,
        })
      }
    }

    setSaving(false)
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
