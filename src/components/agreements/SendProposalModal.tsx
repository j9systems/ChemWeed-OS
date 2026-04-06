import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'

interface SendProposalModalProps {
  open: boolean
  onClose: () => void
  agreementId: string
  signingUrl: string
  documentName: string
  clientContact: string | null
  clientEmail: string | null
  clientPhone: string | null
  companyName: string
  onSent: (toEmail: string) => void
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

const LOGO_URL = import.meta.env.VITE_COMPANY_LOGO_URL as string | undefined

export function SendProposalModal({
  open,
  onClose,
  agreementId,
  signingUrl,
  documentName,
  clientContact,
  clientEmail,
  clientPhone,
  companyName,
  onSent,
}: SendProposalModalProps) {
  const [toName, setToName] = useState(clientContact ?? '')
  const [toEmail, setToEmail] = useState(clientEmail ?? '')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  const nameError = touched && !toName.trim() ? 'Name is required' : null
  const emailError = touched && !toEmail.trim()
    ? 'Email is required'
    : touched && !isValidEmail(toEmail)
      ? 'Enter a valid email address'
      : null
  const isValid = toName.trim() !== '' && isValidEmail(toEmail)

  const truncatedUrl = signingUrl.length > 60 ? signingUrl.slice(0, 60) + '...' : signingUrl

  async function handleSend() {
    setTouched(true)
    if (!isValid) return

    setSending(true)
    setError(null)

    const { data, error: err } = await supabase.functions.invoke('send-proposal-email', {
      body: {
        agreement_id: agreementId,
        to_email: toEmail.trim(),
        to_name: toName.trim(),
        signing_url: signingUrl,
        document_name: documentName,
      },
    })

    if (err || (data && !data.success)) {
      setError(data?.error ?? err?.message ?? 'Failed to send email')
      setSending(false)
      return
    }

    setSending(false)
    onSent(toEmail.trim())
  }

  return (
    <Modal open={open} onClose={sending ? () => {} : onClose} title="Send Proposal for Signature">
      <div className="space-y-5">
        {/* Recipient section */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-[var(--color-text-muted)]">Sending to</p>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={toName}
              onChange={(e) => setToName(e.target.value)}
              placeholder="Recipient name"
              className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2a6b2a]/40 focus:border-[#2a6b2a]"
            />
            {nameError && <p className="text-xs text-red-600 mt-1">{nameError}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="email@example.com"
              className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2a6b2a]/40 focus:border-[#2a6b2a]"
            />
            {emailError && <p className="text-xs text-red-600 mt-1">{emailError}</p>}
          </div>
        </div>

        {/* Email preview section */}
        <div>
          <p className="text-xs font-medium text-[var(--color-text-muted)] mb-2">Email Preview</p>
          <div className="border border-surface-border rounded-lg overflow-hidden" style={{ maxHeight: 280, overflowY: 'auto' }}>
            {/* Header bar */}
            <div style={{ backgroundColor: '#2a6b2a', padding: '16px 24px', textAlign: 'center' }}>
              {LOGO_URL ? (
                <img src={LOGO_URL} alt={companyName} style={{ height: 32, margin: '0 auto' }} />
              ) : (
                <span style={{ color: '#ffffff', fontSize: 18, fontWeight: 700 }}>{companyName}</span>
              )}
            </div>
            {/* Body */}
            <div style={{ padding: '24px', fontFamily: 'Arial, sans-serif', fontSize: 14, color: '#333', lineHeight: '1.6' }}>
              <p style={{ margin: '0 0 16px' }}>Hi {toName || '[name]'},</p>
              <p style={{ margin: '0 0 16px' }}>Your proposal is ready for review and signature.</p>
              <p style={{ margin: '0 0 16px', fontWeight: 600 }}>{documentName}</p>
              <div style={{ textAlign: 'center', margin: '24px 0' }}>
                <span
                  style={{
                    display: 'inline-block',
                    backgroundColor: '#2a6b2a',
                    color: '#ffffff',
                    padding: '12px 32px',
                    borderRadius: 6,
                    fontSize: 14,
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  Review &amp; Sign Proposal
                </span>
              </div>
              <p style={{ margin: '0 0 24px', fontSize: 12, color: '#666', wordBreak: 'break-all' }}>
                {truncatedUrl}
              </p>
              {/* Footer */}
              <div style={{ borderTop: '1px solid #e5e5e5', paddingTop: 16, fontSize: 12, color: '#999', textAlign: 'center' }}>
                <p style={{ margin: '0 0 4px' }}>{companyName}</p>
                {clientEmail && <p style={{ margin: '0 0 4px' }}>{clientEmail}</p>}
                {clientPhone && <p style={{ margin: 0 }}>{clientPhone}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-2 border-t border-surface-border">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !isValid}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#2a6b2a' }}
          >
            {sending && <Loader2 size={16} className="animate-spin" />}
            {sending ? 'Sending...' : 'Send Email'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
