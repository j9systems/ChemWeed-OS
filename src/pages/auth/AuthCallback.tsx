import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { supabase } from '@/lib/supabase'

export function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    async function handleCallback() {
      const searchParams = new URLSearchParams(window.location.search)
      const code = searchParams.get('code')
      const typeFromSearch = searchParams.get('type')

      // Fallback: read tokens from URL hash (legacy flows)
      const hashParams = new URLSearchParams(window.location.hash.replace('#', ''))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token') ?? ''
      const typeFromHash = hashParams.get('type')

      const type = typeFromSearch ?? typeFromHash

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          navigate('/login?error=invalid_link', { replace: true })
          return
        }
      } else if (accessToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (error) {
          navigate('/login?error=invalid_link', { replace: true })
          return
        }
      } else {
        navigate('/login?error=invalid_link', { replace: true })
        return
      }

      if (type === 'invite' || type === 'recovery') {
        navigate('/set-password', { replace: true })
      } else {
        navigate('/dashboard', { replace: true })
      }
    }

    handleCallback()
  }, [navigate])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-lg text-[var(--color-text-secondary)]">Signing you in…</p>
    </div>
  )
}
