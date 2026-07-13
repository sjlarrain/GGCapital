'use client'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { UserProfile } from '@/types'
import Modal from './ui/Modal'
import FeedbackForm from './FeedbackForm'

const navItems = [
  { href: '/', label: 'Dashboard', icon: '⊞' },
  { href: '/companies?view=companies', label: 'Companies', icon: '🏢' },
  { href: '/companies?view=funds', label: 'Funds', icon: '💰' },
  { href: '/companies?view=investors', label: 'Investors & Network', icon: '📊' },
  { href: '/contacts', label: 'Contacts', icon: '👤' },
  { href: '/meetings', label: 'Meetings', icon: '📅' },
  { href: '/tags', label: 'Tags', icon: '🏷' },
  { href: '/triage', label: 'Triage', icon: '🗂' },
  { href: '/network', label: 'Network', icon: '🕸' },
  { href: '/trash', label: 'Trash', icon: '🗑' },
]

const adminItems = [
  { href: '/feedback', label: 'Feedback', icon: '💬' },
  { href: '/admin', label: 'Admin', icon: '⚙' },
]

interface SidebarProps {
  profile: UserProfile
  onSignOut: () => void
}

export default function Sidebar({ profile, onSignOut }: SidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    const [hrefPath, hrefQuery] = href.split('?')
    if (hrefQuery) {
      const params = new URLSearchParams(hrefQuery)
      return pathname === hrefPath && [...params.entries()].every(([k, v]) => searchParams.get(k) === v)
    }
    return pathname.startsWith(hrefPath)
  }

  return (
    <>
      <aside className="gg-sidebar">
        <div className="gg-sidebar-brand">GG Capital</div>

        <nav className="menu px-2 py-3" style={{ flex: 1 }}>
          <ul className="menu-list">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(isActive(item.href) && 'is-active')}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          {profile.role === 'admin' && (
            <>
              <p className="menu-label mt-4">Admin</p>
              <ul className="menu-list">
                {adminItems.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(isActive(item.href) && 'is-active')}
                    >
                      <span>{item.icon}</span>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </nav>

        <div className="gg-sidebar-footer">
          <p style={{ color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {profile.email}
          </p>
          <p style={{ color: '#4a5568', textTransform: 'capitalize', marginTop: 2 }}>{profile.role}</p>
          <div style={{ marginTop: 8, display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button className="gg-feedback-btn" onClick={() => setFeedbackOpen(true)} title="Feedback" style={{ fontSize: '1rem', lineHeight: 1 }}>
              💬
            </button>
            <span style={{ color: '#2d3748' }}>·</span>
            <Link href="/settings" className="gg-feedback-btn" title="Settings" style={{ textDecoration: 'none', fontSize: '0.9rem', lineHeight: 1 }} aria-label="Settings">
              ⚙
            </Link>
            <span style={{ color: '#2d3748' }}>·</span>
            <button className="gg-feedback-btn" onClick={onSignOut} title="Sign out" style={{ fontSize: '1rem', lineHeight: 1 }}>
              🚪
            </button>
          </div>
        </div>
      </aside>

      <Modal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} title="Send Feedback">
        <FeedbackForm userId={profile.id} onSuccess={() => setFeedbackOpen(false)} />
      </Modal>
    </>
  )
}
