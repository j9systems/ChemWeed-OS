import { useEffect } from 'react'
import { CheckCircle, AlertCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ToastProps {
  message: string
  type: 'success' | 'error'
  onClose: () => void
}

export function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg px-4 py-3 shadow-lg text-sm font-medium',
          type === 'success' && 'bg-green-50 text-green-800 border border-green-200',
          type === 'error' && 'bg-red-50 text-red-800 border border-red-200',
        )}
      >
        {type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
        {message}
        <button onClick={onClose} className="ml-2 p-0.5 rounded hover:bg-black/5">
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
