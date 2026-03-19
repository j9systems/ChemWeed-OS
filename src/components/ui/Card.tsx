import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: boolean
}

export function Card({ padding = true, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-[20px] bg-white shadow-[0px_8px_24px_0px_#7090B00A]',
        padding && 'p-4',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
