import { useRef } from 'react'
import { Camera, Image, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface PhotoBucketProps {
  label: string
  required?: boolean
  urls: string[]
  disabled?: boolean
  uploading?: boolean
  onAdd: (file: File) => void
  onRemove: (url: string) => void
  error?: string | null
}

export function PhotoBucket({
  label,
  required,
  urls,
  disabled,
  uploading,
  onAdd,
  onRemove,
  error,
}: PhotoBucketProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const libraryInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      onAdd(file)
    }
    e.target.value = ''
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {urls.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {urls.map((url, i) => (
            <div key={url} className="relative rounded-lg overflow-hidden border border-surface-border">
              <img
                src={url}
                alt={`${label} ${i + 1}`}
                className="w-full h-24 object-cover"
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onRemove(url)}
                  className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80 min-h-[28px] min-w-[28px] flex items-center justify-center"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!disabled && (
        <>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />
          <input
            ref={libraryInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="flex flex-row gap-2">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={uploading || disabled}
            >
              <Camera size={16} />
              {uploading ? 'Uploading...' : 'Take Photo'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => libraryInputRef.current?.click()}
              disabled={uploading || disabled}
            >
              <Image size={16} />
              {uploading ? 'Uploading...' : 'Choose from Library'}
            </Button>
          </div>
        </>
      )}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
