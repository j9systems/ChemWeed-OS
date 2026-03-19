import { useState, type FormEvent } from 'react'
import { useParams, Navigate, Link, useNavigate } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useWorkOrder } from '@/hooks/useWorkOrders'
import { useWorkOrderMaterials } from '@/hooks/useWorkOrderMaterials'
import { useTeamMembers } from '@/hooks/useTeam'
import { useFieldCompletion } from '@/hooks/useFieldCompletion'
import { canCompleteField } from '@/lib/roles'
import { WIND_DIRECTIONS } from '@/lib/constants'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { SignatureCanvas } from '@/components/field/SignatureCanvas'
import { PhotoCapture } from '@/components/field/PhotoCapture'

interface MaterialActual {
  materialId: string
  chemicalName: string
  recommendedAmount: number | null
  recommendedUnit: string | null
  actualAmountUsed: string
  tanksUsed: string
}

export function FieldCompletionForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { role, teamMember } = useAuth()
  const { workOrder, isLoading: woLoading } = useWorkOrder(id)
  const { materials: woMaterials, isLoading: matLoading } = useWorkOrderMaterials(id)
  const { members } = useTeamMembers()
  const { submit, isSubmitting, progress, error: submitError } = useFieldCompletion()

  const [actualStartAt, setActualStartAt] = useState(
    new Date().toISOString().slice(0, 16)
  )
  const [temperatureF, setTemperatureF] = useState('')
  const [windSpeedMph, setWindSpeedMph] = useState('')
  const [windDirection, setWindDirection] = useState('')
  const [crewIds, setCrewIds] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [signatureBlob, setSignatureBlob] = useState<Blob | null>(null)
  const [signatureCaptured, setSignatureCaptured] = useState(false)
  const [materialActuals, setMaterialActuals] = useState<MaterialActual[]>([])
  const [formError, setFormError] = useState<string | null>(null)

  // Initialize material actuals when data loads
  if (woMaterials.length > 0 && materialActuals.length === 0) {
    setMaterialActuals(
      woMaterials.map((m) => ({
        materialId: m.id,
        chemicalName: m.chemical?.name ?? 'Unknown',
        recommendedAmount: m.recommended_amount,
        recommendedUnit: m.recommended_unit,
        actualAmountUsed: '',
        tanksUsed: '',
      }))
    )
  }

  if (!canCompleteField(role)) {
    return <Navigate to={`/work-orders/${id}`} replace />
  }

  if (woLoading || matLoading) return <LoadingSpinner />
  if (!workOrder) return <ErrorMessage message="Work order not found." />

  function toggleCrew(memberId: string) {
    setCrewIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    )
  }

  function updateMaterial(index: number, field: 'actualAmountUsed' | 'tanksUsed', value: string) {
    setMaterialActuals((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!workOrder) return
    setFormError(null)

    if (!signatureCaptured || !signatureBlob) {
      setFormError('Please provide a signature before submitting.')
      return
    }

    const woId = workOrder.id
    const success = await submit({
      workOrderId: woId,
      completedBy: teamMember?.id ?? '',
      actualStartAt: new Date(actualStartAt).toISOString(),
      temperatureF: temperatureF ? parseFloat(temperatureF) : null,
      windSpeedMph: windSpeedMph ? parseFloat(windSpeedMph) : null,
      windDirection: windDirection || null,
      crewIds,
      notes,
      photos,
      signatureBlob,
      materialActuals: materialActuals.map((m) => ({
        materialId: m.materialId,
        actualAmountUsed: m.actualAmountUsed ? parseFloat(m.actualAmountUsed) : null,
        tanksUsed: m.tanksUsed ? parseFloat(m.tanksUsed) : null,
      })),
    })

    if (success) {
      navigate(`/work-orders/${woId}`)
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <Link
        to={`/work-orders/${id}`}
        className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mb-4"
      >
        <ArrowLeft size={16} />
        Back to Work Order
      </Link>

      <h1 className="text-2xl font-bold mb-2">Complete Work Order</h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-6">
        {workOrder.client?.name} — {workOrder.site?.name}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Start Time */}
        <Card>
          <label className="block text-sm font-medium mb-1">Actual Start Date/Time</label>
          <input
            type="datetime-local"
            value={actualStartAt}
            onChange={(e) => setActualStartAt(e.target.value)}
            className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm min-h-[44px]"
          />
        </Card>

        {/* Weather */}
        <Card>
          <h2 className="text-sm font-semibold mb-3">Weather Conditions</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Temperature (&deg;F)</label>
              <input
                type="number"
                value={temperatureF}
                onChange={(e) => setTemperatureF(e.target.value)}
                placeholder="72"
                className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Wind Speed (mph)</label>
              <input
                type="number"
                value={windSpeedMph}
                onChange={(e) => setWindSpeedMph(e.target.value)}
                placeholder="5"
                className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm min-h-[44px]"
              />
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Wind Direction</label>
            <select
              value={windDirection}
              onChange={(e) => setWindDirection(e.target.value)}
              className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm min-h-[44px]"
            >
              <option value="">Select direction...</option>
              {WIND_DIRECTIONS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </Card>

        {/* Materials Actuals */}
        {materialActuals.length > 0 && (
          <Card>
            <h2 className="text-sm font-semibold mb-3">Materials — Actual Usage</h2>
            <div className="space-y-3">
              {materialActuals.map((m, i) => (
                <div key={m.materialId} className="rounded-lg border border-surface-border p-3">
                  <p className="text-sm font-medium mb-1">{m.chemicalName}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mb-2">
                    Recommended: {m.recommendedAmount ?? '—'} {m.recommendedUnit ?? ''}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-[var(--color-text-muted)] mb-1">Actual Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        value={m.actualAmountUsed}
                        onChange={(e) => updateMaterial(i, 'actualAmountUsed', e.target.value)}
                        className="w-full rounded-lg border border-surface-border bg-white px-2 py-1.5 text-sm min-h-[44px]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--color-text-muted)] mb-1">Tanks Used</label>
                      <input
                        type="number"
                        step="1"
                        value={m.tanksUsed}
                        onChange={(e) => updateMaterial(i, 'tanksUsed', e.target.value)}
                        className="w-full rounded-lg border border-surface-border bg-white px-2 py-1.5 text-sm min-h-[44px]"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Crew */}
        <Card>
          <h2 className="text-sm font-semibold mb-3">Crew Present</h2>
          <div className="space-y-1">
            {members.map((m) => (
              <label
                key={m.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2 min-h-[44px] hover:bg-surface-raised cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={crewIds.includes(m.id)}
                  onChange={() => toggleCrew(m.id)}
                  className="h-5 w-5 rounded border-surface-border text-brand-green focus:ring-brand-green"
                />
                <span className="text-sm">{m.first_name} {m.last_name}</span>
              </label>
            ))}
          </div>
        </Card>

        {/* Notes */}
        <Card>
          <label className="block text-sm font-medium mb-1">Notes / Deviations</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Any notes or deviations from the plan..."
            className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
          />
        </Card>

        {/* Photos */}
        <Card>
          <PhotoCapture
            photos={photos}
            onAdd={(file) => setPhotos((prev) => [...prev, file])}
            onRemove={(index) => setPhotos((prev) => prev.filter((_, i) => i !== index))}
          />
        </Card>

        {/* Signature */}
        <Card>
          <SignatureCanvas
            onCapture={(blob) => {
              setSignatureBlob(blob)
              setSignatureCaptured(true)
            }}
          />
          {signatureCaptured && (
            <p className="mt-2 text-xs text-green-700">Signature captured.</p>
          )}
        </Card>

        {/* Errors */}
        {(formError || submitError) && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError ?? submitError}
          </div>
        )}

        {/* Progress */}
        {progress && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
            {progress}
          </div>
        )}

        {/* Submit */}
        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting}
          className="w-full"
        >
          {isSubmitting ? 'Submitting...' : 'Complete Work Order'}
        </Button>
      </form>
    </div>
  )
}
