import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { compressImage } from '@/lib/image-compression'
import { uploadPhoto, uploadSignature } from '@/lib/storage'
import { enqueueSubmission } from '@/lib/offline-queue'
import { getSupabaseErrorMessage, todayPacific } from '@/lib/utils'
import type { FieldCompletion, FieldCompletionMaterial } from '@/types/database'

export interface FieldCompletionDraft {
  actualStartAt: string | null
  temperatureF: number | null
  windSpeedMph: number | null
  windDirection: string | null
  notes: string | null
  beforePhotoUrls: string[]
  afterPhotoUrls: string[]
  duringPhotoUrls: string[]
  signatureDataUrl: string | null
  completedBy: string | null
  submittedAt: string | null
}

export interface MaterialActual {
  id?: string
  serviceAgreementMaterialId: string
  chemicalName: string
  recommendedAmount: number | null
  recommendedUnit: string | null
  actualAmountUsed: number | null
  tanksUsed: number | null
}

function toSnake(draft: Partial<FieldCompletionDraft>): Record<string, unknown> {
  const map: Record<string, unknown> = {}
  if ('actualStartAt' in draft) map.actual_start_at = draft.actualStartAt
  if ('temperatureF' in draft) map.temperature_f = draft.temperatureF
  if ('windSpeedMph' in draft) map.wind_speed_mph = draft.windSpeedMph
  if ('windDirection' in draft) map.wind_direction = draft.windDirection
  if ('notes' in draft) map.notes = draft.notes
  if ('beforePhotoUrls' in draft) map.before_photo_urls = draft.beforePhotoUrls
  if ('afterPhotoUrls' in draft) map.after_photo_urls = draft.afterPhotoUrls
  if ('duringPhotoUrls' in draft) map.during_photo_urls = draft.duringPhotoUrls
  if ('signatureDataUrl' in draft) map.signature_data_url = draft.signatureDataUrl
  if ('completedBy' in draft) map.completed_by = draft.completedBy
  if ('submittedAt' in draft) map.submitted_at = draft.submittedAt
  return map
}

function rowToDraft(row: FieldCompletion): FieldCompletionDraft {
  return {
    actualStartAt: row.actual_start_at ?? null,
    temperatureF: row.temperature_f,
    windSpeedMph: row.wind_speed_mph,
    windDirection: row.wind_direction,
    notes: row.notes,
    beforePhotoUrls: row.before_photo_urls ?? [],
    afterPhotoUrls: row.after_photo_urls ?? [],
    duringPhotoUrls: row.during_photo_urls ?? [],
    signatureDataUrl: row.signature_data_url,
    completedBy: row.completed_by,
    submittedAt: row.submitted_at,
  }
}

