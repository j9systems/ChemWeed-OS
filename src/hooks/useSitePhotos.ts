import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { SitePhoto } from '@/types/database'

export function useSitePhotos(siteId: string | undefined) {
  const [photos, setPhotos] = useState<SitePhoto[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!siteId) return
    setIsLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('site_photos')
      .select('*')
      .eq('site_id', siteId)
      .order('uploaded_at', { ascending: false })

    if (err) {
      setError(err.message)
    } else {
      setPhotos((data ?? []) as SitePhoto[])
    }
    setIsLoading(false)
  }, [siteId])

  useEffect(() => { fetch() }, [fetch])

  return { photos, isLoading, error, refetch: fetch }
}
