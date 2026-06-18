'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { UserProfile } from '@/types'

const navItems = [
  { href: '/', label: 'Dashboard', icon: '⊞' },
  { href: '/companies', label: 'Companies', icon: '🏢' },
  { href: '/contacts', label: 'Contacts', icon: '👤' },
  { href: '/meetings', label: 'Meetings', icon: '📅' },
  { href: '/tags', label: 'Tags', icon: '🏷' },
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

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <aside className="w-56 shrink-0 bg-gray-900 text-gray-100 flex flex-col h-screen sticky top-0">
      <div className="px-4 py-5 border-b border-gray-700">
        <span className="text-lg font-bold tracking-tight text-white">GG Capital</span>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              isActive(item.href)
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            )}
          >
            <span className="w-4 text-center">{item.icon}</span>
            {item.label}
          </Link>
        ))}

        {profile.role === 'admin' && (
          <>
            <div className="pt-4 pb-1 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Admin
            </div>
            {adminItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive(item.href)
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                )}
              >
                <span className="w-4 text-center">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </>
        )}
      </nav>

      <div className="px-4 py-3 border-t border-gray-700 text-xs">
        <p className="text-gray-400 truncate">{profile.email}</p>
        <p className="text-gray-600 capitalize">{profile.role}</p>
        <button
          onClick={onSignOut}
          className="mt-2 text-gray-500 hover:text-gray-300 transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
