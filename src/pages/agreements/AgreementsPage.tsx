import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Plus, Calendar, User } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useServiceAgreements } from '@/hooks/useServiceAgreements'
import { canEdit } from '@/lib/roles'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Badge } from '@/components/ui/Badge'
import { AGREEMENT_STATUSES, getServiceColor } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import { SigningStatusBadge } from '@/components/SigningStatusBadge'
import type { ServiceAgreement, AgreementStatus, ServiceType } from '@/types/database'

/** Extract unique service type names from line items, falling back to the agreement-level service_type */
function getServiceTypeNames(agreement: ServiceAgreement): string[] {
  const lineItems = (agreement as Record<string, unknown>).service_agreement_line_items as
    | { service_type: Pick<ServiceType, 'id' | 'name'> | null }[]
    | undefined
  const names = new Set<string>()
  if (lineItems) {
    for (const li of lineItems) {
      if (li.service_type?.name) names.add(li.service_type.name)
    }
  }
  if (names.size === 0 && agreement.service_type?.name) {
    names.add(agreement.service_type.name)
  }
  return Array.from(names)
}

function ServiceTypeBadges({ names }: { names: string[] }) {
  if (names.length === 0) return <span className="text-xs text-[var(--color-text-muted)]">—</span>

  const first = names[0]
  const sc = getServiceColor(first)
  const extra = names.length - 1

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${sc.bg} ${sc.text}`}>
        {first}
      </span>
      {extra > 0 && (
        <span
          className="inline-block rounded-md px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-600 cursor-default"
          title={names.slice(1).join(', ')}
        >
          +{extra} more
        </span>
      )}
    </span>
  )
}

function MobileRow({ agreement }: { agreement: ServiceAgreement }) {
  const navigate = useNavigate()
  const serviceNames = getServiceTypeNames(agreement)
  const sc = getServiceColor(serviceNames[0])
  const tech = agreement.pca ? `${agreement.pca.first_name} ${agreement.pca.last_name}` : null

  return (
    <button
      type="button"
      onClick={() => navigate(`/agreements/${agreement.id}`)}
      className="w-full text-left px-4 py-3 border-b border-surface-border last:border-0 hover:bg-surface transition-colors"
      style={{ borderLeft: `4px solid ${sc.border}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-sm truncate">{agreement.client?.name ?? 'Unknown Client'}</p>
        <div className="flex items-center gap-1.5">
          <SigningStatusBadge status={agreement.signing_status} />
          <Badge agreementStatus={agreement.agreement_status} />
        </div>
      </div>

      <p className="text-xs text-[var(--color-text-muted)] truncate mt-0.5">
        {agreement.site?.address_line ?? 'No address'}
      </p>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
        <ServiceTypeBadges names={serviceNames} />

        <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
          <User size={11} />
          {tech ?? <em>Unassigned</em>}
        </span>

        <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
          <Calendar size={11} />
          {formatDate(agreement.proposed_start_date)}
        </span>
      </div>
    </button>
  )
}

function TableRow({ agreement }: { agreement: ServiceAgreement }) {
  const navigate = useNavigate()
  const serviceNames = getServiceTypeNames(agreement)
  const sc = getServiceColor(serviceNames[0])
  const tech = agreement.pca ? `${agreement.pca.first_name} ${agreement.pca.last_name}` : null

  return (
    <tr
      onClick={() => navigate(`/agreements/${agreement.id}`)}
      className="border-b border-surface-border last:border-0 hover:bg-surface transition-colors cursor-pointer"
    >
      <td className="py-3 pl-4 pr-2">
        <span
          className="block w-1 h-6 rounded-full"
          style={{ backgroundColor: sc.border }}
        />
      </td>
      <td className="py-3 pr-4">
        <span className="font-medium text-sm">{agreement.client?.name ?? 'Unknown Client'}</span>
        <p className="text-xs text-[var(--color-text-muted)] truncate max-w-[220px]">
          {agreement.site?.address_line ?? 'No address'}
        </p>
      </td>
      <td className="py-3 pr-4">
        <ServiceTypeBadges names={serviceNames} />
      </td>
      <td className="py-3 pr-4 text-sm">
        {tech ?? <span className="text-[var(--color-text-muted)] italic text-xs">Unassigned</span>}
      </td>
      <td className="py-3 pr-4 text-sm text-[var(--color-text-muted)] whitespace-nowrap">
        {formatDate(agreement.proposed_start_date)}
      </td>
      <td className="py-3 pr-4">
        <SigningStatusBadge status={agreement.signing_status} />
      </td>
      <td className="py-3 pr-4">
        <Badge agreementStatus={agreement.agreement_status} />
      </td>
    </tr>
  )
}

export function AgreementsPage() {
  const { role } = useAuth()
  const [statusFilter, setStatusFilter] = useState<AgreementStatus | ''>('')
  const { agreements, isLoading, error, refetch } = useServiceAgreements(
    statusFilter ? { status: statusFilter } : undefined
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Agreements</h1>
        {canEdit(role) && (
          <Link to="/agreements/new">
            <Button size="md">
              <Plus size={18} />
              New Agreement
            </Button>
          </Link>
        )}
      </div>

      <div className="mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as AgreementStatus | '')}
          className="rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm min-h-[44px]"
        >
          <option value="">All Statuses</option>
          {(Object.entries(AGREEMENT_STATUSES) as [AgreementStatus, string][]).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {isLoading && <LoadingSpinner />}
      {error && <ErrorMessage message={error} onRetry={refetch} />}

      {!isLoading && !error && agreements.length === 0 && (
        <p className="py-8 text-center text-[var(--color-text-muted)]">
          No agreements found.
        </p>
      )}

      {!isLoading && !error && agreements.length > 0 && (
        <div className="rounded-[20px] bg-surface-raised shadow-card overflow-hidden">
          <table className="w-full text-sm hidden md:table">
            <thead>
              <tr className="border-b border-surface-border text-left text-xs text-[var(--color-text-muted)]">
                <th className="py-3 pl-4 pr-2 w-6" />
                <th className="py-3 pr-4 font-medium">Client / Site</th>
                <th className="py-3 pr-4 font-medium">Service</th>
                <th className="py-3 pr-4 font-medium">PCA</th>
                <th className="py-3 pr-4 font-medium">Start Date</th>
                <th className="py-3 pr-4 font-medium">eSign</th>
                <th className="py-3 pr-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {agreements.map((a) => (
                <TableRow key={a.id} agreement={a} />
              ))}
            </tbody>
          </table>

          <div className="md:hidden divide-y divide-surface-border">
            {agreements.map((a) => (
              <MobileRow key={a.id} agreement={a} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
