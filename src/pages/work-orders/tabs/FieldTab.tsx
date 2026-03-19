import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { ChevronDown, ChevronUp, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatDateTime, getSupabaseErrorMessage } from '@/lib/utils'
import { canEdit } from '@/lib/roles'
import { useTeamMembers } from '@/hooks/useTeam'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { WorkOrder, WorkOrderMaterial, FieldCompletion, Role } from '@/types/database'

interface FieldTabProps {
  workOrder: WorkOrder
  materials: WorkOrderMaterial[]
  role: Role | null
  siteId: string
  userId: string | undefined
  refetchSiteProfile: () => void
}

export function FieldTab({ workOrder, materials, role, siteId, userId, refetchSiteProfile }: FieldTabProps) {
  const [completion, setCompletion] = useState<FieldCompletion | null>(null)
  const [loadingCompletion, setLoadingCompletion] = useState(false)
  const { members } = useTeamMembers()

  // Fetch field completion data if completed/invoiced
  const isCompleted = workOrder.status === 'completed' || workOrder.status === 'invoiced'
  useEffect(() => {
    if (!isCompleted) return
    setLoadingCompletion(true)
    supabase
      .from('field_completions')
      .select('*')
      .eq('work_order_id', workOrder.id)
      .maybeSingle()
      .then(({ data }) => {
        setCompletion(data as FieldCompletion | null)
        setLoadingCompletion(false)
      })
  }, [workOrder.id, isCompleted])

  function getCrewNames(crewIds: string[]): string {
    return crewIds
      .map((id) => {
        const m = members.find((t) => t.id === id)
        return m ? `${m.first_name} ${m.last_name}` : id
      })
      .join(', ')
  }

  return (
    <div className="space-y-4">
      {/* Field Completion Data */}
      {!isCompleted ? (
        <Card>
          <p className="text-sm text-[var(--color-text-muted)] mb-3">This work order has not been completed yet.</p>
          {workOrder.status === 'in_progress' && (
            <Link to={`/work-orders/${workOrder.id}/complete`}>
              <Button size="sm">
                <CheckCircle size={16} />
                Complete Job
              </Button>
            </Link>
          )}
        </Card>
      ) : loadingCompletion ? (
        <Card>
          <p className="text-sm text-[var(--color-text-muted)]">Loading field data...</p>
        </Card>
      ) : completion ? (
        <>
          <Card>
            <h2 className="text-sm font-semibold mb-3">Field Completion</h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-[var(--color-text-muted)]">Completed At</dt>
                <dd>{formatDateTime(completion.actual_start_at)}</dd>
              </div>
              {completion.temperature_f != null && (
                <div>
                  <dt className="text-[var(--color-text-muted)]">Temperature</dt>
                  <dd>{completion.temperature_f}°F</dd>
                </div>
              )}
              {completion.wind_speed_mph != null && (
                <div>
                  <dt className="text-[var(--color-text-muted)]">Wind</dt>
                  <dd>{completion.wind_speed_mph} mph {completion.wind_direction ?? ''}</dd>
                </div>
              )}
              {completion.crew_ids.length > 0 && (
                <div>
                  <dt className="text-[var(--color-text-muted)]">Crew On Site</dt>
                  <dd>{getCrewNames(completion.crew_ids)}</dd>
                </div>
              )}
              {completion.notes && (
                <div>
                  <dt className="text-[var(--color-text-muted)]">Notes</dt>
                  <dd className="whitespace-pre-wrap">{completion.notes}</dd>
                </div>
              )}
            </dl>
          </Card>

          {/* Photos */}
          {completion.photo_urls.length > 0 && (
            <Card>
              <h2 className="text-sm font-semibold mb-3">Photos</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {completion.photo_urls.map((url, i) => (
                  <img key={i} src={url} alt={`Photo ${i + 1}`} className="rounded-lg w-full h-32 object-cover" />
                ))}
              </div>
            </Card>
          )}

          {/* Material Actuals */}
          {materials.some((m) => m.actual_amount_used != null) && (
            <Card>
              <h2 className="text-sm font-semibold mb-3">Material Actuals</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-border text-left text-[var(--color-text-muted)]">
                      <th className="pb-2 pr-4">Chemical</th>
                      <th className="pb-2 pr-4">Recommended</th>
                      <th className="pb-2">Actual Used</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materials.map((m) => (
                      <tr key={m.id} className="border-b border-surface-border last:border-0">
                        <td className="py-2 pr-4">{m.chemical?.name ?? '—'}</td>
                        <td className="py-2 pr-4">{m.recommended_amount ?? '—'} {m.recommended_unit ?? ''}</td>
                        <td className="py-2">
                          {m.actual_amount_used != null ? `${m.actual_amount_used} (${m.tanks_used ?? 0} tanks)` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <p className="text-sm text-[var(--color-text-muted)]">No field completion data found.</p>
        </Card>
      )}

      {/* Log Observation form — admin and manager only */}
      {canEdit(role) && <ObservationForm siteId={siteId} workOrderId={workOrder.id} userId={userId} refetch={refetchSiteProfile} />}
    </div>
  )
}

// -- Observation Form (collapsible) --

interface ObservationFormProps {
  siteId: string
  workOrderId: string
  userId: string | undefined
  refetch: () => void
}

function ObservationForm({ siteId, workOrderId, userId, refetch }: ObservationFormProps) {
  const [open, setOpen] = useState(false)
  const [species, setSpecies] = useState('')
  const [density, setDensity] = useState('')
  const [conditions, setConditions] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSuccess(false)

    const weedSpecies = species
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    const { error: err } = await supabase
      .from('site_observation_logs')
      .insert({
        site_id: siteId,
        work_order_id: workOrderId,
        observed_by: userId ?? null,
        observed_at: new Date().toISOString(),
        weed_species: weedSpecies,
        density: density || null,
        conditions: conditions || null,
        notes: notes || null,
        photo_urls: [],
      })

    if (err) {
      setError(getSupabaseErrorMessage(err))
    } else {
      setSuccess(true)
      setSpecies('')
      setDensity('')
      setConditions('')
      setNotes('')
      refetch()
      setTimeout(() => {
        setSuccess(false)
        setOpen(false)
      }, 1500)
    }
    setSaving(false)
  }

  return (
    <Card>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full min-h-[44px] text-left"
      >
        <span className="text-sm font-semibold">Log Observation</span>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <Input
            label="Weed Species (comma-separated)"
            value={species}
            onChange={(e) => setSpecies(e.target.value)}
          />
          <Input
            label="Density"
            value={density}
            onChange={(e) => setDensity(e.target.value)}
            placeholder="e.g. low, medium, high, severe"
          />
          <Input
            label="Conditions"
            value={conditions}
            onChange={(e) => setConditions(e.target.value)}
          />
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-brand-green"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
            {success && <span className="text-sm text-green-600">Observation logged!</span>}
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </div>
      )}
    </Card>
  )
}
