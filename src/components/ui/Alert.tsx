import { cn } from '@/lib/utils'

interface AlertProps {
  type: 'warning' | 'error' | 'info' | 'success'
  title?: string
  children: React.ReactNode
  className?: string
}

export default function Alert({ type, title, children, className }: AlertProps) {
  return (
    <div
      className={cn(
        'notification',
        type === 'warning' && 'is-warning is-light',
        type === 'error' && 'is-danger is-light',
        type === 'info' && 'is-info is-light',
        type === 'success' && 'is-success is-light',
        className
      )}
    >
      {title && <strong>{title} </strong>}
      {children}
    </div>
  )
}
