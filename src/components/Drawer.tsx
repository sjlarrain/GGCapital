'use client'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  side?: 'left' | 'right'
}

export default function Drawer({ open, onClose, title, children, side = 'left' }: DrawerProps) {
  const baseClass = side === 'right' ? 'gg-drawer-right' : 'gg-drawer'

  return (
    <>
      {open && <div className="gg-drawer-backdrop" onClick={onClose} />}
      <div className={`${baseClass}${open ? ' is-active' : ''}`}>
        <div className="gg-drawer-header">
          <p className="title is-5 mb-0">{title ?? ''}</p>
          <button className="delete is-medium" aria-label="close" onClick={onClose} />
        </div>
        <div className="gg-drawer-body">
          {children}
        </div>
      </div>
    </>
  )
}
