import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { compressImage } from '@/lib/image-compression'
import type { SitePhoto } from '@/types/database'

export function useSitePhotos(siteId: string | undefined) {
  const [photos, setPhotos] = useState<SitePhoto[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

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

  async function uploadPhoto(file: File, userId?: string): Promise<string | null> {
    if (!siteId) return null
    setUploading(true)

    const compressed = await compressImage(file)
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${siteId}/${crypto.randomUUID()}.${ext}`

    const { error: storageErr } = await supabase.storage
      .from('site-photos')
      .upload(path, compressed, { contentType: compressed.type || 'image/jpeg' })

    if (storageErr) {
      setUploading(false)
      return null
    }

    const { data: urlData } = supabase.storage.from('site-photos').getPublicUrl(path)
    const url = urlData.publicUrl

    const { error: dbErr } = await supabase
      .from('site_photos')
      .insert({ site_id: siteId, url, uploaded_by: userId ?? null })

    if (dbErr) {
      setUploading(false)
      return null
    }

    setUploading(false)
    fetch()
    return url
  }

  async function deletePhoto(photoId: string) {
    await supabase.from('site_photos').delete().eq('id', photoId)
    fetch()
  }

  return { photos, isLoading, uploading, uploadPhoto, deletePhoto, refetch: fetch }
}
