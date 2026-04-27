import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { ServiceAgreement, AgreementStatus } from '@/types/database'

interface AgreementFilters {
  status?: AgreementStatus
}

export function useServiceAgreements(filters?: AgreementFilters) {
  const [agreements, setAgreements] = useState<ServiceAgreement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    let query = supabase
      .from('service_agreements')
      .select('*, client:clients(*), site:sites(*), service_type:service_types(*), pca:team!work_orders_pca_id_fkey(*), sales_rep:team!service_agreements_sales_rep_id_fkey(*), urgency_level:urgency_levels(*), service_agreement_line_items(service_type:service_types(id, name))')
      .order('created_at', { ascending: false })

    if (filters?.status) {
      query = query.eq('agreement_status', filters.status)
    }

    const { data, error: err } = await query

    if (err) {
      setError(err.message)
    } else {
      setAgreements((data ?? []) as ServiceAgreement[])
    }
    setIsLoading(false)
  }, [filters?.status])

  useEffect(() => { fetch() }, [fetch])

  return { agreements, isLoading, error, refetch: fetch }
}
