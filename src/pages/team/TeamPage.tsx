import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { Plus, Send } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTeamMembers } from '@/hooks/useTeam'
import { supabase } from '@/lib/supabase'
import { ROLES } from '@/lib/constants'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Toast } from '@/components/ui/Toast'
import { AddMemberModal } from '@/components/team/AddMemberModal'
import type { Role } from '@/types/database'

const ROLE_COLORS: Record<Role, string> = {
  admin: '#2a6b2a',
  manager: '#3d8f3d',
  technician: '#1a6b9a',
  pca: '#7a4a1a',
}

const ROLE_FILTERS: Array<{ value: Role | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'technician', label: 'Technician' },
  { value: 'pca', label: 'PCA' },
]

function isLicenseExpired(date: string): boolean {
  return new Date(date) < new Date()
}

function isLicenseExpiringSoon(date: string): boolean {
  const expiry = new Date(date)
  const now = new Date()
  const sixtyDays = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)
  return expiry >= now && expiry <= sixtyDays
}

export function TeamPage() {
  const { role } = useAuth()
  const { members, isLoading, error, refetch } = useTeamMembers(false)
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all')
  const [showActiveOnly, setShowActiveOnly] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [resendingEmail, setResendingEmail] = useState<string | null>(null)
  const [pendingInvites, setPendingInvites] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const isAdmin = role === 'admin'

  // Fetch which team member emails have not yet accepted their invite
  useEffect(() => {
    if (!isAdmin || members.length === 0) return
    const emails = members
      .filter((m) => m.is_active && m.email)
      .map((m) => m.email!)

    if (emails.length === 0) return

    supabase.functions.invoke('check-invite-status', { body: { emails } })
      .then(({ data }) => {
        if (data?.pending) {
          setPendingInvites(new Set(data.pending.map((e: string) => e.toLowerCase())))
        }
      })
      .catch(() => { /* silently fail — button just won't show */ })
  }, [isAdmin, members])

  const filtered = members.filter((m) => {
    if (roleFilter !== 'all' && m.role !== roleFilter) return false
    if (showActiveOnly && !m.is_active) return false
    return true
  })

  async function handleResendInvite(email: string) {
    setResendingEmail(email)
    try {
      const { data, error: err } = await supabase.functions.invoke('resend-invite', {
        body: { email },
      })
      if (err) {
        setToast({ message: `Failed to resend invite: ${err.message}`, type: 'error' })
      } else if (data?.error) {
        setToast({ message: data.error, type: 'error' })
      } else {
        setToast({ message: 'Invitation resent successfully.', type: 'success' })
      }
    } catch {
      setToast({ message: 'Failed to resend invite.', type: 'error' })
    } finally {
      setResendingEmail(null)
    }
  }

  return (
    <div className="pb-20 md:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Team</h1>
        {isAdmin && (
          <Button size="md" onClick={() => setShowAddModal(true)}>
            <Plus size={18} />
            Add Member
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {ROLE_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setRoleFilter(f.value)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors min-h-[44px] ${
              roleFilter === f.value
                ? 'bg-brand-green text-white'
                : 'bg-surface-raised text-[var(--color-text-muted)] border border-surface-border hover:bg-surface-border'
            }`}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={() => setShowActiveOnly(!showActiveOnly)}
          className={`ml-auto rounded-full px-3 py-1.5 text-sm font-medium transition-colors min-h-[44px] ${
            showActiveOnly
              ? 'bg-brand-green text-white'
              : 'bg-surface-raised text-[var(--color-text-muted)] border border-surface-border'
          }`}
        >
          {showActiveOnly ? 'Active Only' : 'All Status'}
        </button>
      </div>

      {/* Content */}
      {isLoading && <LoadingSpinner message="Loading team…" />}
      {error && <ErrorMessage message={error} onRetry={refetch} />}
      {!isLoading && !error && filtered.length === 0 && (
        <p className="py-12 text-center text-sm text-[var(--color-text-muted)]">No team members found.</p>
      )}

      {!isLoading && !error && filtered.length > 0 && (
        <div className="rounded-[20px] bg-surface-raised shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Phone</th>
                  <th className="px-4 py-3 hidden md:table-cell">Email</th>
                  <th className="px-4 py-3 hidden lg:table-cell">License</th>
                  <th className="px-4 py-3">Status</th>
                  {isAdmin && <th className="px-4 py-3 w-10"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {filtered.map((member) => {
                  const isInactive = !member.is_active
                  const showLicense = (member.role === 'pca' || member.role === 'technician') && member.license_expiry_date
                  const expired = showLicense && isLicenseExpired(member.license_expiry_date!)
                  const expiringSoon = showLicense && !expired && isLicenseExpiringSoon(member.license_expiry_date!)

                  return (
                    <tr
                      key={member.id}
                      className="hover:bg-surface-border/30 transition-colors"
                      style={{ opacity: isInactive ? 0.5 : 1 }}
                    >
                      <td className="px-4 py-3">
                        <Link
                          to={`/team/${member.id}`}
                          className="font-medium text-[var(--color-text-primary)] hover:text-brand-green transition-colors"
                        >
                          {member.first_name} {member.last_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: `${ROLE_COLORS[member.role]}18`,
                            color: ROLE_COLORS[member.role],
                          }}
                        >
                          {ROLES[member.role]}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-[var(--color-text-muted)]">
                        {member.phone || '—'}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-[var(--color-text-muted)]">
                        {member.email || '—'}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {showLicense ? (
                          <>
                            {expired && (
                              <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                                Expired
                              </span>
                            )}
                            {expiringSoon && (
                              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                                Expiring Soon
                              </span>
                            )}
                            {!expired && !expiringSoon && (
                              <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                                Valid
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-[var(--color-text-muted)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isInactive ? (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                            Inactive
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            Active
                          </span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          {member.email && (
                            <button
                              onClick={(e) => {
                                e.preventDefault()
                                handleResendInvite(member.email!)
                              }}
                              disabled={resendingEmail === member.email}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[var(--color-text-muted)] hover:text-brand-green hover:bg-brand-green/10 transition-colors disabled:opacity-50 min-h-[36px]"
                              title="Send app invitation"
                            >
                              <Send size={14} />
                              <span className="hidden xl:inline">
                                {resendingEmail === member.email ? 'Sending…' : 'Invite to App'}
                              </span>
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      <AddMemberModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={refetch}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
