'use client'
import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'button',
          variant === 'primary' && 'is-primary',
          variant === 'secondary' && 'is-light',
          variant === 'ghost' && 'is-ghost',
          variant === 'danger' && 'is-danger',
          size === 'sm' && 'is-small',
          size === 'lg' && 'is-medium',
          className
        )}
        {...props}
      />
    )
  }
)

Button.displayName = 'Button'
export default Button
