'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  wide?: boolean
}

export default function Modal({ open, onClose, title, children, wide }: ModalProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  if (!open || !mounted) return null

  return createPortal(
    <div className="modal is-active" style={{ zIndex: 600 }}>
      <div className="modal-background" onClick={onClose} style={{ zIndex: 601 }} />
      <div
        className="modal-card"
        style={{ maxWidth: wide ? 720 : 480, width: '95vw', zIndex: 602, position: 'relative' }}
      >
        <header className="modal-card-head">
          <p className="modal-card-title">{title ?? ''}</p>
          <button className="delete" aria-label="close" onClick={onClose} />
        </header>
        <section
          className="modal-card-body"
          style={{ maxHeight: '80vh', overflowY: 'auto' }}
        >
          {children}
        </section>
      </div>
    </div>,
    document.body
  )
}
