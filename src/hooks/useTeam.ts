import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { TeamMember } from '@/types/database'

export function useTeamMembers(activeOnly = true) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    let query = supabase
      .from('team')
      .select('*')
      .order('last_name')

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data, error: err } = await query

    if (err) {
      setError(err.message)
    } else {
      setMembers((data ?? []) as TeamMember[])
    }
    setIsLoading(false)
  }, [activeOnly])

  useEffect(() => { fetch() }, [fetch])

  return { members, isLoading, error, refetch: fetch }
}
