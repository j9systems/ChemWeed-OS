import { useNavigate } from 'react-router'
import { MapPin } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { getServiceColor, formatPeriodLabel } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import type { WorkOrder } from '@/types/database'

function CrewInitials({ crew }: { crew: WorkOrder['work_order_crew'] }) {
  const members = crew ?? []
  if (members.length === 0) {
    return <span className="text-xs italic text-[var(--color-text-muted)]">Unassigned</span>
  }

  const shown = members.slice(0, 3)
  const extra = members.length - 3

  return (
    <div className="flex items-center -space-x-1.5">
      {shown.map((c) => {
        const tm = c.team_member
        const initials = tm
          ? `${tm.first_name.charAt(0)}${tm.last_name.charAt(0)}`
          : '??'
        return (
          <span
            key={c.id}
            className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 text-[10px] font-semibold text-gray-700 ring-2 ring-white"
            title={tm ? `${tm.first_name} ${tm.last_name}` : undefined}
          >
            {initials}
          </span>
        )
      })}
      {extra > 0 && (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-[10px] font-medium text-gray-500 ring-2 ring-white">
          +{extra}
        </span>
      )}
    </div>
  )
}

function buildAddressUrl(wo: WorkOrder): string | null {
  const site = wo.site
  if (!site) return null
  if (site.latitude != null && site.longitude != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${site.latitude},${site.longitude}`
  }
  const addr = [site.address_line, site.city, site.state, site.zip].filter(Boolean).join(', ')
  if (!addr) return null
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`
}

interface WorkOrderCardProps {
  wo: WorkOrder
  variant?: 'admin' | 'tech'
}

function AdminCard({ wo }: { wo: WorkOrder }) {
  const navigate = useNavigate()
  const sc = getServiceColor(wo.service_type?.name)

  const dateLabel = wo.scheduled_date
    ? `Scheduled: ${formatDate(wo.scheduled_date)}`
    : wo.service_agreement?.proposed_start_date
      ? `Proposed: ${formatDate(wo.service_agreement.proposed_start_date)}`
      : null

  return (
    <button
      type="button"
      onClick={() => navigate(`/work-orders/${wo.id}`)}
      className="w-full text-left px-4 py-3 border-b border-surface-border last:border-0 hover:bg-surface transition-colors"
      style={{ borderLeft: `4px solid ${sc.border}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-sm truncate">{wo.client?.name ?? 'Unknown Client'}</p>
        <Badge status={wo.status} />
      </div>
      <p className="text-xs text-[var(--color-text-muted)] truncate mt-0.5">
        {wo.site ? [wo.site.address_line, wo.site.city].filter(Boolean).join(', ') : 'No site'}
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
        {wo.service_type?.name && (
          <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${sc.bg} ${sc.text}`}>
            {wo.service_type.name}
          </span>
        )}
        <CrewInitials crew={wo.work_order_crew} />
      </div>
      <div className="flex items-center gap-3 mt-1.5">
        {dateLabel && (
          <span className="text-xs text-[var(--color-text-muted)]">{dateLabel}</span>
        )}
        <span className="text-xs text-[var(--color-text-muted)]">{formatPeriodLabel(wo)}</span>
      </div>
    </button>
  )
}

function TechCard({ wo }: { wo: WorkOrder }) {
  const navigate = useNavigate()
  const sc = getServiceColor(wo.service_type?.name)
  const addressUrl = buildAddressUrl(wo)
  const address = wo.site
    ? [wo.site.address_line, wo.site.city].filter(Boolean).join(', ')
    : null

  return (
    <div
      onClick={() => navigate(`/work-orders/${wo.id}`)}
      className="w-full text-left px-4 py-3 border-b border-surface-border last:border-0 hover:bg-surface transition-colors cursor-pointer"
      style={{ borderLeft: `4px solid ${sc.border}` }}
    >
      {/* Scheduled date + time — prominent top line */}
      {wo.scheduled_date ? (
        <p className="text-base font-bold">
          {formatDate(wo.scheduled_date)}
          {wo.scheduled_time && (
            <span className="ml-2 text-sm font-medium text-[var(--color-text-muted)]">{wo.scheduled_time}</span>
          )}
        </p>
      ) : (
        <p className="text-base font-bold text-[var(--color-text-muted)]">Not yet scheduled</p>
      )}

      {/* Client + site */}
      <p className="text-sm font-medium mt-1 truncate">
        {wo.client?.name ?? 'Unknown Client'}
        {wo.site?.name ? ` — ${wo.site.name}` : ''}
      </p>

      {/* Address as tappable link */}
      {address && (
        addressUrl ? (
          <a
            href={addressUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-xs text-blue-600 hover:underline mt-0.5 min-h-[44px] py-2"
          >
            <MapPin size={14} className="shrink-0" />
            <span className="truncate">{address}</span>
          </a>
        ) : (
          <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] mt-0.5">
            <MapPin size={14} className="shrink-0" />
            <span className="truncate">{address}</span>
          </div>
        )
      )}

      {/* Service type pill */}
      {wo.service_type?.name && (
        <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold mt-1.5 ${sc.bg} ${sc.text}`}>
          {wo.service_type.name}
        </span>
      )}

      {/* Tech instructions callout */}
      {wo.notes_technician && (
        <div className="mt-2 bg-amber-50 border-l-4 border-amber-400 px-3 py-2 rounded-r">
          <p className="text-xs font-semibold text-amber-900 mb-0.5">Instructions</p>
          <p className="text-xs text-amber-900 line-clamp-2">{wo.notes_technician}</p>
        </div>
      )}

      {/* Crew + status */}
      <div className="flex items-center justify-between mt-2">
        <CrewInitials crew={wo.work_order_crew} />
        <Badge status={wo.status} />
      </div>
    </div>
  )
}

export function WorkOrderCard({ wo, variant = 'admin' }: WorkOrderCardProps) {
  if (variant === 'tech') {
    return <TechCard wo={wo} />
  }
  return <AdminCard wo={wo} />
}
