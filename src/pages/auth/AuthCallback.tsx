import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { supabase } from '@/lib/supabase'

export function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/', { replace: true })
      } else {
        navigate('/login?error=invalid_link', { replace: true })
      }
    })
  }, [navigate])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-lg text-[var(--color-text-secondary)]">Signing you in…</p>
    </div>
  )
}
