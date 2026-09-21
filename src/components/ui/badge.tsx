import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium', {
  variants: {
    variant: {
      default: 'border-[#34554e] bg-[#182c28] text-bull',
      warning: 'border-[#614633] bg-[#322620] text-[#efba8d]',
      outline: 'border-border text-muted',
      live: 'border-bull/30 bg-bull/10 text-bull',
    },
  },
  defaultVariants: { variant: 'default' },
})

function Badge({ className, variant, ...props }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge }
