import { TextareaHTMLAttributes, forwardRef } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, id, className, rows = 4, ...props }, ref) => {
    return (
      <div className="field">
        {label && (
          <label htmlFor={id} className="label">
            {label}
          </label>
        )}
        <div className="control">
          <textarea
            ref={ref}
            id={id}
            rows={rows}
            className={`textarea${error ? ' is-danger' : ''}${className ? ` ${className}` : ''}`}
            {...props}
          />
        </div>
        {error && <p className="help is-danger">{error}</p>}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'
export default Textarea
