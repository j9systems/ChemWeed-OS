import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { ServiceAgreement, ServiceAgreementLineItem } from '@/types/database'

export function useServiceAgreement(id: string | undefined) {
  const [agreement, setAgreement] = useState<ServiceAgreement | null>(null)
  const [lineItems, setLineItems] = useState<ServiceAgreementLineItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!id) return
    setIsLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('service_agreements')
      .select('*, client:clients(*), site:sites(*), service_type:service_types(*), pca:team!work_orders_pca_id_fkey(*), urgency_level:urgency_levels(*)')
      .eq('id', id)
      .single()

    if (err) {
      setError(err.message)
      setIsLoading(false)
      return
    }

    setAgreement(data as ServiceAgreement)

    // Fetch line items
    const { data: items, error: itemsErr } = await supabase
      .from('service_agreement_line_items')
      .select('*, service_type:service_types(*)')
      .eq('agreement_id', id)
      .order('sort_order', { ascending: true })

    if (itemsErr) {
      setError(itemsErr.message)
    } else {
      setLineItems((items ?? []) as ServiceAgreementLineItem[])
    }

    setIsLoading(false)
  }, [id])

  useEffect(() => { fetch() }, [fetch])

  return { agreement, lineItems, isLoading, error, refetch: fetch }
}
