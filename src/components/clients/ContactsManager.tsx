import { useState } from 'react'
import { Plus, Pencil, Trash2, Phone, Mail, Star, Receipt } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getSupabaseErrorMessage } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import type { ClientContact } from '@/types/database'

interface ContactsManagerProps {
  clientId: string
  contacts: ClientContact[]
  canEdit: boolean
  onChanged: () => void
}

interface ContactFormState {
  name: string
  role: string
  email: string
  phone: string
  isPrimary: boolean
  isBilling: boolean
}

const EMPTY_FORM: ContactFormState = {
  name: '',
  role: '',
  email: '',
  phone: '',
  isPrimary: false,
  isBilling: false,
}

function formFromContact(c: ClientContact): ContactFormState {
  return {
    name: c.name,
    role: c.role ?? '',
    email: c.email ?? '',
    phone: c.phone ?? '',
    isPrimary: c.is_primary,
    isBilling: c.is_billing,
  }
}

function isValidEmail(s: string) {
  return s === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

export function ContactsManager({ clientId, contacts, canEdit, onChanged }: ContactsManagerProps) {
  const [editing, setEditing] = useState<ClientContact | null>(null)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const billingContact = contacts.find((c) => c.is_billing) ?? null
  const primaryContact = contacts.find((c) => c.is_primary) ?? null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Contacts</h2>
        {canEdit && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus size={16} />
            Add Contact
          </Button>
        )}
      </div>

      {contacts.length === 0 ? (
        <p className="py-3 text-sm text-[var(--color-text-muted)]">No contacts yet.</p>
      ) : (
        <div className="rounded-[20px] bg-surface-raised shadow-card overflow-hidden divide-y divide-surface-border">
          {contacts.map((c) => (
            <div key={c.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-sm">{c.name}</span>
                  {c.is_primary && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-green/10 px-2 py-0.5 text-[10px] font-medium text-brand-green">
                      <Star size={10} />
                      Primary
                    </span>
                  )}
                  {c.is_billing && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                      <Receipt size={10} />
                      Billing
                    </span>
                  )}
                  {c.role && (
                    <span className="text-xs text-[var(--color-text-muted)]">{c.role}</span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-text-muted)]">
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 hover:text-brand-green">
                      <Mail size={12} />
                      {c.email}
                    </a>
                  )}
                  {c.phone && (
                    <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 hover:text-brand-green">
                      <Phone size={12} />
                      {c.phone}
                    </a>
                  )}
                </div>
              </div>
              {canEdit && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditing(c)}
                    aria-label={`Edit ${c.name}`}
                    className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] p-2 rounded transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingId(c.id)}
                    aria-label={`Delete ${c.name}`}
                    className="text-[var(--color-text-muted)] hover:text-red-600 p-2 rounded transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!billingContact && contacts.length > 0 && (
        <p className="text-xs text-amber-700">
          No billing contact set. Mark a contact as billing for invoicing emails.
        </p>
      )}
      {!primaryContact && contacts.length > 0 && (
        <p className="text-xs text-[var(--color-text-muted)]">
          No primary contact set. Mark one as primary for quick contact.
        </p>
      )}

      {(creating || editing) && (
        <ContactModal
          clientId={clientId}
          contact={editing}
          existingPrimaryId={primaryContact?.id ?? null}
          existingBillingId={billingContact?.id ?? null}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSaved={() => { setCreating(false); setEditing(null); onChanged() }}
        />
      )}

      {deletingId && (
        <DeleteContactModal
          contact={contacts.find((c) => c.id === deletingId) ?? null}
          clientId={clientId}
          onClose={() => setDeletingId(null)}
          onDeleted={() => { setDeletingId(null); onChanged() }}
        />
      )}
    </div>
  )
}

interface ContactModalProps {
  clientId: string
  contact: ClientContact | null
  existingPrimaryId: string | null
  existingBillingId: string | null
  onClose: () => void
  onSaved: () => void
}

