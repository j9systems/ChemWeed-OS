import { useRef } from 'react'
import { Camera, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface PhotoCaptureProps {
  photos: File[]
  onAdd: (file: File) => void
  onRemove: (index: number) => void
}

export function PhotoCapture({ photos, onAdd, onRemove }: PhotoCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      onAdd(file)
    }
    // Reset input so same file can be selected again
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">Photos</label>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo, i) => (
            <div key={i} className="relative rounded-lg overflow-hidden border border-surface-border">
              <img
                src={URL.createObjectURL(photo)}
                alt={`Photo ${i + 1}`}
                className="w-full h-24 object-cover"
              />
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      <Button
        variant="secondary"
        size="sm"
        type="button"
        onClick={() => inputRef.current?.click()}
      >
        <Camera size={16} />
        {photos.length > 0 ? `Add Photo (${photos.length})` : 'Take Photo'}
      </Button>
    </div>
  )
}
