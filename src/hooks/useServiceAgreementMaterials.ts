import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { ServiceAgreementMaterial } from '@/types/database'

export function useServiceAgreementMaterials(agreementId: string | undefined) {
  const [materials, setMaterials] = useState<ServiceAgreementMaterial[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!agreementId) return
    setIsLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('service_agreement_materials')
      .select('*, chemical:chemicals(*)')
      .eq('agreement_id', agreementId)

    if (err) {
      setError(err.message)
    } else {
      setMaterials((data ?? []) as ServiceAgreementMaterial[])
    }
    setIsLoading(false)
  }, [agreementId])

  useEffect(() => { fetch() }, [fetch])

  return { materials, isLoading, error, refetch: fetch }
}
