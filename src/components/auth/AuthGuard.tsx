import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Button } from '@/components/ui/Button'

export function AuthGuard() {
  const { user, teamMember, isLoading, role, signOut } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner message="Loading..." />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!teamMember || !role) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold">Access Denied</h1>
          <p className="mt-2 text-[var(--color-text-muted)]">
            Your account is not associated with a team member. Contact an administrator.
          </p>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={async () => {
              await signOut()
            }}
          >
            Return to Login
          </Button>
        </div>
      </div>
    )
  }

  return <Outlet />
}
