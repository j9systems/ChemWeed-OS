import { useState, useRef, type FormEvent } from 'react'
import { useParams, Navigate, Link, useNavigate } from 'react-router'
import { ArrowLeft, Camera, X, ChevronDown, ChevronUp } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useWorkOrder } from '@/hooks/useWorkOrders'
import { useServiceAgreementMaterials } from '@/hooks/useServiceAgreementMaterials'
import { useTeamMembers } from '@/hooks/useTeam'
import { useFieldCompletion } from '@/hooks/useFieldCompletion'
import { canCompleteField } from '@/lib/roles'
import { WIND_DIRECTIONS } from '@/lib/constants'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { SignatureCanvas } from '@/components/field/SignatureCanvas'

interface MaterialActual {
  materialId: string
  chemicalName: string
  recommendedAmount: number | null
  recommendedUnit: string | null
  actualAmountUsed: string
  tanksUsed: string
}

interface PhotoWithType {
  file: File
  type: 'before' | 'after' | 'during' | 'other'
}

function PhotoBucket({
  label,
  required,
  photos,
  photoType,
  onAdd,
  onRemove,
  error,
}: {
  label: string
  required?: boolean
  photos: PhotoWithType[]
  photoType: 'before' | 'after' | 'during' | 'other'
  onAdd: (file: File, type: 'before' | 'after' | 'during' | 'other') => void
  onRemove: (index: number) => void
  error?: string | null
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      onAdd(file, photoType)
    }
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo, i) => (
            <div key={i} className="relative rounded-lg overflow-hidden border border-surface-border">
              <img
                src={URL.createObjectURL(photo.file)}
                alt={`${label} ${i + 1}`}
                className="w-full h-24 object-cover"
              />
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80 min-h-[28px] min-w-[28px] flex items-center justify-center"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      <Button
        variant="secondary"
        size="sm"
        type="button"
        onClick={() => inputRef.current?.click()}
      >
        <Camera size={16} />
        Add {label.replace(' Photos', '')} Photo{photos.length > 0 ? ` (${photos.length})` : ''}
      </Button>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}

export function FieldCompletionForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { role, teamMember } = useAuth()
  const { workOrder, isLoading: woLoading } = useWorkOrder(id)
  const { materials: woMaterials, isLoading: matLoading } = useServiceAgreementMaterials(workOrder?.service_agreement_id)
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
  const [typedPhotos, setTypedPhotos] = useState<PhotoWithType[]>([])
  const [signatureBlob, setSignatureBlob] = useState<Blob | null>(null)
  const [signatureCaptured, setSignatureCaptured] = useState(false)
  const [materialActuals, setMaterialActuals] = useState<MaterialActual[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const [beforeError, setBeforeError] = useState<string | null>(null)
  const [afterError, setAfterError] = useState<string | null>(null)
  const [showAdditionalPhotos, setShowAdditionalPhotos] = useState(false)

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

  const beforePhotos = typedPhotos.filter(p => p.type === 'before')
  const afterPhotos = typedPhotos.filter(p => p.type === 'after')
  const duringPhotos = typedPhotos.filter(p => p.type === 'during')
  const otherPhotos = typedPhotos.filter(p => p.type === 'other')

  function addPhoto(file: File, type: PhotoWithType['type']) {
    setTypedPhotos(prev => [...prev, { file, type }])
    // Clear errors when photo added
    if (type === 'before') setBeforeError(null)
    if (type === 'after') setAfterError(null)
  }

  function removePhotoByTypeIndex(type: PhotoWithType['type'], typeIndex: number) {
    // Find the global index of the nth photo of this type
    let count = 0
    const globalIndex = typedPhotos.findIndex(p => {
      if (p.type === type) {
        if (count === typeIndex) return true
        count++
      }
      return false
    })
    if (globalIndex >= 0) {
      setTypedPhotos(prev => prev.filter((_, i) => i !== globalIndex))
    }
  }

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
    setBeforeError(null)
    setAfterError(null)

    // Validate photos
    let hasValidationError = false
    if (beforePhotos.length < 1) {
      setBeforeError('At least one before photo is required')
      hasValidationError = true
    }
    if (afterPhotos.length < 1) {
      setAfterError('At least one after photo is required')
      hasValidationError = true
    }
    if (hasValidationError) return

    if (!signatureCaptured || !signatureBlob) {
      setFormError('Please provide a signature before submitting.')
      return
    }

    const woId = workOrder.id
    // For the existing submit function, pass all photos as File[] (the hook handles upload)
    // We need to pass photo_type metadata — for now the hook uploads all photos,
    // we'll pass only the File objects and handle types separately
    const allPhotos = typedPhotos.map(p => p.file)
    const success = await submit({
      workOrderId: woId,
      completedBy: teamMember?.id ?? '',
      actualStartAt: new Date(actualStartAt).toISOString(),
      temperatureF: temperatureF ? parseFloat(temperatureF) : null,
      windSpeedMph: windSpeedMph ? parseFloat(windSpeedMph) : null,
      windDirection: windDirection || null,
      crewIds,
      notes,
      photos: allPhotos,
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
        Back to Job
      </Link>

      <h1 className="text-2xl font-bold mb-2">Complete Job</h1>
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

        {/* Before Photos */}
        <Card>
          <PhotoBucket
            label="Before Photos"
            required
            photos={beforePhotos}
            photoType="before"
            onAdd={addPhoto}
            onRemove={(i) => removePhotoByTypeIndex('before', i)}
            error={beforeError}
          />
        </Card>

        {/* After Photos */}
        <Card>
          <PhotoBucket
            label="After Photos"
            required
            photos={afterPhotos}
            photoType="after"
            onAdd={addPhoto}
            onRemove={(i) => removePhotoByTypeIndex('after', i)}
            error={afterError}
          />
        </Card>

        {/* Additional Photos (collapsible) */}
        <Card>
          <button
            type="button"
            onClick={() => setShowAdditionalPhotos(!showAdditionalPhotos)}
            className="flex items-center justify-between w-full text-sm font-medium min-h-[44px]"
          >
            <span>Additional Photos (optional)</span>
            {showAdditionalPhotos ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {showAdditionalPhotos && (
            <div className="mt-3 space-y-4">
              <PhotoBucket
                label="During Photos"
                photos={duringPhotos}
                photoType="during"
                onAdd={addPhoto}
                onRemove={(i) => removePhotoByTypeIndex('during', i)}
              />
              <PhotoBucket
                label="Other Photos"
                photos={otherPhotos}
                photoType="other"
                onAdd={addPhoto}
                onRemove={(i) => removePhotoByTypeIndex('other', i)}
              />
            </div>
          )}
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
          {isSubmitting ? 'Submitting...' : 'Complete Job'}
        </Button>
      </form>
    </div>
  )
}
