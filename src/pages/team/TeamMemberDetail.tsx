import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import { ArrowLeft, Camera, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useTeamUnavailability } from '@/hooks/useTeamUnavailability'
import { ROLES, WO_STATUS_COLORS, WORK_ORDER_STATUSES } from '@/lib/constants'
import { uploadProfilePhoto } from '@/lib/storage'
import { compressImage } from '@/lib/image-compression'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Toast } from '@/components/ui/Toast'
import type { TeamMember, Role, WorkOrderStatus } from '@/types/database'

const ROLE_COLORS: Record<Role, string> = {
  admin: '#2a6b2a',
  manager: '#3d8f3d',
  technician: '#1a6b9a',
  pca: '#7a4a1a',
}

const ROLE_OPTIONS = Object.entries(ROLES).map(([value, label]) => ({ value, label }))

interface CrewAssignment {
  crew_role: string
  work_order_id: string
  work_order_number: string
  scheduled_date: string | null
  completion_date: string | null
  status: WorkOrderStatus
  address_line: string | null
  city: string | null
}

function isLicenseExpired(date: string): boolean {
  return new Date(date) < new Date()
}

function isLicenseExpiringSoon(date: string): boolean {
  const expiry = new Date(date)
  const now = new Date()
  const sixtyDays = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)
  return expiry >= now && expiry <= sixtyDays
}

function AvailabilitySection({ teamMemberId, canDelete }: { teamMemberId: string; canDelete: boolean }) {
  const { teamMember: authMember } = useAuth()
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
  const [deleteError, setDeleteError] = useState<string | null>(null)

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
      created_by: authMember?.id ?? null,
    })

    if (result.error) {
      setFormError(result.error)
    } else {
      resetForm()
    }
    setSaving(false)
  }

  async function handleDelete(blockId: string) {
    setDeleteError(null)
    const result = await deleteBlock(blockId)
    if (result.error) {
      setDeleteError(result.error)
    }
  }

  return (
    <div className="rounded-[20px] bg-surface-raised shadow-card p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Availability</h3>
        {!showForm && (
          <Button variant="secondary" size="sm" onClick={() => setShowForm(true)}>
            Add Block
          </Button>
        )}
      </div>

      {deleteError && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {deleteError}
        </div>
      )}

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
              {canDelete && (
                <button
                  type="button"
                  onClick={() => handleDelete(block.id)}
                  className="rounded-lg p-2 text-[var(--color-text-muted)] hover:text-red-600 hover:bg-red-50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <Trash2 size={16} />
                </button>
              )}
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

