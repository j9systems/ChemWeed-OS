import { useEffect, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

interface PhotoLightboxProps {
  urls: string[]
  currentIndex: number
  onClose: () => void
  onChange: (index: number) => void
}

export function PhotoLightbox({ urls, currentIndex, onClose, onChange }: PhotoLightboxProps) {
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < urls.length - 1

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && hasPrev) onChange(currentIndex - 1)
      if (e.key === 'ArrowRight' && hasNext) onChange(currentIndex + 1)
    },
    [onClose, onChange, currentIndex, hasPrev, hasNext],
  )

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', handleKey)
    }
  }, [handleKey])

  if (urls.length === 0) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/90" onClick={onClose} />

      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
      >
        <X size={24} />
      </button>

      {/* Counter */}
      {urls.length > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 text-white/70 text-sm">
          {currentIndex + 1} / {urls.length}
        </div>
      )}

      {/* Previous */}
      {hasPrev && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange(currentIndex - 1) }}
          className="absolute left-3 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <ChevronLeft size={24} />
        </button>
      )}

      {/* Image */}
      <img
        src={urls[currentIndex]}
        alt={`Photo ${currentIndex + 1}`}
        className="relative z-[1] max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Next */}
      {hasNext && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange(currentIndex + 1) }}
          className="absolute right-3 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <ChevronRight size={24} />
        </button>
      )}
    </div>
  )
}
