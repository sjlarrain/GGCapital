import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import InviteForm from '@/components/InviteForm'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user!.id)
    .single()

  // Admin-only — return 404 for non-admins per spec
  if (profile?.role !== 'admin') {
    redirect('/not-found')
  }

  const { data: users } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at')

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">Admin</h1>

      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">Invite user</h2>
        <InviteForm />
      </div>

      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">Users ({users?.length ?? 0})</h2>
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {(users ?? []).map((u) => (
            <div key={u.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-gray-900">{u.email}</p>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                u.role === 'admin'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {u.role}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