function ContactModal({ clientId, contact, existingPrimaryId, existingBillingId, onClose, onSaved }: ContactModalProps) {
  const initial = contact ? formFromContact(contact) : EMPTY_FORM
  const [form, setForm] = useState<ContactFormState>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update<K extends keyof ContactFormState>(key: K, value: ContactFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Name is required.'); return }
    if (!isValidEmail(form.email.trim())) { setError('Enter a valid email or leave blank.'); return }

    setSaving(true)
    setError(null)

    // If setting primary or billing, first clear the existing one (other than this contact).
    if (form.isPrimary && existingPrimaryId && existingPrimaryId !== contact?.id) {
      const { error: clearErr } = await supabase
        .from('client_contacts')
        .update({ is_primary: false })
        .eq('id', existingPrimaryId)
      if (clearErr) { setError(getSupabaseErrorMessage(clearErr)); setSaving(false); return }
    }
    if (form.isBilling && existingBillingId && existingBillingId !== contact?.id) {
      const { error: clearErr } = await supabase
        .from('client_contacts')
        .update({ is_billing: false })
        .eq('id', existingBillingId)
      if (clearErr) { setError(getSupabaseErrorMessage(clearErr)); setSaving(false); return }
    }

    const payload = {
      client_id: clientId,
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      role: form.role.trim() || null,
      is_primary: form.isPrimary,
      is_billing: form.isBilling,
      updated_at: new Date().toISOString(),
    }

    const { error: writeErr } = contact
      ? await supabase.from('client_contacts').update(payload).eq('id', contact.id)
      : await supabase.from('client_contacts').insert(payload)

    if (writeErr) {
      setError(getSupabaseErrorMessage(writeErr))
      setSaving(false)
      return
    }

    // Sync clients.billing_* cache so consumers that haven't migrated still see fresh data.
    if (form.isBilling) {
      await supabase
        .from('clients')
        .update({
          billing_contact: payload.name,
          billing_email: payload.email,
          billing_phone: payload.phone,
        })
        .eq('id', clientId)
    } else if (contact?.is_billing && !form.isBilling) {
      // This contact was the billing contact and is being unmarked.
      await supabase
        .from('clients')
        .update({ billing_contact: null, billing_email: null, billing_phone: null })
        .eq('id', clientId)
    }

    setSaving(false)
    onSaved()
  }

  return (
    <Modal open onClose={() => { if (!saving) onClose() }} title={contact ? 'Edit Contact' : 'Add Contact'}>
      <div className="space-y-3">
        <Input label="Name *" value={form.name} onChange={(e) => update('name', e.target.value)} autoFocus />
        <Input
          label="Role"
          value={form.role}
          onChange={(e) => update('role', e.target.value)}
          placeholder="e.g. Operations Manager, AP"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Email" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
          <Input label="Phone" type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
        </div>

        <div className="flex flex-wrap gap-4 pt-1">
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.isPrimary}
              onChange={(e) => update('isPrimary', e.target.checked)}
              className="h-4 w-4 rounded border-surface-border accent-brand-green"
            />
            Primary contact
          </label>
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.isBilling}
              onChange={(e) => update('isBilling', e.target.checked)}
              className="h-4 w-4 rounded border-surface-border accent-brand-green"
            />
            Billing contact
          </label>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-surface-border">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

interface DeleteContactModalProps {
  contact: ClientContact | null
  clientId: string
  onClose: () => void
  onDeleted: () => void
}

function DeleteContactModal({ contact, clientId, onClose, onDeleted }: DeleteContactModalProps) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    if (!contact) return
    setDeleting(true)
    setError(null)
    const { error: err } = await supabase
      .from('client_contacts')
      .delete()
      .eq('id', contact.id)
    if (err) {
      setError(getSupabaseErrorMessage(err))
      setDeleting(false)
      return
    }
    if (contact.is_billing) {
      await supabase
        .from('clients')
        .update({ billing_contact: null, billing_email: null, billing_phone: null })
        .eq('id', clientId)
    }
    setDeleting(false)
    onDeleted()
  }

  return (
    <Modal open onClose={() => { if (!deleting) onClose() }} title="Delete Contact">
      <div className="space-y-4">
        <p className="text-sm">
          Delete contact <span className="font-semibold">"{contact?.name}"</span>?
        </p>
        {contact?.is_billing && (
          <p className="text-sm text-amber-700">
            This is the billing contact. Invoicing will need a new billing contact assigned afterward.
          </p>
        )}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2 border-t border-surface-border">
          <Button variant="secondary" onClick={onClose} disabled={deleting}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
