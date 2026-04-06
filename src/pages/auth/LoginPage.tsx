import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function LoginPage() {
  const { user, isLoading, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [forgotPassword, setForgotPassword] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/dashboard'
  const urlError = new URLSearchParams(location.search).get('error')

  if (!isLoading && user) {
    return <Navigate to={from} replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email || !password) {
      setError('Please enter both email and password.')
      return
    }
    setError(null)
    setSubmitting(true)
    const { error: signInError } = await signIn(email, password)
    setSubmitting(false)
    if (signInError) {
      setError(signInError)
    } else {
      navigate(from, { replace: true })
    }
  }

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault()
    if (!email) {
      setError('Please enter your email address.')
      return
    }
    setError(null)
    setSubmitting(true)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    })
    setSubmitting(false)
    if (resetError) {
      setError(resetError.message)
    } else {
      setResetSent(true)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img
            src="https://res.cloudinary.com/duy32f0q4/image/upload/v1773909562/ChemWeed_Logo_transparent_te3i86.png"
            alt="ChemWeed"
            className="mx-auto mb-4 h-16 w-auto"
          />
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Vegetation Management Operations</p>
        </div>

        {urlError === 'invalid_link' && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            This invite link is invalid or has expired. Contact your administrator to resend the
            invite.
          </div>
        )}

        {forgotPassword ? (
          resetSent ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-[var(--color-text-muted)]">
                Check your email for a password reset link.
              </p>
              <button
                type="button"
                onClick={() => {
                  setForgotPassword(false)
                  setResetSent(false)
                  setError(null)
                }}
                className="text-sm font-medium text-[var(--color-primary)] hover:underline"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <p className="text-sm text-[var(--color-text-muted)]">
                Enter your email and we'll send you a reset link.
              </p>
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@chemweed.com"
                autoComplete="email"
                required
              />

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? 'Sending...' : 'Send Reset Email'}
              </Button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setForgotPassword(false)
                    setError(null)
                  }}
                  className="text-sm font-medium text-[var(--color-primary)] hover:underline"
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          )
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@chemweed.com"
              autoComplete="email"
              required
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? 'Signing in...' : 'Sign In'}
            </Button>
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setForgotPassword(true)
                  setError(null)
                }}
                className="text-sm text-[var(--color-text-muted)] hover:underline"
              >
                Forgot password?
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
