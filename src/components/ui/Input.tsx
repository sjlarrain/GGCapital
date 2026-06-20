import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, id, className, ...props }, ref) => {
    return (
      <div className="field">
        {label && (
          <label htmlFor={id} className="label">
            {label}
          </label>
        )}
        <div className="control">
          <input
            ref={ref}
            id={id}
            className={`input${error ? ' is-danger' : ''}${className ? ` ${className}` : ''}`}
            {...props}
          />
        </div>
        {error && <p className="help is-danger">{error}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
export default Input
