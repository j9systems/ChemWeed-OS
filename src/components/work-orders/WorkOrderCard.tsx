import { Link } from 'react-router'
import { Calendar, MapPin } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'
import { STATUS_COLORS } from '@/lib/constants'
import type { WorkOrder } from '@/types/database'

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string

function buildAddress(site: WorkOrder['site']) {
  if (!site) return ''
  return [site.address_line, site.city, site.state, site.zip].filter(Boolean).join(', ')
}

function streetViewUrl(address: string) {
  if (!address || !GOOGLE_MAPS_KEY) return null
  return `https://maps.googleapis.com/maps/api/streetview?size=600x200&location=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_KEY}`
}

interface WorkOrderCardProps {
  workOrder: WorkOrder
}

export function WorkOrderCard({ workOrder }: WorkOrderCardProps) {
  const colors = STATUS_COLORS[workOrder.status]
  const siteAddress = buildAddress(workOrder.site)
  const streetView = siteAddress ? streetViewUrl(siteAddress) : null

  return (
    <Link to={`/work-orders/${workOrder.id}`}>
      <div
        className={`rounded-[20px] bg-surface-raised shadow-card overflow-hidden border-l-[4px] ${colors.border} hover:shadow-md transition-shadow`}
      >
        {/* Street View Hero */}
        {streetView ? (
          <img
            src={streetView}
            alt={`Street view of ${siteAddress}`}
            className="w-full h-[120px] object-cover"
          />
        ) : (
          <div className="w-full h-[120px] bg-surface flex items-center justify-center text-[var(--color-text-muted)]">
            <div className="flex flex-col items-center gap-1">
              <MapPin size={20} />
              <span className="text-xs">No street view</span>
            </div>
          </div>
        )}

        {/* Card Body */}
        <div className="p-4 space-y-2">
          {/* Top row: client name + status badge */}
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-sm leading-tight truncate">
              {workOrder.client?.name ?? 'Unknown Client'}
            </p>
            <Badge status={workOrder.status} className="shrink-0" />
          </div>

          {/* Address */}
          <p className="text-xs text-[var(--color-text-muted)] leading-snug truncate">
            {workOrder.site?.address_line ?? 'No address'}
          </p>

          {/* Job type chip */}
          {workOrder.service_type?.name && (
            <span className="inline-block rounded-md bg-surface px-2 py-0.5 text-xs font-semibold text-[var(--color-text-primary)]">
              {workOrder.service_type.name}
            </span>
          )}

          {/* Date with icon */}
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
            <Calendar size={12} className="shrink-0" />
            <span>Due: {formatDate(workOrder.proposed_start_date)}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
