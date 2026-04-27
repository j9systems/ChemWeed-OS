import { useMemo, useState } from 'react'
import { Bug, Lightbulb, Plus, Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { useAuth } from '@/hooks/useAuth'
import { useFeedbackItems } from '@/hooks/useFeedbackItems'
import { FeedbackFormModal } from '@/components/feedback/FeedbackFormModal'
import { FeedbackDetailModal } from '@/components/feedback/FeedbackDetailModal'
import type { FeedbackItem, FeedbackPriority, FeedbackStatus, FeedbackType } from '@/types/database'

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
}
const STATUS_COLORS: Record<FeedbackStatus, string> = {
  open: 'bg-blue-50 text-blue-800',
  in_progress: 'bg-amber-50 text-amber-800',
  resolved: 'bg-green-50 text-green-800',
  closed: 'bg-gray-100 text-gray-600',
}

const PRIORITY_COLORS: Record<FeedbackPriority, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-50 text-blue-800',
  high: 'bg-red-50 text-red-800',
}

type TypeFilter = FeedbackType | 'all' | 'mine'

export function FeedbackPage() {
  const { user } = useAuth()
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | 'all'>('open')
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<FeedbackItem | null>(null)

  const filters = useMemo(() => ({
    type: typeFilter === 'mine' || typeFilter === 'all' ? 'all' as const : typeFilter,
    status: statusFilter,
    submittedBy: typeFilter === 'mine' ? user?.id : undefined,
  }), [typeFilter, statusFilter, user?.id])

  const { items, isLoading, error, refetch } = useFeedbackItems(filters)

  function nameFor(item: FeedbackItem): string {
    if (!item.submitted_by) return 'Unknown'
    if (item.submitted_by === user?.id) return 'You'
    return 'Team member'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Feedback</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Report bugs, request features, and track status.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus size={16} /> Submit
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'bug', 'feature', 'mine'] as TypeFilter[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTypeFilter(t)}
            className={`rounded-full px-3 py-1 text-sm font-medium border transition-colors ${
              typeFilter === t
                ? 'bg-brand-green/10 text-brand-green border-brand-green'
                : 'bg-gray-50 text-gray-700 border-gray-200 hover:opacity-80'
            }`}
          >
            {t === 'all' ? 'All' : t === 'bug' ? 'Bugs' : t === 'feature' ? 'Features' : 'Mine'}
          </button>
        ))}
        <div className="ml-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as FeedbackStatus | 'all')}
            className="rounded-lg border border-surface-border bg-white px-3 py-1.5 text-sm"
          >
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : error ? (
        <ErrorMessage message={error} onRetry={refetch} />
      ) : items.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--color-text-muted)] text-center">
            Nothing here yet. Click Submit to flag a bug or request a feature.
          </p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setSelected(item)}
                className="w-full text-left rounded-lg border border-surface-border bg-white px-4 py-3 hover:bg-surface-raised transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {item.type === 'bug' ? (
                        <Bug size={14} className="text-red-600 flex-shrink-0" />
                      ) : (
                        <Lightbulb size={14} className="text-amber-600 flex-shrink-0" />
                      )}
                      <span className="font-medium truncate">{item.title}</span>
                    </div>
                    {item.description && (
                      <p className="text-sm text-[var(--color-text-muted)] line-clamp-2">
                        {item.description}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${STATUS_COLORS[item.status]}`}>
                        {STATUS_LABELS[item.status]}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${PRIORITY_COLORS[item.priority]}`}>
                        {item.priority}
                      </span>
                      {item.attachments && item.attachments.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-[var(--color-text-muted)]">
                          <Paperclip size={12} /> {item.attachments.length}
                        </span>
                      )}
                      <span className="text-[var(--color-text-muted)]">
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <FeedbackFormModal
        open={showForm}
        onClose={() => setShowForm(false)}
        onSubmitted={refetch}
      />

      <FeedbackDetailModal
        open={selected !== null}
        item={selected}
        submitterName={selected ? nameFor(selected) : undefined}
        onClose={() => setSelected(null)}
        onUpdated={() => { refetch(); setSelected(null) }}
        onDeleted={() => { refetch(); setSelected(null) }}
      />
    </div>
  )
}
