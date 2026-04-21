type Status = 'not_started' | 'created' | 'pending' | 'in_progress' | 'completed' | 'expired' | 'cancelled' | 'declined' | 'externally_signed' | string | null | undefined

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  not_started: { label: 'Not Sent', className: 'bg-gray-100 text-gray-600' },
  created: { label: 'Created', className: 'bg-gray-100 text-gray-600' },
  sent: { label: 'Sent', className: 'bg-blue-100 text-blue-700' },
  pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-700' },
  in_progress: { label: 'In Progress', className: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Signed', className: 'bg-green-100 text-green-700' },
  expired: { label: 'Expired', className: 'bg-orange-100 text-orange-700' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-600' },
  declined: { label: 'Declined', className: 'bg-red-100 text-red-600' },
  externally_signed: { label: 'External', className: 'bg-slate-100 text-slate-700' },
}

export function SigningStatusBadge({ status }: { status: Status }) {
  const defaultConfig = { label: 'Not Sent', className: 'bg-gray-100 text-gray-600' }
  const config = STATUS_CONFIG[status ?? 'not_started'] ?? defaultConfig
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  )
}
