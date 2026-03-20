import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { SitePhoto } from '@/types/database'

export function useSitePhotos(siteId: string | undefined) {
  const [photos, setPhotos] = useState<SitePhoto[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!siteId) return
    setIsLoading(true)

    const { data } = await supabase
      .from('site_photos')
      .select('*')
      .eq('site_id', siteId)
      .order('uploaded_at', { ascending: false })

    setPhotos((data ?? []) as SitePhoto[])
    setIsLoading(false)
  }, [siteId])

  useEffect(() => { fetch() }, [fetch])

  return { photos, isLoading, refetch: fetch }
}
