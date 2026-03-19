import { type InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-[var(--color-text-primary)]">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2',
            'text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
            'min-h-[44px] transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green',
            error && 'border-red-500 focus:ring-red-500/30 focus:border-red-500',
            className,
          )}
          {...props}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
