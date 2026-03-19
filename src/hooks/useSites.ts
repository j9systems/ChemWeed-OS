import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Site } from '@/types/database'

export function useSites(clientId: string | undefined) {
  const [sites, setSites] = useState<Site[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!clientId) return
    setIsLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('sites')
      .select('*, county:counties(*)')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .order('name')

    if (err) {
      setError(err.message)
    } else {
      setSites((data ?? []) as Site[])
    }
    setIsLoading(false)
  }, [clientId])

  useEffect(() => { fetch() }, [fetch])

  return { sites, isLoading, error, refetch: fetch }
}
