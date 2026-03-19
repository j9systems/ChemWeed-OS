import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { compressImage } from '@/lib/image-compression'
import { uploadPhoto, uploadSignature } from '@/lib/storage'
import { enqueueSubmission } from '@/lib/offline-queue'
import { getSupabaseErrorMessage } from '@/lib/utils'

interface FieldCompletionData {
  workOrderId: string
  completedBy: string
  actualStartAt: string
  temperatureF: number | null
  windSpeedMph: number | null
  windDirection: string | null
  crewIds: string[]
  notes: string
  photos: File[]
  signatureBlob: Blob | null
  materialActuals: { materialId: string; actualAmountUsed: number | null; tanksUsed: number | null }[]
}

export function useFieldCompletion() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit(data: FieldCompletionData): Promise<boolean> {
    setIsSubmitting(true)
    setError(null)

    try {
      // 1. Compress and upload photos
      const photoUrls: string[] = []
      for (let i = 0; i < data.photos.length; i++) {
        const photo = data.photos[i]!
        setProgress(`Compressing photo ${i + 1} of ${data.photos.length}...`)
        const compressed = await compressImage(photo)
        setProgress(`Uploading photo ${i + 1} of ${data.photos.length}...`)
        const url = await uploadPhoto(data.workOrderId, compressed, `photo-${i}-${Date.now()}.jpg`)
        photoUrls.push(url)
      }

      // 2. Upload signature
      let signatureUrl: string | null = null
      if (data.signatureBlob) {
        setProgress('Uploading signature...')
        signatureUrl = await uploadSignature(data.workOrderId, data.signatureBlob)
      }

      // 3. Insert field completion record
      setProgress('Saving completion record...')
      const { error: insertErr } = await supabase.from('field_completions').insert({
        work_order_id: data.workOrderId,
        completed_by: data.completedBy,
        actual_start_at: data.actualStartAt,
        temperature_f: data.temperatureF,
        wind_speed_mph: data.windSpeedMph,
        wind_direction: data.windDirection,
        crew_ids: data.crewIds,
        notes: data.notes || null,
        signature_data_url: signatureUrl,
        photo_urls: photoUrls,
        submitted_at: new Date().toISOString(),
      })

      if (insertErr) throw new Error(getSupabaseErrorMessage(insertErr))

      // 4. Update material actuals
      for (const mat of data.materialActuals) {
        if (mat.actualAmountUsed != null || mat.tanksUsed != null) {
          await supabase
            .from('work_order_chemicals')
            .update({
              actual_amount: mat.actualAmountUsed,
              tank_number: mat.tanksUsed,
            })
            .eq('id', mat.materialId)
        }
      }

      // 5. Update work order status
      setProgress('Updating work order...')
      const { error: statusErr } = await supabase
        .from('work_orders')
        .update({ status: 'completed', completion_date: new Date().toISOString().split('T')[0] })
        .eq('id', data.workOrderId)

      if (statusErr) throw new Error(getSupabaseErrorMessage(statusErr))

      setProgress('')
      setIsSubmitting(false)
      return true
    } catch (err) {
      // If network error, queue for offline
      if (!navigator.onLine || (err instanceof Error && err.message.includes('fetch'))) {
        try {
          await enqueueSubmission({
            workOrderId: data.workOrderId,
            payload: {
              completedBy: data.completedBy,
              actualStartAt: data.actualStartAt,
              temperatureF: data.temperatureF,
              windSpeedMph: data.windSpeedMph,
              windDirection: data.windDirection,
              crewIds: data.crewIds,
              notes: data.notes,
              materialActuals: data.materialActuals,
            },
            photoBlobs: data.photos.map((f, i) => ({ name: `photo-${i}.jpg`, blob: f })),
            signatureBlob: data.signatureBlob,
            createdAt: new Date().toISOString(),
          })
          setError('Saved offline. Will sync when connection is restored.')
        } catch {
          setError('Failed to save offline. Please try again.')
        }
      } else {
        setError(err instanceof Error ? err.message : 'Submission failed.')
      }
      setIsSubmitting(false)
      return false
    }
  }

  return { submit, isSubmitting, progress, error }
}
