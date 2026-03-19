import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { WorkOrderMaterial } from '@/types/database'

export function useWorkOrderMaterials(workOrderId: string | undefined) {
  const [materials, setMaterials] = useState<WorkOrderMaterial[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!workOrderId) return
    setIsLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('work_order_materials')
      .select('*, chemical:chemicals(*)')
      .eq('work_order_id', workOrderId)

    if (err) {
      setError(err.message)
    } else {
      setMaterials((data ?? []) as WorkOrderMaterial[])
    }
    setIsLoading(false)
  }, [workOrderId])

  useEffect(() => { fetch() }, [fetch])

  return { materials, isLoading, error, refetch: fetch }
}
