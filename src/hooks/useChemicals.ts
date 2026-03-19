import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Chemical } from '@/types/database'

export function useChemicals() {
  const [chemicals, setChemicals] = useState<Chemical[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('chemicals')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (err) {
      setError(err.message)
    } else {
      setChemicals((data ?? []) as Chemical[])
    }
    setIsLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { chemicals, isLoading, error }
}
