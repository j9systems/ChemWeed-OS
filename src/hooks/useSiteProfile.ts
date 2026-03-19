import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { SiteWeedProfile, SiteObservationLog } from '@/types/database'

export function useSiteProfile(siteId: string | undefined) {
  const [weedProfile, setWeedProfile] = useState<SiteWeedProfile[]>([])
  const [observationLogs, setObservationLogs] = useState<SiteObservationLog[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!siteId) return
    setIsLoading(true)

    const [profileRes, logsRes] = await Promise.all([
      supabase
        .from('site_weed_profile')
        .select('*')
        .eq('site_id', siteId)
        .order('added_at', { ascending: false }),
      supabase
        .from('site_observation_logs')
        .select('*')
        .eq('site_id', siteId)
        .order('observed_at', { ascending: false })
        .limit(20),
    ])

    if (!profileRes.error) {
      setWeedProfile((profileRes.data ?? []) as SiteWeedProfile[])
    }
    if (!logsRes.error) {
      setObservationLogs((logsRes.data ?? []) as SiteObservationLog[])
    }

    setIsLoading(false)
  }, [siteId])

  useEffect(() => { fetch() }, [fetch])

  return { weedProfile, observationLogs, isLoading, refetch: fetch }
}