export function useFieldCompletion(workOrderId: string | undefined, teamMemberId: string | null) {
  const [draft, setDraft] = useState<FieldCompletionDraft | null>(null)
  const [materials, setMaterials] = useState<MaterialActual[]>([])
  const [recordId, setRecordId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [completionError, setCompletionError] = useState<string | null>(null)

  const recordIdRef = useRef<string | null>(null)
  recordIdRef.current = recordId

  const fetchExisting = useCallback(async () => {
    if (!workOrderId) { setIsLoading(false); return }
    setIsLoading(true)

    const { data, error } = await supabase
      .from('field_completions')
      .select('*, field_completion_materials(*)')
      .eq('work_order_id', workOrderId)
      .maybeSingle()

    if (error) {
      setSaveError(getSupabaseErrorMessage(error))
      setIsLoading(false)
      return
    }

    if (data) {
      setRecordId(data.id)
      setDraft(rowToDraft(data as unknown as FieldCompletion))
      const mats = ((data as Record<string, unknown>).field_completion_materials as FieldCompletionMaterial[] | null) ?? []
      setMaterials(mats.map((m) => ({
        id: m.id,
        serviceAgreementMaterialId: m.service_agreement_material_id ?? '',
        chemicalName: m.chemical_name,
        recommendedAmount: m.recommended_amount,
        recommendedUnit: m.recommended_unit,
        actualAmountUsed: m.actual_amount_used,
        tanksUsed: m.tanks_used,
      })))
    }
    setIsLoading(false)
  }, [workOrderId])

  useEffect(() => { fetchExisting() }, [fetchExisting])

  const upsertDraft = useCallback(async (fields: Partial<FieldCompletionDraft>): Promise<string | null> => {
    if (!workOrderId) return null
    setIsSaving(true)
    setSaveError(null)

    const snakeFields = toSnake(fields)
    const payload: Record<string, unknown> = {
      work_order_id: workOrderId,
      ...snakeFields,
    }
    if (teamMemberId) {
      payload.completed_by = snakeFields.completed_by ?? teamMemberId
    }

    const { data, error } = await supabase
      .from('field_completions')
      .upsert(payload, { onConflict: 'work_order_id' })
      .select('id')
      .single()

    setIsSaving(false)

    if (error) {
      const msg = getSupabaseErrorMessage(error)
      setSaveError(msg)
      return null
    }

    const id = data.id as string
    setRecordId(id)

    // Update local draft state
    setDraft((prev) => {
      const base = prev ?? {
        actualStartAt: null,
        temperatureF: null,
        windSpeedMph: null,
        windDirection: null,
        notes: null,
        beforePhotoUrls: [],
        afterPhotoUrls: [],
        duringPhotoUrls: [],
        signatureDataUrl: null,
        completedBy: teamMemberId,
        submittedAt: null,
      }
      return { ...base, ...fields }
    })

    return id
  }, [workOrderId, teamMemberId])

  const savePhotoToCompletion = useCallback(async (file: File, type: 'before' | 'after' | 'during'): Promise<string | null> => {
    if (!workOrderId) return null
    setIsSaving(true)
    setSaveError(null)

    try {
      const compressed = await compressImage(file)
      const filename = `${type}-${Date.now()}.jpg`
      const url = await uploadPhoto(workOrderId, compressed, filename)

      // Ensure a record exists
      let id = recordIdRef.current
      if (!id) {
        id = await upsertDraft({})
        if (!id) { setIsSaving(false); return null }
      }

      const fieldKey = `${type}PhotoUrls` as 'beforePhotoUrls' | 'afterPhotoUrls' | 'duringPhotoUrls'
      const currentUrls = draft?.[fieldKey] ?? []
      const newUrls = [...currentUrls, url]

      await upsertDraft({ [fieldKey]: newUrls })
      setIsSaving(false)
      return url
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Photo upload failed.')
      setIsSaving(false)
      return null
    }
  }, [workOrderId, draft, upsertDraft])

  const removePhoto = useCallback(async (url: string, type: 'before' | 'after' | 'during') => {
    const fieldKey = `${type}PhotoUrls` as 'beforePhotoUrls' | 'afterPhotoUrls' | 'duringPhotoUrls'
    const currentUrls = draft?.[fieldKey] ?? []
    const newUrls = currentUrls.filter((u) => u !== url)
    await upsertDraft({ [fieldKey]: newUrls })
  }, [draft, upsertDraft])

  const saveMaterialActual = useCallback(async (mat: MaterialActual) => {
    if (!workOrderId) return
    setIsSaving(true)
    setSaveError(null)

    // Ensure field_completion record exists
    let fcId = recordIdRef.current
    if (!fcId) {
      fcId = await upsertDraft({})
      if (!fcId) { setIsSaving(false); return }
    }

    const payload = {
      field_completion_id: fcId,
      service_agreement_material_id: mat.serviceAgreementMaterialId,
      chemical_name: mat.chemicalName,
      recommended_amount: mat.recommendedAmount,
      recommended_unit: mat.recommendedUnit,
      actual_amount_used: mat.actualAmountUsed,
      tanks_used: mat.tanksUsed,
    }

    let result
    if (mat.id) {
      result = await supabase
        .from('field_completion_materials')
        .update(payload)
        .eq('id', mat.id)
        .select('id')
        .single()
    } else {
      // Check for existing record by composite key
      const { data: existing } = await supabase
        .from('field_completion_materials')
        .select('id')
        .eq('field_completion_id', fcId)
        .eq('service_agreement_material_id', mat.serviceAgreementMaterialId)
        .maybeSingle()

      if (existing) {
        result = await supabase
          .from('field_completion_materials')
          .update(payload)
          .eq('id', existing.id)
          .select('id')
          .single()
      } else {
        result = await supabase
          .from('field_completion_materials')
          .insert(payload)
          .select('id')
          .single()
      }
    }

    if (result.error) {
      setSaveError(getSupabaseErrorMessage(result.error))
    } else {
      // Update local materials state
      const savedId = result.data?.id as string
      setMaterials((prev) => {
        const idx = prev.findIndex(
          (m) => m.serviceAgreementMaterialId === mat.serviceAgreementMaterialId
        )
        const updated = { ...mat, id: savedId }
        if (idx >= 0) {
          const copy = [...prev]
          copy[idx] = updated
          return copy
        }
        return [...prev, updated]
      })
    }

    setIsSaving(false)
  }, [workOrderId, upsertDraft])

  const saveSignature = useCallback(async (blob: Blob) => {
    if (!workOrderId) return
    setIsSaving(true)
    setSaveError(null)

    try {
      const url = await uploadSignature(workOrderId, blob)

      // Ensure record exists
      let id = recordIdRef.current
      if (!id) {
        id = await upsertDraft({})
        if (!id) { setIsSaving(false); return }
      }

      await upsertDraft({ signatureDataUrl: url })
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Signature upload failed.')
    }
    setIsSaving(false)
  }, [workOrderId, upsertDraft])

  const markComplete = useCallback(async (completerId: string): Promise<boolean> => {
    if (!workOrderId) return false
    setCompletionError(null)

    // Validate
    const beforeUrls = draft?.beforePhotoUrls ?? []
    const afterUrls = draft?.afterPhotoUrls ?? []
    const sig = draft?.signatureDataUrl

    const errors: string[] = []
    if (beforeUrls.length < 1) errors.push('At least one before photo is required.')
    if (afterUrls.length < 1) errors.push('At least one after photo is required.')
    if (!sig) errors.push('A signature is required.')

    if (errors.length > 0) {
      setCompletionError(errors.join(' '))
      return false
    }

    setIsSaving(true)

    try {
      // Upsert submitted_at
      const id = await upsertDraft({
        submittedAt: new Date().toISOString(),
        completedBy: completerId,
      })
      if (!id) { setIsSaving(false); return false }

      // Update work order status
      const today = todayPacific()
      const { error: statusErr } = await supabase
        .from('work_orders')
        .update({ status: 'completed', completion_date: today })
        .eq('id', workOrderId)

      if (statusErr) throw new Error(getSupabaseErrorMessage(statusErr))

      setIsSaving(false)
      return true
    } catch (err) {
      // Offline fallback
      if (!navigator.onLine || (err instanceof Error && err.message.includes('fetch'))) {
        try {
          await enqueueSubmission({
            workOrderId,
            payload: {
              completedBy: completerId,
              submittedAt: new Date().toISOString(),
            },
            photoBlobs: [],
            signatureBlob: null,
            createdAt: new Date().toISOString(),
          })
          setCompletionError('Saved offline. Will sync when connection is restored.')
        } catch {
          setCompletionError('Failed to save offline. Please try again.')
        }
      } else {
        setCompletionError(err instanceof Error ? err.message : 'Completion failed.')
      }
      setIsSaving(false)
      return false
    }
  }, [workOrderId, draft, upsertDraft])

  const isSubmitted = Boolean(draft?.submittedAt)

  return {
    draft,
    materials,
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
    refetch: fetchExisting,
  }
}
