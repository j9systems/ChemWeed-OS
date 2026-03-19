import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { TeamMember } from '@/types/database'

export function useTeamMembers() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('team')
      .select('*')
      .eq('active', 'true')
      .order('last_name')

    if (err) {
      setError(err.message)
    } else {
      setMembers((data ?? []) as TeamMember[])
    }
    setIsLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { members, isLoading, error, refetch: fetch }
}
