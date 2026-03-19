import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: boolean
}

export function Card({ padding = true, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-[20px] bg-surface-raised shadow-card',
        padding && 'p-10',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
