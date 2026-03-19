import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { WorkOrderCharge } from '@/types/database'

export function useWorkOrderCharges(workOrderId: string | undefined) {
  const [charges, setCharges] = useState<WorkOrderCharge[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!workOrderId) return
    setIsLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('work_order_charges')
      .select('*')
      .eq('work_order_id', workOrderId)

    if (err) {
      setError(err.message)
    } else {
      setCharges((data ?? []) as WorkOrderCharge[])
    }
    setIsLoading(false)
  }, [workOrderId])

  useEffect(() => { fetch() }, [fetch])

  return { charges, isLoading, error, refetch: fetch }
}
