import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-9 w-full rounded-md border border-input bg-[#0d1219] px-2.5 text-sm text-foreground tabular-nums outline-none placeholder:text-muted/70',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
