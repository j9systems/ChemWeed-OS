import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { ServiceAgreementLineItem } from '@/types/database'

export function useServiceAgreementLineItems(agreementId: string | undefined) {
  const [lineItems, setLineItems] = useState<ServiceAgreementLineItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!agreementId) return
    setIsLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('service_agreement_line_items')
      .select('*, service_type:service_types(*)')
      .eq('agreement_id', agreementId)
      .order('sort_order', { ascending: true })

    if (err) {
      setError(err.message)
    } else {
      setLineItems((data ?? []) as ServiceAgreementLineItem[])
    }
    setIsLoading(false)
  }, [agreementId])

  useEffect(() => { fetch() }, [fetch])

  return { lineItems, isLoading, error, refetch: fetch }
}
