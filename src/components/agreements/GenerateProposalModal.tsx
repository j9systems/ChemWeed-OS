import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

interface GenerateProposalModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (signerName: string, signerEmail: string) => Promise<void>
  clientContact: string | null
  clientEmail: string | null
  generating: boolean
  error: string | null
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function GenerateProposalModal({
  open,
  onClose,
  onConfirm,
  clientContact,
  clientEmail,
  generating,
  error,
}: GenerateProposalModalProps) {
  const [signerName, setSignerName] = useState(clientContact ?? '')
  const [signerEmail, setSignerEmail] = useState(clientEmail ?? '')
  const [touched, setTouched] = useState(false)

  const nameError = touched && !signerName.trim() ? 'Signer name is required' : null
  const emailError = touched && !signerEmail.trim()
    ? 'Signer email is required'
    : touched && !isValidEmail(signerEmail)
      ? 'Enter a valid email address'
      : null
  const isValid = signerName.trim() !== '' && isValidEmail(signerEmail)

  function handleConfirm() {
    setTouched(true)
    if (!isValid) return
    onConfirm(signerName.trim(), signerEmail.trim())
  }

  return (
    <Modal open={open} onClose={generating ? () => {} : onClose} title="Create Agreement">
      <div className="space-y-5">
        <p className="text-sm text-[var(--color-text-muted)]">
          Confirm who will receive and sign this proposal.
        </p>

        {/* Signer fields */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
              Signer Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="Full name"
              className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2a6b2a]/40 focus:border-[#2a6b2a]"
            />
            {nameError && <p className="text-xs text-red-600 mt-1">{nameError}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
              Signer Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={signerEmail}
              onChange={(e) => setSignerEmail(e.target.value)}
              placeholder="email@example.com"
              className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2a6b2a]/40 focus:border-[#2a6b2a]"
            />
            {emailError && <p className="text-xs text-red-600 mt-1">{emailError}</p>}
          </div>
        </div>

        {/* Error from edge function */}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-2 border-t border-surface-border">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={generating}>
            Cancel
          </Button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={generating || !isValid}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#2a6b2a' }}
          >
            {generating && <Loader2 size={16} className="animate-spin" />}
            {generating ? 'Creating...' : 'Create Agreement'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
