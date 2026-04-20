import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'

type ConfirmType = 'recovery' | 'invite' | 'email' | 'signup' | 'magiclink'

type ConfirmCopy = { title: string; body: string; cta: string }

const DEFAULT_COPY: ConfirmCopy = {
  title: 'Confirm your account',
  body: 'Click continue to finish signing in.',
  cta: 'Continue',
}

const COPY: Record<string, ConfirmCopy> = {
  recovery: {
    title: 'Reset your password',
    body: 'Click continue to verify your reset link and choose a new password.',
    cta: 'Continue',
  },
  invite: {
    title: 'Welcome to ChemWeed',
    body: 'Click continue to verify your invite and set your password.',
    cta: 'Continue',
  },
}

export function AuthConfirm() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const tokenHash = searchParams.get('token_hash')
  const type = (searchParams.get('type') ?? 'default') as ConfirmType
  const next = searchParams.get('next') ?? '/dashboard'

  useEffect(() => {
    if (!tokenHash) {
      navigate('/login?error=invalid_link&context=' + type, { replace: true })
    }
  }, [tokenHash, type, navigate])

  const copy = COPY[type] ?? DEFAULT_COPY

  async function handleConfirm() {
    if (!tokenHash) return
    setSubmitting(true)
    setError(null)
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as any,
    })
    if (verifyError) {
      setSubmitting(false)
      setError('This link is invalid or has expired. Ask your administrator to resend it, or request a new password reset.')
      return
    }
    navigate(next, { replace: true })
  }

  if (!tokenHash) return null

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm text-center">
        <img
          src="https://res.cloudinary.com/duy32f0q4/image/upload/v1773909562/ChemWeed_Logo_transparent_te3i86.png"
          alt="ChemWeed"
          className="mx-auto mb-4 h-16 w-auto"
        />
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">{copy.title}</h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">{copy.body}</p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <Button onClick={handleConfirm} disabled={submitting} className="mt-6 w-full">
          {submitting ? 'Verifying…' : copy.cta}
        </Button>
      </div>
    </div>
  )
}
