import { Link } from 'react-router'
import { RefreshCw, AlertTriangle } from 'lucide-react'
import { useTechDashboard } from '@/hooks/useTechDashboard'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { WorkOrderCard } from '@/components/work-orders/WorkOrderCard'

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

interface TechDashboardProps {
  teamMember: { id: string; first_name: string }
}

export function TechDashboard({ teamMember }: TechDashboardProps) {
  const { todayJobs, upcomingJobs, needsReportCount, isLoading, error, refetch } =
    useTechDashboard(teamMember.id)

  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorMessage message={error} onRetry={refetch} />

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
            {getGreeting()}, {teamMember.first_name}
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

      {/* Needs Report banner */}
      {needsReportCount > 0 && (
        <Link
          to="/work-orders"
          className="flex items-center gap-2 rounded-full bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm font-medium text-amber-800 hover:bg-amber-100 transition-colors"
        >
          <AlertTriangle size={16} className="shrink-0" />
          <span>
            {needsReportCount} completed job{needsReportCount > 1 ? 's' : ''} still need
            a field log
          </span>
        </Link>
      )}

      {/* Today's Jobs */}
      <div>
        <h2 className="text-lg font-semibold mb-3">
          Today
          {todayJobs.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-medium">
              {todayJobs.length}
            </span>
          )}
        </h2>
        {todayJobs.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] py-4">
            No jobs scheduled for today.
          </p>
        ) : (
          <div className="rounded-[20px] bg-surface-raised shadow-card overflow-hidden">
            {todayJobs.map((wo) => (
              <WorkOrderCard key={wo.id} wo={wo} variant="tech" />
            ))}
          </div>
        )}
      </div>

      {/* Upcoming */}
      <div>
        <h2 className="text-lg font-semibold mb-3">
          Upcoming
          {upcomingJobs.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-xs font-medium">
              {upcomingJobs.length}
            </span>
          )}
        </h2>
        {upcomingJobs.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] py-4">
            No jobs in the next 14 days.
          </p>
        ) : (
          <div className="rounded-[20px] bg-surface-raised shadow-card overflow-hidden">
            {upcomingJobs.map((wo) => (
              <WorkOrderCard key={wo.id} wo={wo} variant="tech" />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
