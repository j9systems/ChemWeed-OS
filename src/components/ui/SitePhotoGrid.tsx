import { useState, useRef } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import type { SitePhoto } from '@/types/database'

interface SitePhotoGridProps {
  photos: SitePhoto[]
  uploading: boolean
  onUpload: (file: File) => void
  canAdd: boolean
}

const PHOTOS_PER_PAGE = 6

export function SitePhotoGrid({ photos, uploading, onUpload, canAdd }: SitePhotoGridProps) {
  const [page, setPage] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const totalPages = Math.max(1, Math.ceil(photos.length / PHOTOS_PER_PAGE))
  const start = page * PHOTOS_PER_PAGE
  const visiblePhotos = photos.slice(start, start + PHOTOS_PER_PAGE)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onUpload(file)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">Site Photos</h4>
        {canAdd && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1 text-xs text-brand-green hover:underline min-h-[32px] disabled:opacity-50"
            >
              <Plus size={14} />
              {uploading ? 'Uploading...' : 'Add Photo'}
            </button>
          </>
        )}
      </div>

      {photos.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">No site photos yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 grid-rows-2 gap-1.5">
            {visiblePhotos.map((photo) => (
              <div key={photo.id} className="relative rounded-lg overflow-hidden aspect-square">
                <img
                  src={photo.url}
                  alt="Site photo"
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-30 min-h-[32px] min-w-[32px] flex items-center justify-center"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-xs text-[var(--color-text-muted)]">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-30 min-h-[32px] min-w-[32px] flex items-center justify-center"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
