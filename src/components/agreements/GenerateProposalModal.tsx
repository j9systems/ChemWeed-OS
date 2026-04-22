import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useFormDraft } from '@/hooks/useFormDraft'

interface GenerateProposalModalProps {
  open: boolean
  agreementId: string
  onClose: () => void
  onConfirm: (signerName: string, signerEmail: string) => Promise<void>
  clientContact: string | null
  clientEmail: string | null
  generating: boolean
  error: string | null
}

interface GenerateProposalForm {
  signerName: string
  signerEmail: string
  touched: boolean
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function GenerateProposalModal({
  open,
  agreementId,
  onClose,
  onConfirm,
  clientContact,
  clientEmail,
  generating,
  error,
}: GenerateProposalModalProps) {
  const initialForm: GenerateProposalForm = {
    signerName: clientContact ?? '',
    signerEmail: clientEmail ?? '',
    touched: false,
  }

  const draftKey = `generate_proposal__${agreementId}`
  const [form, setForm, clearForm] = useFormDraft<GenerateProposalForm>(draftKey, initialForm)

  const [draftNotice, setDraftNotice] = useState<boolean>(() => {
    try { return localStorage.getItem(`draft__${draftKey}`) !== null } catch { return false }
  })

  function update<K extends keyof GenerateProposalForm>(key: K, value: GenerateProposalForm[K]) {
    setForm({ ...form, [key]: value })
  }

  const nameError = form.touched && !form.signerName.trim() ? 'Signer name is required' : null
  const emailError = form.touched && !form.signerEmail.trim()
    ? 'Signer email is required'
    : form.touched && !isValidEmail(form.signerEmail)
      ? 'Enter a valid email address'
      : null
  const isValid = form.signerName.trim() !== '' && isValidEmail(form.signerEmail)

  async function handleConfirm() {
    if (!isValid) {
      update('touched', true)
      return
    }
    await onConfirm(form.signerName.trim(), form.signerEmail.trim())
    clearForm()
    setDraftNotice(false)
  }

  return (
    <Modal open={open} onClose={generating ? () => {} : onClose} title="Create Agreement">
      <div className="space-y-5">
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
        <p className="text-sm text-[var(--color-text-muted)]">
          Confirm who will receive and sign this proposal.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
              Signer Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.signerName}
              onChange={(e) => update('signerName', e.target.value)}
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
              value={form.signerEmail}
              onChange={(e) => update('signerEmail', e.target.value)}
              placeholder="email@example.com"
              className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2a6b2a]/40 focus:border-[#2a6b2a]"
            />
            {emailError && <p className="text-xs text-red-600 mt-1">{emailError}</p>}
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

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