export function TeamMemberDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { role: authRole, teamMember: authTeamMember } = useAuth()
  const isAdmin = authRole === 'admin'
  const isManager = authRole === 'manager'
  const isAdminOrManager = isAdmin || isManager
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [member, setMember] = useState<TeamMember | null>(null)
  const [assignments, setAssignments] = useState<CrewAssignment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [hasCrewRecords, setHasCrewRecords] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Form state
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [memberRole, setMemberRole] = useState<Role>('technician')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [active, setActive] = useState(true)
  const [notes, setNotes] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [licenseExpiry, setLicenseExpiry] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)

  const fetchMember = useCallback(async () => {
    if (!id) return
    setIsLoading(true)
    setError(null)

    const [memberRes, crewRes, crewCountRes] = await Promise.all([
      supabase.from('team').select('*').eq('id', id).single(),
      supabase
        .from('work_order_crew')
        .select(`
          role,
          work_order_id,
          work_orders!inner (
            id,
            work_order_number,
            scheduled_date,
            completion_date,
            status,
            sites!inner ( address_line, city )
          )
        `)
        .eq('team_member_id', id)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('work_order_crew')
        .select('id', { count: 'exact', head: true })
        .eq('team_member_id', id),
    ])

    if (memberRes.error) {
      setError(memberRes.error.message)
      setIsLoading(false)
      return
    }

    const m = memberRes.data as TeamMember
    setMember(m)
    setFirstName(m.first_name)
    setLastName(m.last_name)
    setMemberRole(m.role)
    setPhone(m.phone?.toString() ?? '')
    setEmail(m.email ?? '')
    setActive(m.is_active)
    setNotes(m.notes ?? '')
    setLicenseNumber(m.pesticide_license_number ?? '')
    setLicenseExpiry(m.license_expiry_date ?? '')
    setPhotoUrl(m.photo_url ?? null)

    setHasCrewRecords((crewCountRes.count ?? 0) > 0)

    if (!crewRes.error && crewRes.data) {
      const mapped = crewRes.data.map((row: any) => {
        const wo = row.work_orders
        const site = wo?.sites
        return {
          crew_role: row.role,
          work_order_id: wo?.id,
          work_order_number: wo?.work_order_number,
          scheduled_date: wo?.scheduled_date,
          completion_date: wo?.completion_date,
          status: wo?.status,
          address_line: site?.address_line,
          city: site?.city,
        }
      })
      // Sort by completion_date or scheduled_date desc
      mapped.sort((a: CrewAssignment, b: CrewAssignment) => {
        const dateA = a.completion_date ?? a.scheduled_date ?? ''
        const dateB = b.completion_date ?? b.scheduled_date ?? ''
        return dateB.localeCompare(dateA)
      })
      setAssignments(mapped)
    }

    setIsLoading(false)
  }, [id])

  useEffect(() => { fetchMember() }, [fetchMember])

  async function handleSave() {
    if (!id) return
    setIsSaving(true)

    const updates: Record<string, unknown> = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      role: memberRole,
      phone: phone.trim() || null,
      email: email.trim() || null,
      is_active: active,
      notes: notes.trim() || null,
    }

    if (memberRole === 'pca' || memberRole === 'technician') {
      updates.pesticide_license_number = licenseNumber.trim() || null
      updates.license_expiry_date = licenseExpiry || null
    }

    const { error: err } = await supabase.from('team').update(updates).eq('id', id)
    setIsSaving(false)

    if (err) {
      setToast({ message: err.message, type: 'error' })
    } else {
      setToast({ message: 'Changes saved.', type: 'success' })
      fetchMember()
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !id) return

    setIsUploadingPhoto(true)
    try {
      const compressed = await compressImage(file, 400, 0.8)
      const url = await uploadProfilePhoto(id, compressed)

      const { error: err } = await supabase
        .from('team')
        .update({ photo_url: url })
        .eq('id', id)

      if (err) {
        setToast({ message: `Failed to save photo: ${err.message}`, type: 'error' })
      } else {
        setPhotoUrl(url + '?t=' + Date.now())
        setToast({ message: 'Profile photo updated.', type: 'success' })
      }
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Photo upload failed.', type: 'error' })
    } finally {
      setIsUploadingPhoto(false)
      // Reset file input so re-selecting same file triggers change
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDelete() {
    if (!id || hasCrewRecords) return
    const { data, error: err } = await supabase.functions.invoke('delete-team-member', {
      body: { team_member_id: id, email: email || null },
    })
    if (err) {
      setToast({ message: err.message, type: 'error' })
    } else if (data?.error) {
      setToast({ message: data.error, type: 'error' })
    } else {
      navigate('/team')
    }
  }

  function handleToggleActive() {
    setActive(!active)
  }

  if (isLoading) return <LoadingSpinner message="Loading team member…" />
  if (error) return <ErrorMessage message={error} onRetry={fetchMember} />
  if (!member) return <ErrorMessage message="Team member not found." />

  const showLicenseSection = memberRole === 'pca' || memberRole === 'technician'
  const licenseExpired = licenseExpiry && isLicenseExpired(licenseExpiry)
  const licenseExpiringSoon = licenseExpiry && !licenseExpired && isLicenseExpiringSoon(licenseExpiry)

  // Show availability if admin/manager, or if tech viewing their own profile
  const showAvailability = isAdminOrManager || (authRole === 'technician' && authTeamMember?.id === id)
  // Admin/manager can delete any block; techs can delete their own
  const canDeleteBlocks = isAdminOrManager || (authRole === 'technician' && authTeamMember?.id === id)

  return (
    <div className="pb-20 md:pb-0 max-w-2xl">
      {/* Back button */}
      <Link to="/team" className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mb-4 min-h-[44px]">
        <ArrowLeft size={16} />
        Back to Team
      </Link>

      {/* Header with photo */}
      <div className="flex items-start gap-4 mb-6">
        {/* Profile Photo */}
        <div className="relative flex-shrink-0">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-surface-border flex items-center justify-center">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={`${member.first_name} ${member.last_name}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-2xl font-bold text-[var(--color-text-muted)]">
                {member.first_name.charAt(0)}{member.last_name.charAt(0)}
              </span>
            )}
          </div>
          {isAdmin && (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPhoto}
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-brand-green text-white flex items-center justify-center shadow-md hover:bg-brand-green/90 transition-colors disabled:opacity-50"
                title="Upload photo"
              >
                <Camera size={14} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </>
          )}
          {isUploadingPhoto && (
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
              {member.first_name} {member.last_name}
            </h1>
            <span
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
              style={{
                backgroundColor: `${ROLE_COLORS[member.role]}18`,
                color: ROLE_COLORS[member.role],
              }}
            >
              {ROLES[member.role]}
            </span>
            {!member.is_active && (
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                Inactive
              </span>
            )}
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2 mt-2">
              <Button variant="secondary" size="sm" onClick={handleToggleActive}>
                {active ? 'Deactivate' : 'Activate'}
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Edit Form */}
      <div className="rounded-[20px] bg-surface-raised shadow-card p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="First Name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            disabled={!isAdmin}
            required
          />
          <Input
            label="Last Name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            disabled={!isAdmin}
            required
          />
        </div>

        <div className="mt-4">
          <Select
            label="Role"
            value={memberRole}
            onChange={(e) => setMemberRole(e.target.value as Role)}
            options={ROLE_OPTIONS}
            disabled={!isAdmin}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Input
            label="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={!isAdmin}
            type="tel"
          />
          <Input
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!isAdmin}
            type="email"
          />
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Notes</label>
          <textarea
            className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] min-h-[80px] transition-colors focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={!isAdmin}
          />
        </div>

        {/* License section */}
        {showLicenseSection && (
          <div className="mt-6 border-t border-surface-border pt-4">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">License Info</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Pesticide License #"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                disabled={!isAdmin}
              />
              <Input
                label="License Expiry Date"
                type="date"
                value={licenseExpiry}
                onChange={(e) => setLicenseExpiry(e.target.value)}
                disabled={!isAdmin}
              />
            </div>
            {licenseExpired && (
              <span className="mt-2 inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                License Expired
              </span>
            )}
            {licenseExpiringSoon && (
              <span className="mt-2 inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                Expiring Soon
              </span>
            )}
          </div>
        )}
      </div>

      {/* Recent Work Orders */}
      <div className="rounded-[20px] bg-surface-raised shadow-card p-4 mb-6">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Recent Jobs</h3>
        {assignments.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No jobs recorded yet.</p>
        ) : (
          <div className="divide-y divide-surface-border">
            {assignments.map((a, i) => {
              const statusColor = WO_STATUS_COLORS[a.status]
              const displayDate = a.completion_date ?? a.scheduled_date
              return (
                <Link
                  key={i}
                  to={`/work-orders/${a.work_order_id}`}
                  className="flex items-center justify-between py-2.5 hover:bg-surface-border/30 -mx-2 px-2 rounded-lg transition-colors min-h-[44px]"
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {a.work_order_number}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {[a.address_line, a.city].filter(Boolean).join(', ')}
                    </p>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    {displayDate && (
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {new Date(displayDate).toLocaleDateString()}
                      </span>
                    )}
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColor?.bg ?? ''} ${statusColor?.text ?? ''}`}>
                      {WORK_ORDER_STATUSES[a.status] ?? a.status}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Availability section */}
      {showAvailability && id && (
        <AvailabilitySection teamMemberId={id} canDelete={canDeleteBlocks} />
      )}

      {/* Delete button (admin only) */}
      {isAdmin && (
        <div className="rounded-[20px] bg-surface-raised shadow-card p-4">
          {hasCrewRecords ? (
            <div>
              <Button variant="danger" size="md" disabled>
                Delete Member
              </Button>
              <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                Cannot delete — member has job history. Deactivate instead.
              </p>
            </div>
          ) : showDeleteConfirm ? (
            <div className="flex items-center gap-3">
              <p className="text-sm text-red-700">Are you sure? This cannot be undone.</p>
              <Button variant="danger" size="sm" onClick={handleDelete}>
                Confirm Delete
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="danger" size="md" onClick={() => setShowDeleteConfirm(true)}>
              Delete Member
            </Button>
          )}
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
