import { useState, useRef } from 'react'
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { uploadSitePhoto } from '@/lib/storage'
import { compressImage } from '@/lib/image-compression'
import { getSupabaseErrorMessage } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import type { SitePhoto } from '@/types/database'

interface SitePhotoGalleryProps {
  siteId: string
  photos: SitePhoto[]
  canEdit: boolean
  userId: string | undefined
  refetchPhotos: () => void
}

const PAGE_SIZE = 6

export function SitePhotoGallery({ siteId, photos, canEdit, userId, refetchPhotos }: SitePhotoGalleryProps) {
  const [page, setPage] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const totalPages = Math.max(1, Math.ceil(photos.length / PAGE_SIZE))
  const visiblePhotos = photos.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    setError(null)

    try {
      for (const file of Array.from(files)) {
        const compressed = await compressImage(file)
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
        const photoUrl = await uploadSitePhoto(siteId, compressed, filename)

        const { error: insertErr } = await supabase
          .from('site_photos')
          .insert({ site_id: siteId, photo_url: photoUrl, uploaded_by: userId ?? null })

        if (insertErr) {
          setError(getSupabaseErrorMessage(insertErr))
          break
        }
      }
      refetchPhotos()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    }

    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleRemove(photoId: string) {
    const { error: err } = await supabase
      .from('site_photos')
      .delete()
      .eq('id', photoId)

    if (err) {
      setError(getSupabaseErrorMessage(err))
    } else {
      refetchPhotos()
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">Site Photos</h4>
        {canEdit && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              <Plus size={14} />
              {uploading ? 'Uploading...' : 'Add'}
            </Button>
          </>
        )}
      </div>

      {photos.length === 0 ? (
        <div className="flex items-center justify-center h-32 rounded-lg border border-dashed border-surface-border text-sm text-[var(--color-text-muted)]">
          No site photos yet
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 grid-rows-2 gap-1.5">
            {visiblePhotos.map((photo) => (
              <div key={photo.id} className="relative rounded-lg overflow-hidden border border-surface-border aspect-square">
                <img
                  src={photo.photo_url}
                  alt="Site photo"
                  className="w-full h-full object-cover"
                />
                {canEdit && (
                  <button
                    onClick={() => handleRemove(photo.id)}
                    className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1 rounded hover:bg-surface-raised disabled:opacity-30 min-h-[32px] min-w-[32px] flex items-center justify-center"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs text-[var(--color-text-muted)]">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1 rounded hover:bg-surface-raised disabled:opacity-30 min-h-[32px] min-w-[32px] flex items-center justify-center"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
