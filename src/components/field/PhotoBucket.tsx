import { useRef } from 'react'
import { Camera, X } from 'lucide-react'
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
  const inputRef = useRef<HTMLInputElement>(null)

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
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading || disabled}
          >
            <Camera size={16} />
            {uploading ? 'Uploading...' : 'Add Photo'}
          </Button>
        </>
      )}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
