import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ROLES } from '@/lib/constants'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Toast } from '@/components/ui/Toast'
import type { Role } from '@/types/database'

const ROLE_OPTIONS = Object.entries(ROLES).map(([value, label]) => ({ value, label }))

interface AddMemberModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function AddMemberModal({ open, onClose, onSuccess }: AddMemberModalProps) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [role, setRole] = useState<Role>('tech')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [licenseExpiry, setLicenseExpiry] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showLicense = role === 'pca' || role === 'tech'

  function resetForm() {
    setFirstName('')
    setLastName('')
    setRole('tech')
    setPhone('')
    setEmail('')
    setLicenseNumber('')
    setLicenseExpiry('')
    setNotes('')
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError('First name, last name, and email are required.')
      return
    }

    setIsSubmitting(true)

    const body: Record<string, unknown> = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      role,
      phone: phone.trim() || null,
      email: email.trim(),
      notes: notes.trim() || null,
    }

    if (showLicense) {
      body.pesticide_license_number = licenseNumber.trim() || null
      body.license_expiry_date = licenseExpiry || null
    }

    const { data, error: fnError } = await supabase.functions.invoke('invite-team-member', { body })

    setIsSubmitting(false)

    if (fnError) {
      // Try to extract the error message from the response body
      const detail = typeof data === 'object' && data?.error ? data.error : fnError.message
      setError(detail)
      return
    }

    if (data?.error) {
      setError(data.error)
      return
    }

    const toastMsg = data?.warning
      ? `Team member created. Note: ${data.warning}`
      : `Invite sent to ${email.trim()}. They'll receive an email to set their password.`

    setToast({ message: toastMsg, type: 'success' })
    resetForm()
    onSuccess()

    // Close modal after a short delay so user sees the toast
    setTimeout(() => {
      onClose()
    }, 500)
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title="Add Team Member">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
            <Input
              label="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>

          <Select
            label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            options={ROLE_OPTIONS}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
            />
            <Input
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
            />
          </div>

          {showLicense && (
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Pesticide License #"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
              />
              <Input
                label="License Expiry Date"
                type="date"
                value={licenseExpiry}
                onChange={(e) => setLicenseExpiry(e.target.value)}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Notes</label>
            <textarea
              className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] min-h-[60px] transition-colors focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Sending Invite…' : 'Add & Invite'}
            </Button>
          </div>
        </form>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  )
}
