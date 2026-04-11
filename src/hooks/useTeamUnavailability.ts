import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getSupabaseErrorMessage } from '@/lib/utils'
import type { TeamUnavailability } from '@/types/database'

interface InsertBlock {
  team_member_id: string
  start_date: string
  end_date: string
  all_day: boolean
  start_time: string | null
  end_time: string | null
  reason: string | null
  created_by: string | null
}

export function useTeamUnavailability(teamMemberId: string | undefined) {
  const [blocks, setBlocks] = useState<TeamUnavailability[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!teamMemberId) return
    setIsLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('team_unavailability')
      .select('*')
      .eq('team_member_id', teamMemberId)
      .order('start_date', { ascending: false })

    if (err) {
      setError(err.message)
    } else {
      setBlocks((data ?? []) as TeamUnavailability[])
    }
    setIsLoading(false)
  }, [teamMemberId])

  useEffect(() => { fetch() }, [fetch])

  async function addBlock(block: InsertBlock): Promise<{ error: string | null }> {
    const { error: err } = await supabase
      .from('team_unavailability')
      .insert(block)

    if (err) {
      return { error: getSupabaseErrorMessage(err) }
    }
    await fetch()
    return { error: null }
  }

  async function deleteBlock(blockId: string): Promise<{ error: string | null }> {
    const { error: err } = await supabase
      .from('team_unavailability')
      .delete()
      .eq('id', blockId)

    if (err) {
      return { error: getSupabaseErrorMessage(err) }
    }
    await fetch()
    return { error: null }
  }

  return { blocks, isLoading, error, refetch: fetch, addBlock, deleteBlock }
}
