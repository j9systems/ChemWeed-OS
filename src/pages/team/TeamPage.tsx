import { useState } from 'react'
import { Link } from 'react-router'
import { Plus } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTeamMembers } from '@/hooks/useTeam'
import { ROLES } from '@/lib/constants'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { AddMemberModal } from '@/components/team/AddMemberModal'
import type { Role } from '@/types/database'

const ROLE_COLORS: Record<Role, string> = {
  admin: '#2a6b2a',
  manager: '#3d8f3d',
  tech: '#1a6b9a',
  pca: '#7a4a1a',
}

const ROLE_FILTERS: Array<{ value: Role | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'tech', label: 'Technician' },
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

  const isAdmin = role === 'admin'

  const filtered = members.filter((m) => {
    if (roleFilter !== 'all' && m.role !== roleFilter) return false
    if (showActiveOnly && m.active !== 'true') return false
    return true
  })

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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {filtered.map((member) => {
            const isInactive = member.active !== 'true'
            const showLicense = (member.role === 'pca' || member.role === 'tech') && member.license_expiry_date
            const expired = showLicense && isLicenseExpired(member.license_expiry_date!)
            const expiringSoon = showLicense && !expired && isLicenseExpiringSoon(member.license_expiry_date!)

            return (
              <Link
                key={member.id}
                to={`/team/${member.id}`}
                className="block"
              >
                <div
                  className="rounded-[20px] bg-surface-raised shadow-card overflow-hidden hover:border-brand-green/30 border border-transparent transition-colors cursor-pointer h-full"
                  style={{
                    borderLeft: `4px solid ${ROLE_COLORS[member.role]}`,
                    opacity: isInactive ? 0.5 : 1,
                  }}
                >
                  <div className="p-3">
                    <p className="font-semibold text-sm text-[var(--color-text-primary)] truncate">
                      {member.first_name} {member.last_name}
                    </p>
                    <span
                      className="mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor: `${ROLE_COLORS[member.role]}18`,
                        color: ROLE_COLORS[member.role],
                      }}
                    >
                      {ROLES[member.role]}
                    </span>
                    {isInactive && (
                      <span className="ml-1 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                        Inactive
                      </span>
                    )}
                    {member.phone && (
                      <p className="mt-1.5 text-xs text-[var(--color-text-muted)] truncate">{member.phone}</p>
                    )}
                    {member.email && (
                      <p className="text-xs text-[var(--color-text-muted)] truncate">{member.email}</p>
                    )}
                    {expired && (
                      <span className="mt-1.5 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        License Expired
                      </span>
                    )}
                    {expiringSoon && (
                      <span className="mt-1.5 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Expiring Soon
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Add Member Modal */}
      <AddMemberModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={refetch}
      />
    </div>
  )
}
