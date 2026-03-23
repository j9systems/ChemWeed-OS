import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { UrgencyLevel } from '@/types/database'

export function useUrgencyLevels() {
  const [urgencyLevels, setUrgencyLevels] = useState<UrgencyLevel[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('urgency_levels')
        .select('*')
        .order('sort_order', { ascending: false })

      setUrgencyLevels((data ?? []) as UrgencyLevel[])
      setIsLoading(false)
    }
    fetch()
  }, [])

  const defaultLevel = urgencyLevels.find((l) => l.is_default)

  return { urgencyLevels, defaultLevel, isLoading }
}
