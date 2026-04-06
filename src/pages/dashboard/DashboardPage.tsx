import { useNavigate } from 'react-router'
import {
  FileText,
  Send,
  CheckCircle,
  ClipboardList,
  CheckSquare,
  RefreshCw,
  HandshakeIcon,
  PenLine,
  MailQuestion,
  Users,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useDashboard } from '@/hooks/useDashboard'
import { SigningStatusBadge } from '@/components/SigningStatusBadge'
import { formatRelativeTime, getDaysSince } from '@/lib/formatRelativeTime'
import { cn } from '@/lib/utils'
import type { ActivityItem } from '@/hooks/useDashboard'

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatTodayDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const ACTIVITY_ICONS: Record<string, typeof FileText> = {
  proposal_created: FileText,
  proposal_sent: Send,
  agreement_signed: CheckCircle,
  field_log_submitted: ClipboardList,
  work_order_completed: CheckSquare,
}

function getActivityIcon(type: string) {
  const Icon = ACTIVITY_ICONS[type] ?? FileText
  const color = type === 'agreement_signed' ? 'text-green-600' : 'text-[var(--color-text-muted)]'
  return <Icon size={18} className={color} />
}

function urgencyClass(daysSince: number): string {
  if (daysSince >= 7) return 'border-l-red-500'
  if (daysSince >= 3) return 'border-l-amber-500'
  return 'border-l-transparent'
}

// --- Skeleton components ---

function StatCardSkeleton() {
  return (
    <div className="min-w-[140px] flex-1 rounded-[20px] bg-white border border-surface-border p-4">
      <div className="h-8 w-16 rounded bg-gray-200 animate-pulse mb-2" />
      <div className="h-4 w-24 rounded bg-gray-200 animate-pulse" />
    </div>
  )
}

function ProposalRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-l-4 border-l-transparent">
      <div className="flex-1 space-y-2">
        <div className="h-4 w-32 rounded bg-gray-200 animate-pulse" />
        <div className="h-3 w-48 rounded bg-gray-200 animate-pulse" />
      </div>
      <div className="h-5 w-16 rounded-full bg-gray-200 animate-pulse" />
    </div>
  )
}

function ActivityRowSkeleton() {
  return (
    <div className="flex gap-3 px-4 py-3">
      <div className="h-5 w-5 rounded bg-gray-200 animate-pulse mt-0.5" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-40 rounded bg-gray-200 animate-pulse" />
        <div className="h-3 w-56 rounded bg-gray-200 animate-pulse" />
      </div>
    </div>
  )
}

// --- Main page ---

export function DashboardPage() {
  const { teamMember } = useAuth()
  const { data, isLoading, errors, refetch } = useDashboard()
  const navigate = useNavigate()

  const firstName = teamMember?.first_name ?? 'there'

  const statCards = [
    { label: 'Active Agreements', value: data?.stats.activeAgreements, icon: HandshakeIcon },
    { label: 'Pending Signatures', value: data?.stats.pendingSignatures, icon: PenLine },
    { label: 'Awaiting Send', value: data?.stats.awaitingSend, icon: MailQuestion },
    { label: 'Active Clients', value: data?.stats.activeClients, icon: Users },
  ]

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
            {getGreeting()}, {firstName}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{formatTodayDate()}</p>
        </div>
        <button
          onClick={refetch}
          className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
          title="Refresh"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Stats strip */}
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
          : statCards.map((card) => (
              <div
                key={card.label}
                className="min-w-[140px] flex-1 rounded-[20px] bg-white border border-surface-border p-4 border-l-4 border-l-brand-green"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-2xl font-bold text-[var(--color-text-primary)]">
                    {card.value ?? 0}
                  </span>
                  <card.icon size={20} className="text-brand-green opacity-60" />
                </div>
                <p className="text-xs text-[var(--color-text-muted)] font-medium">{card.label}</p>
              </div>
            ))}
      </div>
      {errors.stats && <InlineError message={errors.stats} />}

      {/* Two-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Needs Attention */}
        <div className="rounded-[20px] bg-white border border-surface-border overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-border">
            <h2 className="text-sm font-bold text-[var(--color-text-primary)]">
              Proposals Needing Action
            </h2>
          </div>

          {isLoading ? (
            <div className="divide-y divide-surface-border">
              {Array.from({ length: 4 }).map((_, i) => <ProposalRowSkeleton key={i} />)}
            </div>
          ) : errors.proposals ? (
            <InlineError message={errors.proposals} />
          ) : data?.proposals.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <CheckCircle size={28} className="mx-auto text-brand-green mb-2" />
              <p className="text-sm text-[var(--color-text-muted)]">
                No proposals pending. You're all caught up.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-surface-border">
              {data?.proposals.map((p) => {
                const days = getDaysSince(p.created_at)
                return (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/agreements/${p.id}`)}
                    className={cn(
                      'w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-l-4',
                      urgencyClass(days),
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                        {p.client?.name ?? 'Unknown Client'}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)] truncate">
                        {p.site?.address_line}{p.site?.city ? `, ${p.site.city}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <SigningStatusBadge status={p.signing_status} />
                      <span className="text-[11px] text-[var(--color-text-muted)]">
                        {formatRelativeTime(p.created_at)}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="rounded-[20px] bg-white border border-surface-border overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-border">
            <h2 className="text-sm font-bold text-[var(--color-text-primary)]">Recent Activity</h2>
          </div>

          {isLoading ? (
            <div className="divide-y divide-surface-border">
              {Array.from({ length: 5 }).map((_, i) => <ActivityRowSkeleton key={i} />)}
            </div>
          ) : errors.activities ? (
            <InlineError message={errors.activities} />
          ) : data?.activities.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-[var(--color-text-muted)]">No recent activity.</p>
            </div>
          ) : (
            <div className="divide-y divide-surface-border">
              {data?.activities.map((a: ActivityItem) => (
                <div key={a.id} className="flex gap-3 px-4 py-3">
                  <div className="mt-0.5 shrink-0">{getActivityIcon(a.activity_type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {a.title}
                    </p>
                    {a.description && (
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5 line-clamp-2">
                        {a.description}
                      </p>
                    )}
                    {a.agreement && (
                      <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                        {a.agreement.agreement_number}
                        {a.agreement.client?.name ? ` · ${a.agreement.client.name}` : ''}
                      </p>
                    )}
                  </div>
                  <span className="text-[11px] text-[var(--color-text-muted)] shrink-0 mt-0.5">
                    {formatRelativeTime(a.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function InlineError({ message }: { message: string }) {
  return (
    <div className="mx-4 my-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
      Failed to load: {message}
    </div>
  )
}
