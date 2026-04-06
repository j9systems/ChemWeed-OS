import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function SetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSubmitting(false)

    if (updateError) {
      setError(updateError.message)
    } else {
      setSuccess(true)
      setTimeout(() => {
        navigate('/', { replace: true })
      }, 1000)
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
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Set Your Password</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Choose a password to secure your Chem-Weed account.
          </p>
        </div>

        {success ? (
          <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-center text-sm text-green-700">
            Password set successfully! Redirecting…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />
            <Input
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? 'Setting password...' : 'Set Password'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
