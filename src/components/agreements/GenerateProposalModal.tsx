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
  clientPhone: string | null
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
  clientPhone,
  generating,
  error,
}: GenerateProposalModalProps) {
  const [useClient, setUseClient] = useState(true)
  const [signerName, setSignerName] = useState(clientContact ?? '')
  const [signerEmail, setSignerEmail] = useState(clientEmail ?? '')
  const [altPhone, setAltPhone] = useState('')
  const [touched, setTouched] = useState(false)

  function handleToggle(useClientContact: boolean) {
    setUseClient(useClientContact)
    setTouched(false)
    if (useClientContact) {
      setSignerName(clientContact ?? '')
      setSignerEmail(clientEmail ?? '')
      setAltPhone('')
    } else {
      setSignerName('')
      setSignerEmail('')
      setAltPhone('')
    }
  }

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
    <Modal open={open} onClose={generating ? () => {} : onClose} title="Generate Proposal">
      <div className="space-y-5">
        <p className="text-sm text-[var(--color-text-muted)]">
          Confirm who will receive and sign this proposal.
        </p>

        {/* Contact source toggle */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleToggle(true)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              useClient
                ? 'border-[#2a6b2a] bg-[#2a6b2a]/10 text-[#2a6b2a]'
                : 'border-surface-border text-[var(--color-text-muted)] hover:bg-surface'
            }`}
          >
            Use Client Contact
          </button>
          <button
            type="button"
            onClick={() => handleToggle(false)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              !useClient
                ? 'border-[#2a6b2a] bg-[#2a6b2a]/10 text-[#2a6b2a]'
                : 'border-surface-border text-[var(--color-text-muted)] hover:bg-surface'
            }`}
          >
            Use Different Contact
          </button>
        </div>

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

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
              Phone {useClient ? '(from client record)' : '(optional)'}
            </label>
            {useClient ? (
              <p className="text-sm text-[var(--color-text-primary)] px-3 py-2">
                {clientPhone || '—'}
              </p>
            ) : (
              <input
                type="tel"
                value={altPhone}
                onChange={(e) => setAltPhone(e.target.value)}
                placeholder="Phone number (for reference only)"
                className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2a6b2a]/40 focus:border-[#2a6b2a]"
              />
            )}
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
            disabled={generating}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#2a6b2a' }}
          >
            {generating && <Loader2 size={16} className="animate-spin" />}
            {generating ? 'Generating...' : 'Generate & Send for Signature'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
