import { useState } from 'react'
import { LogOut, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTeamUnavailability } from '@/hooks/useTeamUnavailability'
import { ROLES } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

function AvailabilitySection({ teamMemberId }: { teamMemberId: string }) {
  const { teamMember } = useAuth()
  const { blocks, isLoading, error, addBlock, deleteBlock } = useTeamUnavailability(teamMemberId)
  const [showForm, setShowForm] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [allDay, setAllDay] = useState(true)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function resetForm() {
    setStartDate('')
    setEndDate('')
    setAllDay(true)
    setStartTime('')
    setEndTime('')
    setReason('')
    setFormError(null)
    setShowForm(false)
  }

  async function handleSave() {
    if (!startDate) {
      setFormError('Start date is required.')
      return
    }
    setSaving(true)
    setFormError(null)

    const result = await addBlock({
      team_member_id: teamMemberId,
      start_date: startDate,
      end_date: endDate || startDate,
      all_day: allDay,
      start_time: allDay ? null : (startTime || null),
      end_time: allDay ? null : (endTime || null),
      reason: reason.trim() || null,
      created_by: teamMember?.id ?? null,
    })

    if (result.error) {
      setFormError(result.error)
    } else {
      resetForm()
    }
    setSaving(false)
  }

  async function handleDelete(blockId: string) {
    await deleteBlock(blockId)
  }

  return (
    <div className="rounded-[20px] bg-surface-raised shadow-card p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">My Availability</h3>
        {!showForm && (
          <Button variant="secondary" size="sm" onClick={() => setShowForm(true)}>
            Add Block
          </Button>
        )}
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : blocks.length === 0 && !showForm ? (
        <p className="text-sm text-[var(--color-text-muted)]">No unavailability blocks set.</p>
      ) : (
        <div className="space-y-2 mb-3">
          {blocks.map((block) => (
            <div
              key={block.id}
              className="flex items-center justify-between rounded-lg border border-surface-border px-3 py-2 min-h-[44px]"
            >
              <div>
                <p className="text-sm font-medium">
                  {formatDate(block.start_date)}
                  {block.end_date !== block.start_date && ` – ${formatDate(block.end_date)}`}
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {block.all_day
                    ? 'Full day'
                    : `${block.start_time ?? '?'} – ${block.end_time ?? '?'}`}
                  {block.reason && ` — ${block.reason}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(block.id)}
                className="rounded-lg p-2 text-[var(--color-text-muted)] hover:text-red-600 hover:bg-red-50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="border-t border-surface-border pt-3 mt-3">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                if (!endDate) setEndDate(e.target.value)
              }}
              required
            />
            <Input
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>

          <div className="mt-3">
            <label className="flex items-center gap-3 rounded-lg px-3 py-2 min-h-[44px] cursor-pointer">
              <input
                type="checkbox"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
                className="h-5 w-5 rounded border-surface-border text-brand-green focus:ring-brand-green"
              />
              <span className="text-sm">Full day</span>
            </label>
          </div>

          {!allDay && (
            <div className="grid grid-cols-2 gap-3 mt-2">
              <Input
                label="Start Time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
              <Input
                label="End Time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          )}

          <div className="mt-3">
            <Input
              label="Reason (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Vacation, appointment, etc."
            />
          </div>

          {formError && (
            <p className="mt-2 text-sm text-red-600">{formError}</p>
          )}

          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="secondary" size="sm" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export function ProfilePage() {
  const { teamMember, role, signOut } = useAuth()

  if (!teamMember) {
    return <LoadingSpinner />
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Profile</h1>

      {/* Profile info */}
      <div className="rounded-[20px] bg-surface-raised shadow-card p-4 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-surface-border flex items-center justify-center">
            {teamMember.photo_url ? (
              <img
                src={teamMember.photo_url}
                alt={`${teamMember.first_name} ${teamMember.last_name}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xl font-bold text-[var(--color-text-muted)]">
                {teamMember.first_name.charAt(0)}{teamMember.last_name.charAt(0)}
              </span>
            )}
          </div>
          <div>
            <h2 className="text-lg font-semibold">{teamMember.first_name} {teamMember.last_name}</h2>
            <p className="text-sm text-[var(--color-text-muted)]">{role ? ROLES[role] : '—'}</p>
          </div>
        </div>

        <dl className="space-y-3">
          {teamMember.phone && (
            <div>
              <dt className="text-xs text-[var(--color-text-muted)]">Phone</dt>
              <dd className="text-sm">{teamMember.phone}</dd>
            </div>
          )}
          {teamMember.email && (
            <div>
              <dt className="text-xs text-[var(--color-text-muted)]">Email</dt>
              <dd className="text-sm">{teamMember.email}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Availability */}
      <AvailabilitySection teamMemberId={teamMember.id} />

      {/* Sign out */}
      <div className="rounded-[20px] bg-surface-raised shadow-card p-4">
        <Button variant="danger" size="md" onClick={signOut}>
          <LogOut size={16} />
          Sign Out
        </Button>
      </div>
    </div>
  )
}
