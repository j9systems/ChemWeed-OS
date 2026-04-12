import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronUp, CheckCircle, Plus, Trash2 } from 'lucide-react'
import { useFieldCompletion } from '@/hooks/useFieldCompletion'
import { useServiceAgreementMaterials } from '@/hooks/useServiceAgreementMaterials'
import { canCompleteField, canEdit } from '@/lib/roles'
import { WIND_DIRECTIONS } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { PhotoBucket } from '@/components/field/PhotoBucket'
import { SignatureCanvas } from '@/components/field/SignatureCanvas'
import type { WorkOrder, Chemical } from '@/types/database'

interface AdHocChemicalRow {
  tempId: string
  savedId?: string
  chemicalId: string
  chemicalName: string
  actualAmount: string
  unit: string
  tanks: string
}

interface FieldTabProps {
  wo: WorkOrder
  teamMemberId: string | null
  role: string
  onComplete: () => void
}

export function FieldTab({ wo, teamMemberId, role, onComplete }: FieldTabProps) {
  const {
    draft,
    materials: savedMaterials,
    recordId,
    isLoading,
    isSaving,
    saveError,
    completionError,
    isSubmitted,
    upsertDraft,
    savePhotoToCompletion,
    removePhoto,
    saveMaterialActual,
    saveSignature,
    markComplete,
  } = useFieldCompletion(wo.id, teamMemberId)

  const { materials: agreementMaterials, isLoading: matLoading } = useServiceAgreementMaterials(wo.service_agreement_id)

  const readOnly = isSubmitted || (!canCompleteField(role as any) && !canEdit(role as any))

  // Local state for inputs (populated from draft on load, autosave on blur)
  const [actualStartAt, setActualStartAt] = useState<string>('')
  const [windSpeed, setWindSpeed] = useState('')
  const [windDir, setWindDir] = useState('')
  const [airTemp, setAirTemp] = useState('')
  const [notes, setNotes] = useState('')
  const [localMaterials, setLocalMaterials] = useState<Record<string, { actualAmount: string; tanks: string }>>({})
  const [showAdditional, setShowAdditional] = useState(false)
  const [showSignatureCanvas, setShowSignatureCanvas] = useState(false)
  const [beforeError, setBeforeError] = useState<string | null>(null)
  const [afterError, setAfterError] = useState<string | null>(null)
  const [sigError, setSigError] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)

  // Ad-hoc chemicals state
  const [adHocChemicals, setAdHocChemicals] = useState<AdHocChemicalRow[]>([])
  const [chemicalsList, setChemicalsList] = useState<Chemical[]>([])
  const [chemicalsLoadError, setChemicalsLoadError] = useState(false)

  const fetchChemicals = useCallback(async () => {
    const { data, error: chemErr } = await supabase
      .from('chemicals')
      .select('*')
      .eq('is_active', true)
      .order('name')
    if (chemErr || !data) {
      setChemicalsLoadError(true)
    } else {
      setChemicalsList(data)
    }
  }, [])

  useEffect(() => { fetchChemicals() }, [fetchChemicals])

  // Initialize local state from draft once loaded
  if (!isLoading && !initialized) {
    if (draft) {
      setActualStartAt(draft.actualStartAt ?? '')
      setWindSpeed(draft.windSpeedMph != null ? String(draft.windSpeedMph) : '')
      setWindDir(draft.windDirection ?? '')
      setAirTemp(draft.temperatureF != null ? String(draft.temperatureF) : '')
      setNotes(draft.notes ?? '')
    } else {
      // Pre-populate from work order if no draft exists
      const startDate = wo.actual_start_date ?? ''
      const startTime = wo.actual_start_time ?? ''
      if (startDate) {
        setActualStartAt(startTime ? `${startDate}T${startTime}` : startDate)
      }
    }

    // Initialize local materials from saved
    const matMap: Record<string, { actualAmount: string; tanks: string }> = {}
    for (const m of savedMaterials) {
      matMap[m.serviceAgreementMaterialId] = {
        actualAmount: m.actualAmountUsed != null ? String(m.actualAmountUsed) : '',
        tanks: m.tanksUsed != null ? String(m.tanksUsed) : '',
      }
    }
    setLocalMaterials(matMap)
    setInitialized(true)
  }

  if (isLoading || matLoading) return <LoadingSpinner />

  // Helpers to find saved material data
  function getSavedMaterial(samId: string) {
    return savedMaterials.find((m) => m.serviceAgreementMaterialId === samId)
  }

  async function handleBlurStartAt() {
    if (readOnly) return
    await upsertDraft({ actualStartAt: actualStartAt || null })
  }

  async function handleBlurWeather(field: 'windSpeedMph' | 'temperatureF' | 'windDirection', value: string) {
    if (readOnly) return
    if (field === 'windDirection') {
      await upsertDraft({ windDirection: value || null })
    } else {
      await upsertDraft({ [field]: value ? parseFloat(value) : null })
    }
  }

  async function handleBlurNotes() {
    if (readOnly) return
    await upsertDraft({ notes: notes || null })
  }

  async function handleMaterialBlur(samId: string, chemicalName: string, recommendedAmount: number | null, recommendedUnit: string | null) {
    if (readOnly) return
    const local = localMaterials[samId]
    if (!local) return
    const saved = getSavedMaterial(samId)
    await saveMaterialActual({
      id: saved?.id,
      serviceAgreementMaterialId: samId,
      chemicalName,
      recommendedAmount,
      recommendedUnit,
      actualAmountUsed: local.actualAmount ? parseFloat(local.actualAmount) : null,
      tanksUsed: local.tanks ? parseInt(local.tanks) : null,
    })
  }

  function updateLocalMaterial(samId: string, field: 'actualAmount' | 'tanks', value: string) {
    setLocalMaterials((prev) => ({
      ...prev,
      [samId]: { ...prev[samId] ?? { actualAmount: '', tanks: '' }, [field]: value },
    }))
  }

  function addAdHocChemical() {
    setAdHocChemicals((prev) => [
      ...prev,
      { tempId: crypto.randomUUID(), chemicalId: '', chemicalName: '', actualAmount: '', unit: '', tanks: '' },
    ])
  }

  function updateAdHocChemical(tempId: string, updates: Partial<AdHocChemicalRow>) {
    setAdHocChemicals((prev) =>
      prev.map((row) => (row.tempId === tempId ? { ...row, ...updates } : row))
    )
  }

  function removeAdHocChemical(tempId: string) {
    setAdHocChemicals((prev) => prev.filter((row) => row.tempId !== tempId))
  }

  async function handleAdHocBlur(row: AdHocChemicalRow) {
    if (readOnly || !row.chemicalName) return

    // Ensure field_completion record exists
    let fcId = recordId
    if (!fcId) {
      fcId = await upsertDraft({})
      if (!fcId) return
    }

    const payload = {
      field_completion_id: fcId,
      service_agreement_material_id: null,
      chemical_name: row.chemicalName,
      recommended_amount: null,
      recommended_unit: row.unit || null,
      actual_amount_used: row.actualAmount ? parseFloat(row.actualAmount) : null,
      tanks_used: row.tanks ? parseInt(row.tanks) : null,
    }

    if (row.savedId) {
      await supabase
        .from('field_completion_materials')
        .update(payload)
        .eq('id', row.savedId)
    } else {
      const { data } = await supabase
        .from('field_completion_materials')
        .insert(payload)
        .select('id')
        .single()
      if (data) {
        setAdHocChemicals((prev) =>
          prev.map((r) => (r.tempId === row.tempId ? { ...r, savedId: data.id } : r))
        )
      }
    }
  }

  async function handleAddPhoto(file: File, type: 'before' | 'after' | 'during') {
    if (type === 'before') setBeforeError(null)
    if (type === 'after') setAfterError(null)
    await savePhotoToCompletion(file, type)
  }

  async function handleRemovePhoto(url: string, type: 'before' | 'after' | 'during') {
    await removePhoto(url, type)
  }

  async function handleSignatureCapture(blob: Blob) {
    setSigError(null)
    setShowSignatureCanvas(false)
    await saveSignature(blob)
  }

  async function handleMarkComplete() {
    if (!teamMemberId) return
    setBeforeError(null)
    setAfterError(null)
    setSigError(null)

    // Client-side pre-validation to show inline errors
    let hasErr = false
    if ((draft?.beforePhotoUrls ?? []).length < 1) { setBeforeError('At least one before photo is required.'); hasErr = true }
    if ((draft?.afterPhotoUrls ?? []).length < 1) { setAfterError('At least one after photo is required.'); hasErr = true }
    if (!draft?.signatureDataUrl) { setSigError('A signature is required.'); hasErr = true }
    if (hasErr) return

    const success = await markComplete(teamMemberId)
    if (success) {
      onComplete()
    }
  }

  const submittedDate = draft?.submittedAt ? new Date(draft.submittedAt) : null

  return (
    <div className="space-y-5">
      {/* Status bar */}
      <div className={`w-full rounded-full px-4 py-2 text-center text-sm font-medium ${
        isSubmitted
          ? 'bg-emerald-100 text-emerald-800'
          : 'bg-gray-100 text-gray-600'
      }`}>
        {isSubmitted ? `Submitted ${submittedDate ? formatDate(submittedDate.toISOString()) : ''}` : 'Draft'}
      </div>

      {/* Start date/time */}
      <div>
        <label className="block text-sm font-medium mb-1">Actual Start Date/Time</label>
        <input
          type="datetime-local"
          value={actualStartAt}
          onChange={(e) => setActualStartAt(e.target.value)}
          onBlur={handleBlurStartAt}
          disabled={readOnly}
          className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm min-h-[44px] disabled:opacity-60 disabled:bg-gray-50"
        />
      </div>

      {/* Weather conditions */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Weather Conditions</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Wind Speed (mph)</label>
            <input
              type="number"
              value={windSpeed}
              onChange={(e) => setWindSpeed(e.target.value)}
              onBlur={() => handleBlurWeather('windSpeedMph', windSpeed)}
              disabled={readOnly}
              placeholder="5"
              className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm min-h-[44px] disabled:opacity-60 disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Wind Direction</label>
            <select
              value={windDir}
              onChange={(e) => { setWindDir(e.target.value); handleBlurWeather('windDirection', e.target.value) }}
              disabled={readOnly}
              className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm min-h-[44px] disabled:opacity-60 disabled:bg-gray-50"
            >
              <option value="">—</option>
              {WIND_DIRECTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Air Temp (&deg;F)</label>
            <input
              type="number"
              value={airTemp}
              onChange={(e) => setAirTemp(e.target.value)}
              onBlur={() => handleBlurWeather('temperatureF', airTemp)}
              disabled={readOnly}
              placeholder="72"
              className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm min-h-[44px] disabled:opacity-60 disabled:bg-gray-50"
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleBlurNotes}
          disabled={readOnly}
          rows={3}
          placeholder="Any notes or deviations from the plan..."
          className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green disabled:opacity-60 disabled:bg-gray-50"
        />
      </div>

      {/* Chemical Actuals */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Chemical Application</h2>

        {/* Pre-populated agreement materials */}
        {agreementMaterials.length > 0 && (
          <div className="space-y-3 mb-3">
            {agreementMaterials.map((m) => {
              const local = localMaterials[m.id] ?? { actualAmount: '', tanks: '' }
              const actualNum = local.actualAmount ? parseFloat(local.actualAmount) : null
              const tanksNum = local.tanks ? parseInt(local.tanks) : null
              const totalUsed = actualNum != null && tanksNum != null ? actualNum * tanksNum : null

              return (
                <div key={m.id} className="rounded-lg border border-surface-border p-3">
                  <p className="text-sm font-semibold">{m.chemical?.name ?? 'Unknown'}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mb-2">
                    Recommended: {m.recommended_amount ?? '—'} {m.recommended_unit ?? ''}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-[var(--color-text-muted)] mb-1">Actual Amount Used</label>
                      <input
                        type="number"
                        step="0.01"
                        value={local.actualAmount}
                        onChange={(e) => updateLocalMaterial(m.id, 'actualAmount', e.target.value)}
                        onBlur={() => handleMaterialBlur(m.id, m.chemical?.name ?? 'Unknown', m.recommended_amount, m.recommended_unit)}
                        disabled={readOnly}
                        className="w-full rounded-lg border border-surface-border bg-white px-2 py-1.5 text-sm min-h-[44px] disabled:opacity-60 disabled:bg-gray-50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--color-text-muted)] mb-1">Tanks Used</label>
                      <input
                        type="number"
                        step="1"
                        value={local.tanks}
                        onChange={(e) => updateLocalMaterial(m.id, 'tanks', e.target.value)}
                        onBlur={() => handleMaterialBlur(m.id, m.chemical?.name ?? 'Unknown', m.recommended_amount, m.recommended_unit)}
                        disabled={readOnly}
                        className="w-full rounded-lg border border-surface-border bg-white px-2 py-1.5 text-sm min-h-[44px] disabled:opacity-60 disabled:bg-gray-50"
                      />
                    </div>
                  </div>
                  {totalUsed != null && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-2">
                      Total Used: {totalUsed} {m.recommended_unit ?? ''}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Ad-hoc chemical rows */}
        {adHocChemicals.length > 0 && (
          <div className="space-y-3 mb-3">
            {adHocChemicals.map((row) => (
              <div key={row.tempId} className="rounded-lg border border-surface-border p-3">
                <div className="flex items-start justify-between mb-2">
                  {chemicalsLoadError || chemicalsList.length === 0 ? (
                    <div className="flex-1">
                      <label className="block text-xs text-[var(--color-text-muted)] mb-1">Chemical Name</label>
                      <input
                        type="text"
                        value={row.chemicalName}
                        onChange={(e) => updateAdHocChemical(row.tempId, { chemicalName: e.target.value })}
                        onBlur={() => handleAdHocBlur(row)}
                        disabled={readOnly}
                        placeholder="Enter chemical name..."
                        className="w-full rounded-lg border border-surface-border bg-white px-2 py-1.5 text-sm min-h-[44px] disabled:opacity-60 disabled:bg-gray-50"
                      />
                    </div>
                  ) : (
                    <div className="flex-1">
                      <label className="block text-xs text-[var(--color-text-muted)] mb-1">Chemical</label>
                      <select
                        value={row.chemicalId}
                        onChange={(e) => {
                          const chem = chemicalsList.find((c) => c.id === e.target.value)
                          updateAdHocChemical(row.tempId, {
                            chemicalId: e.target.value,
                            chemicalName: chem?.name ?? '',
                            unit: chem?.default_unit ?? row.unit,
                          })
                        }}
                        onBlur={() => handleAdHocBlur(row)}
                        disabled={readOnly}
                        className="w-full rounded-lg border border-surface-border bg-white px-2 py-1.5 text-sm min-h-[44px] disabled:opacity-60 disabled:bg-gray-50"
                      >
                        <option value="">Select chemical...</option>
                        {chemicalsList.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => removeAdHocChemical(row.tempId)}
                      className="ml-2 mt-5 rounded-lg p-2 text-red-500 hover:bg-red-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-[var(--color-text-muted)] mb-1">Amount Used</label>
                    <input
                      type="number"
                      step="0.01"
                      value={row.actualAmount}
                      onChange={(e) => updateAdHocChemical(row.tempId, { actualAmount: e.target.value })}
                      onBlur={() => handleAdHocBlur(row)}
                      disabled={readOnly}
                      placeholder="0"
                      className="w-full rounded-lg border border-surface-border bg-white px-2 py-1.5 text-sm min-h-[44px] disabled:opacity-60 disabled:bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--color-text-muted)] mb-1">Unit</label>
                    <input
                      type="text"
                      value={row.unit}
                      onChange={(e) => updateAdHocChemical(row.tempId, { unit: e.target.value })}
                      onBlur={() => handleAdHocBlur(row)}
                      disabled={readOnly}
                      placeholder="oz, gal..."
                      className="w-full rounded-lg border border-surface-border bg-white px-2 py-1.5 text-sm min-h-[44px] disabled:opacity-60 disabled:bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--color-text-muted)] mb-1">Tanks Used</label>
                    <input
                      type="number"
                      step="1"
                      value={row.tanks}
                      onChange={(e) => updateAdHocChemical(row.tempId, { tanks: e.target.value })}
                      onBlur={() => handleAdHocBlur(row)}
                      disabled={readOnly}
                      placeholder="0"
                      className="w-full rounded-lg border border-surface-border bg-white px-2 py-1.5 text-sm min-h-[44px] disabled:opacity-60 disabled:bg-gray-50"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {agreementMaterials.length === 0 && adHocChemicals.length === 0 && (
          <p className="text-sm text-[var(--color-text-muted)] italic mb-3">No chemicals on record for this agreement.</p>
        )}

        {/* Add Chemical button */}
        {!readOnly && (
          <Button type="button" variant="ghost" size="sm" onClick={addAdHocChemical}>
            <Plus size={16} />
            Add Chemical
          </Button>
        )}
      </div>

      {/* Before Photos */}
      <PhotoBucket
        label="Before Photos"
        required
        urls={draft?.beforePhotoUrls ?? []}
        disabled={readOnly}
        uploading={isSaving}
        onAdd={(file) => handleAddPhoto(file, 'before')}
        onRemove={(url) => handleRemovePhoto(url, 'before')}
        error={beforeError}
      />

      {/* After Photos */}
      <PhotoBucket
        label="After Photos"
        required
        urls={draft?.afterPhotoUrls ?? []}
        disabled={readOnly}
        uploading={isSaving}
        onAdd={(file) => handleAddPhoto(file, 'after')}
        onRemove={(url) => handleRemovePhoto(url, 'after')}
        error={afterError}
      />

      {/* Additional Photos (collapsible) */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdditional(!showAdditional)}
          className="flex items-center justify-between w-full text-sm font-medium min-h-[44px]"
        >
          <span>Additional Photos (optional)</span>
          {showAdditional ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {showAdditional && (
          <div className="mt-3">
            <PhotoBucket
              label="During Photos"
              urls={draft?.duringPhotoUrls ?? []}
              disabled={readOnly}
              uploading={isSaving}
              onAdd={(file) => handleAddPhoto(file, 'during')}
              onRemove={(url) => handleRemovePhoto(url, 'during')}
            />
          </div>
        )}
      </div>

      {/* Signature */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Signature <span className="text-red-500">*</span>
        </label>
        {draft?.signatureDataUrl && !showSignatureCanvas ? (
          <div className="space-y-2">
            <div className="rounded-lg border border-surface-border bg-white p-2 inline-block">
              <img src={draft.signatureDataUrl} alt="Signature" className="h-20" />
            </div>
            {!readOnly && (
              <div>
                <Button variant="secondary" size="sm" onClick={() => setShowSignatureCanvas(true)}>
                  Re-sign
                </Button>
              </div>
            )}
          </div>
        ) : !readOnly ? (
          <SignatureCanvas onCapture={handleSignatureCapture} />
        ) : (
          <p className="text-sm text-[var(--color-text-muted)] italic">No signature captured.</p>
        )}
        {sigError && <p className="text-sm text-red-600 mt-1">{sigError}</p>}
      </div>

      {/* Save error banner */}
      {saveError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {saveError}
        </div>
      )}

      {/* Mark Complete / Completed banner */}
      {isSubmitted ? (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-4 py-3">
          <CheckCircle size={16} />
          Job completed {submittedDate ? formatDate(submittedDate.toISOString()) : ''}
        </div>
      ) : (
        <div>
          {completionError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-3">
              {completionError}
            </div>
          )}
          {!readOnly && (
            <Button
              size="lg"
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              onClick={handleMarkComplete}
              disabled={isSaving || isSubmitted}
            >
              {isSaving ? 'Saving...' : 'Mark Job Complete'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
