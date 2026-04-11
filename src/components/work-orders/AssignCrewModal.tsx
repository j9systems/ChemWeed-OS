import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getSupabaseErrorMessage } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import type { TeamMember } from '@/types/database'

interface CrewMemberProp {
  id: string
  team_member_id: string
  role: string | null
  team_member: { id: string; first_name: string; last_name: string }
}

interface AssignCrewModalProps {
  workOrderId: string
  scheduledDate: string | null
  currentCrew: CrewMemberProp[]
  onClose: () => void
  onSaved: () => void
}

interface UnavailabilityBlock {
  all_day: boolean
  start_time: string | null
  end_time: string | null
}

interface TeamMemberRow {
  member: TeamMember
  unavailability: UnavailabilityBlock | null
  selected: boolean
  crewRole: string
}

const CREW_ROLES = [
  { value: '', label: '—' },
  { value: 'lead', label: 'Lead' },
  { value: 'technician', label: 'Technician' },
  { value: 'assistant', label: 'Assistant' },
]

export function AssignCrewModal({ workOrderId, scheduledDate, currentCrew, onClose, onSaved }: AssignCrewModalProps) {
  const [rows, setRows] = useState<TeamMemberRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    // Fetch active team members who can be assigned
    const { data: members, error: membersErr } = await supabase
      .from('team')
      .select('*')
      .eq('is_active', true)
      .in('role', ['technician', 'admin', 'manager'])
      .order('last_name')

    if (membersErr) {
      setError(membersErr.message)
      setIsLoading(false)
      return
    }

    const teamMembers = (members ?? []) as TeamMember[]

    // Check unavailability for each member on the scheduled date
    let unavailabilityMap = new Map<string, UnavailabilityBlock>()
    if (scheduledDate) {
      const { data: blocks } = await supabase
        .from('team_unavailability')
        .select('team_member_id, all_day, start_time, end_time')
        .lte('start_date', scheduledDate)
        .gte('end_date', scheduledDate)

      if (blocks) {
        for (const block of blocks) {
          // If multiple blocks, prefer all_day or just use the first one
          const existing = unavailabilityMap.get(block.team_member_id)
          if (!existing || block.all_day) {
            unavailabilityMap.set(block.team_member_id, {
              all_day: block.all_day,
              start_time: block.start_time,
              end_time: block.end_time,
            })
          }
        }
      }
    }

    // Build rows
    const currentCrewMap = new Map(currentCrew.map(c => [c.team_member_id, c.role ?? '']))

    setRows(
      teamMembers.map((m) => ({
        member: m,
        unavailability: unavailabilityMap.get(m.id) ?? null,
        selected: currentCrewMap.has(m.id),
        crewRole: currentCrewMap.get(m.id) ?? '',
      }))
    )

    setIsLoading(false)
  }, [scheduledDate, currentCrew])

  useEffect(() => { fetchData() }, [fetchData])

  function toggleMember(memberId: string) {
    setRows(prev => prev.map(r =>
      r.member.id === memberId ? { ...r, selected: !r.selected } : r
    ))
  }

  function setCrewRole(memberId: string, role: string) {
    setRows(prev => prev.map(r =>
      r.member.id === memberId ? { ...r, crewRole: role } : r
    ))
  }

  async function handleSave() {
    setIsSaving(true)
    setError(null)

    const selectedIds = new Set(rows.filter(r => r.selected).map(r => r.member.id))
    const currentIds = new Set(currentCrew.map(c => c.team_member_id))

    // Members to remove
    const toRemove = currentCrew.filter(c => !selectedIds.has(c.team_member_id))
    // Members to add
    const toAdd = rows.filter(r => r.selected && !currentIds.has(r.member.id))

    try {
      // Delete removed members
      if (toRemove.length > 0) {
        const { error: delErr } = await supabase
          .from('work_order_crew')
          .delete()
          .eq('work_order_id', workOrderId)
          .in('team_member_id', toRemove.map(c => c.team_member_id))

        if (delErr) throw new Error(getSupabaseErrorMessage(delErr))
      }

      // Insert new members
      if (toAdd.length > 0) {
        const { error: insErr } = await supabase
          .from('work_order_crew')
          .insert(toAdd.map(r => ({
            work_order_id: workOrderId,
            team_member_id: r.member.id,
            role: r.crewRole || null,
          })))

        if (insErr) throw new Error(getSupabaseErrorMessage(insErr))
      }

      // Update roles for existing members that stayed
      for (const row of rows) {
        if (row.selected && currentIds.has(row.member.id)) {
          const existingCrew = currentCrew.find(c => c.team_member_id === row.member.id)
          if (existingCrew && (existingCrew.role ?? '') !== row.crewRole) {
            await supabase
              .from('work_order_crew')
              .update({ role: row.crewRole || null })
              .eq('work_order_id', workOrderId)
              .eq('team_member_id', row.member.id)
          }
        }
      }

      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save crew assignments.')
      setIsSaving(false)
    }
  }

  return (
    <Modal open={true} onClose={onClose} title="Assign Crew">
      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div>
          {error && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {rows.map((row) => {
              const isAllDayUnavailable = row.unavailability?.all_day
              const isPartiallyUnavailable = row.unavailability && !row.unavailability.all_day

              return (
                <div
                  key={row.member.id}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 min-h-[44px] ${
                    isAllDayUnavailable ? 'opacity-50' : 'hover:bg-surface-raised'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={row.selected}
                    onChange={() => toggleMember(row.member.id)}
                    disabled={!!isAllDayUnavailable}
                    className="h-5 w-5 rounded border-surface-border text-brand-green focus:ring-brand-green shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">
                        {row.member.first_name} {row.member.last_name}
                      </span>
                      {isAllDayUnavailable && (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                          Unavailable
                        </span>
                      )}
                      {isPartiallyUnavailable && (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                          Partially unavailable {row.unavailability!.start_time}–{row.unavailability!.end_time}
                        </span>
                      )}
                    </div>
                  </div>
                  {row.selected && (
                    <select
                      value={row.crewRole}
                      onChange={(e) => setCrewRole(row.member.id, e.target.value)}
                      className="rounded-lg border border-surface-border bg-white px-2 py-1 text-xs min-h-[36px] w-28 shrink-0"
                    >
                      {CREW_ROLES.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-surface-border">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
