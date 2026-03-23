import { Phone, MessageSquare, Mail, Navigation } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { WORK_ORDER_STATUSES, getUrgencyColors } from '@/lib/constants'
import type { WorkOrder } from '@/types/database'

interface DetailsTabProps {
  workOrder: WorkOrder
}

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-[140px]">
      <dt className="text-xs text-[var(--color-text-muted)]">{label}</dt>
      <dd className="text-sm mt-0.5">{children}</dd>
    </div>
  )
}

function buildNavigationUrl(workOrder: WorkOrder) {
  const site = workOrder.site
  if (!site) return null
  if (site.latitude != null && site.longitude != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${site.latitude},${site.longitude}`
  }
  const addr = [site.address_line, site.city, site.state, site.zip].filter(Boolean).join(', ')
  if (!addr) return null
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`
}

interface ActionButtonProps {
  href: string | null
  icon: React.ReactNode
  label: string
}

function ActionButton({ href, icon, label }: ActionButtonProps) {
  if (!href) {
    return (
      <span
        className="inline-flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-[var(--color-text-muted)] opacity-40 cursor-not-allowed"
        title={`No ${label.toLowerCase()} available`}
      >
        {icon}
        <span className="text-[10px]">{label}</span>
      </span>
    )
  }

  return (
    <a
      href={href}
      className="inline-flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-[var(--color-text-muted)] hover:bg-surface hover:text-[var(--color-text-primary)] transition-colors"
      title={label}
    >
      {icon}
      <span className="text-[10px]">{label}</span>
    </a>
  )
}

export function DetailsTab({ workOrder }: DetailsTabProps) {
  const phone = workOrder.client?.billing_phone
  const email = workOrder.client?.billing_email
  const navUrl = buildNavigationUrl(workOrder)

  const phoneHref = phone ? `tel:${phone}` : null
  const smsHref = phone ? `sms:${phone}` : null
  const emailHref = email ? `mailto:${email}` : null

  return (
    <div>
      {/* Quick actions */}
      <div className="flex items-center gap-1 mb-4 border-b border-surface-border pb-3">
        <ActionButton href={phoneHref} icon={<Phone size={18} />} label="Call" />
        <ActionButton href={smsHref} icon={<MessageSquare size={18} />} label="Text" />
        <ActionButton href={emailHref} icon={<Mail size={18} />} label="Email" />
        <ActionButton href={navUrl} icon={<Navigation size={18} />} label="Navigate" />
      </div>

      <h2 className="text-sm font-semibold mb-3">Details</h2>
      <dl className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
        <DetailItem label="Client">{workOrder.client?.name ?? '—'}</DetailItem>
        <DetailItem label="Site">{workOrder.site?.name ?? '—'}</DetailItem>
        <DetailItem label="Status">{WORK_ORDER_STATUSES[workOrder.status]}</DetailItem>
        <DetailItem label="Urgency">
          {workOrder.urgency_level ? (
            <span className={`inline-block rounded-full px-3 py-0.5 text-xs font-medium border ${
              (() => {
                const c = getUrgencyColors(workOrder.urgency_level.key)
                return `${c.selectedBg} ${c.selectedText} ${c.selectedBorder}`
              })()
            }`}>
              {workOrder.urgency_level.label}
            </span>
          ) : '—'}
        </DetailItem>
        <DetailItem label="Service Type">{workOrder.service_type?.name ?? '—'}</DetailItem>
        <DetailItem label="Frequency">{workOrder.frequency_type ?? '—'}</DetailItem>
        <DetailItem label="Proposed Start">{formatDate(workOrder.proposed_start_date)}</DetailItem>
        {workOrder.completion_date && (
          <DetailItem label="Completed">{formatDate(workOrder.completion_date)}</DetailItem>
        )}
        <DetailItem label="PCA">
          {workOrder.pca ? `${workOrder.pca.first_name} ${workOrder.pca.last_name}` : '—'}
        </DetailItem>
        <DetailItem label="PO Number">{workOrder.po_number ?? '—'}</DetailItem>
        <div className="w-full">
          <DetailItem label="Reason / Scope">
            <span className="whitespace-pre-wrap">{workOrder.reason ?? '—'}</span>
          </DetailItem>
        </div>
      </dl>
    </div>
  )
}
