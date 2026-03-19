import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { ServiceType } from '@/types/database'

export function useServiceTypes() {
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('service_types')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (err) {
      setError(err.message)
    } else {
      setServiceTypes((data ?? []) as ServiceType[])
    }
    setIsLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { serviceTypes, isLoading, error }
}
