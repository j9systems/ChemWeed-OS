import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { WorkOrder, WorkOrderStatus } from '@/types/database'

interface WorkOrderFilters {
  status?: WorkOrderStatus
  client_id?: string
  site_id?: string
}

export function useWorkOrders(filters?: WorkOrderFilters) {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    let query = supabase
      .from('work_orders')
      .select('*, client:clients(*), site:sites(*), service_type:service_types(*), pca:team!work_orders_pca_id_fkey(*), urgency_level:urgency_levels(*), agreement_line_item:service_agreement_line_items(*)')
      .order('created_at', { ascending: false })

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }
    if (filters?.client_id) {
      query = query.eq('client_id', filters.client_id)
    }
    if (filters?.site_id) {
      query = query.eq('site_id', filters.site_id)
    }

    const { data, error: err } = await query

    if (err) {
      setError(err.message)
    } else {
      setWorkOrders((data ?? []) as WorkOrder[])
    }
    setIsLoading(false)
  }, [filters?.status, filters?.client_id, filters?.site_id])

  useEffect(() => { fetch() }, [fetch])

  return { workOrders, isLoading, error, refetch: fetch }
}

export function useWorkOrder(id: string | undefined) {
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!id) return
    setIsLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('work_orders')
      .select('*, client:clients(*), site:sites(*), service_type:service_types(*), pca:team!work_orders_pca_id_fkey(*), urgency_level:urgency_levels(*), agreement_line_item:service_agreement_line_items(*, service_type:service_types(*)), service_agreement:service_agreements(*, client:clients(*))')
      .eq('id', id)
      .single()

    if (err) {
      setError(err.message)
    } else {
      setWorkOrder(data as WorkOrder)
    }
    setIsLoading(false)
  }, [id])

  useEffect(() => { fetch() }, [fetch])

  return { workOrder, isLoading, error, refetch: fetch }
}
