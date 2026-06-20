import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'blue' | 'green' | 'yellow' | 'red' | 'gray'
  className?: string
}

export default function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'tag',
        variant === 'blue' && 'is-info is-light',
        variant === 'green' && 'is-success is-light',
        variant === 'yellow' && 'is-warning is-light',
        variant === 'red' && 'is-danger is-light',
        variant === 'gray' && 'is-light',
        className
      )}
    >
      {children}
    </span>
  )
}
