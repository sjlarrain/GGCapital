'use client'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase/client'
import type { UserProfile } from '@/types'

export default function AppShell({
  profile,
  children,
}: {
  profile: UserProfile
  children: React.ReactNode
}) {
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="flex h-full">
      <Sidebar profile={profile} onSignOut={handleSignOut} />
      <main className="flex-1 overflow-y-auto px-8 py-6">{children}</main>
    </div>
  )
}
