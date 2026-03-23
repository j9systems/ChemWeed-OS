import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Site } from '@/types/database'

export function useSite(siteId: string | undefined) {
  const [site, setSite] = useState<Site | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!siteId) return
    setIsLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('sites')
      .select('*, county:counties(*), client:clients(*)')
      .eq('id', siteId)
      .single()

    if (err) {
      setError(err.message)
    } else {
      setSite(data as Site)
    }
    setIsLoading(false)
  }, [siteId])

  useEffect(() => { fetch() }, [fetch])

  return { site, isLoading, error, refetch: fetch }
}
