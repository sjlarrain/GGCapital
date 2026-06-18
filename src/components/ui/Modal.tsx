'use client'
import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
}

export default function Modal({ open, onClose, title, children, className }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (open) ref.current?.showModal()
    else ref.current?.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className={cn(
        'rounded-lg shadow-xl p-0 backdrop:bg-black/40 w-full max-w-lg',
        className
      )}
    >
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        {title && <h2 className="text-base font-semibold text-gray-900">{title}</h2>}
        <button
          onClick={onClose}
          className="ml-auto text-gray-400 hover:text-gray-600 text-xl leading-none"
        >
          &times;
        </button>
      </div>
      <div className="px-6 py-4">{children}</div>
    </dialog>
  )
}
