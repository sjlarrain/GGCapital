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
        'rounded-md p-4 text-sm',
        {
          'bg-yellow-50 text-yellow-800 border border-yellow-200': type === 'warning',
          'bg-red-50 text-red-800 border border-red-200': type === 'error',
          'bg-blue-50 text-blue-800 border border-blue-200': type === 'info',
          'bg-green-50 text-green-800 border border-green-200': type === 'success',
        },
        className
      )}
    >
      {title && <p className="font-semibold mb-1">{title}</p>}
      {children}
    </div>
  )
}
