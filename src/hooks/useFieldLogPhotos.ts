import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface FieldLogPhotoGroup {
  workOrderId: string
  serviceTypeName: string | null
  scheduledDate: string | null
  completionDate: string | null
  beforeUrls: string[]
  afterUrls: string[]
  duringUrls: string[]
}

/**
 * Fetches field completion photos for all work orders at a given site.
 * Groups photos by work order with before/after/during categorization.
 */
export function useFieldLogPhotos(siteId: string | undefined) {
  const [groups, setGroups] = useState<FieldLogPhotoGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!siteId) return
    setIsLoading(true)

    // Get all work orders for this site that have field completions with photos
    const { data, error } = await supabase
      .from('field_completions')
      .select(`
        work_order_id,
        before_photo_urls,
        after_photo_urls,
        during_photo_urls,
        work_order:work_orders!inner(
          id,
          site_id,
          scheduled_date,
          completion_date,
          service_type:service_types(name)
        )
      `)
      .eq('work_order.site_id', siteId)
      .order('work_order_id', { ascending: false })

    if (!error && data) {
      const result: FieldLogPhotoGroup[] = []
      for (const row of data as any[]) {
        const before = row.before_photo_urls ?? []
        const after = row.after_photo_urls ?? []
        const during = row.during_photo_urls ?? []
        // Skip completions with no photos
        if (before.length === 0 && after.length === 0 && during.length === 0) continue

        result.push({
          workOrderId: row.work_order_id,
          serviceTypeName: row.work_order?.service_type?.name ?? null,
          scheduledDate: row.work_order?.scheduled_date ?? null,
          completionDate: row.work_order?.completion_date ?? null,
          beforeUrls: before,
          afterUrls: after,
          duringUrls: during,
        })
      }
      // Sort by completion/scheduled date descending
      result.sort((a, b) => {
        const dateA = a.completionDate ?? a.scheduledDate ?? ''
        const dateB = b.completionDate ?? b.scheduledDate ?? ''
        return dateB.localeCompare(dateA)
      })
      setGroups(result)
    }
    setIsLoading(false)
  }, [siteId])

  useEffect(() => { fetch() }, [fetch])

  return { groups, isLoading, refetch: fetch }
}
